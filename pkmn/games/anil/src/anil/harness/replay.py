import json
import logging
import shutil
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ValidationError

from anil.bridge.protocol import Digest, Reply, SpeedPreset, TickInput
from anil.bridge.sources import bridge_hash
from anil.harness.drive import drive
from anil.harness.investigate import Session, attach
from anil.harness.launch import REAL_CLOCK, START_SAVE_DIR, LaunchOptions, run, stop
from anil.harness.lock import live_lock
from anil.harness.snapshot import SnapshotError, read_snapshot
from anil.install.builds import BUILDS
from anil.install.deploy import DeployStamp
from anil.settings import Settings

RECORD_FILE = "record.jsonl"
LAUNCH_JSON = "launch.json"
REPLAY_SAVE_PREFIX = "replay-"
DRIVER_NAME = "anil replay"
SPEED_CLIENT_NAME = "anil replay speed"
START_SPEED: SpeedPreset = "1x"
IGNORED_KINDS = frozenset(
    {
        "control",
        "event",
        "nav",
        "dialog",
        "menu",
        "battle",
        "check",
        "rules",
        "rules_bought",
        "rules_shiny",
        "rules_sleep",
    }
)

log = logging.getLogger("harness.replay")

type Reporter = Callable[[str], None]


class ReplayError(Exception):
    pass


class ReplayDivergence(ReplayError):
    pass


class StartSnapshot(BaseModel):
    name: str
    hash: str
    seed: int


class SessionLaunch(BaseModel):
    session: str
    save: str
    clock: tuple[int, int, int, int, int, int] | Literal["real"]
    seed: int
    snapshot: StartSnapshot | None = None
    build: str
    stamp: DeployStamp


@dataclass(frozen=True)
class Checkpoint:
    tick: int
    start: int
    client: str | None
    request: Any
    digest: Digest


@dataclass(frozen=True)
class EvalStep:
    tick: int
    end: int
    client: str | None
    source: str
    ok: bool
    digest: Digest


@dataclass(frozen=True)
class RestoreStep:
    tick: int
    name: str
    hash: str
    seed: int


@dataclass(frozen=True)
class SpeedStep:
    tick: int
    preset: SpeedPreset


type Step = Checkpoint | EvalStep | RestoreStep | SpeedStep

STEP_RANK: dict[type, int] = {Checkpoint: 0, EvalStep: 1, SpeedStep: 1, RestoreStep: 2}


@dataclass
class Segment:
    inputs: dict[int, TickInput] = field(default_factory=dict)
    steps: list[tuple[int, int, int, Step]] = field(default_factory=list)

    def add(self, order: int, step: Step) -> None:
        self.steps.append((step.tick, STEP_RANK[type(step)], order, step))

    def ordered(self) -> list[Step]:
        return [step for *_, step in sorted(self.steps, key=lambda item: item[:3])]


@dataclass(frozen=True)
class ReplayPlan:
    launch: SessionLaunch
    segments: list[Segment]
    snapshots: dict[str, str]


@dataclass(frozen=True)
class ReplayOutcome:
    session: str
    advances: int
    evals: int
    restores: int
    first_tick: int
    last_tick: int


def load_launch(session_dir: Path) -> SessionLaunch:
    try:
        return SessionLaunch.model_validate_json((session_dir / LAUNCH_JSON).read_bytes())
    except FileNotFoundError as error:
        raise ReplayError(
            f"no session {session_dir.name}: {session_dir} has no launch.json"
        ) from error
    except ValidationError as error:
        raise ReplayError(
            f"session {session_dir.name} has an unreadable launch.json: {error}"
        ) from error


def load_record(session_dir: Path) -> list[dict[str, Any]]:
    path = session_dir / RECORD_FILE
    if not path.is_file():
        raise ReplayError(f"session {session_dir.name} has no {RECORD_FILE}")
    entries = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError as error:
            raise ReplayError(f"{path}:{number} is not JSON: {error}") from error
        if not isinstance(entry, dict) or "kind" not in entry or "tick" not in entry:
            raise ReplayError(f"{path}:{number} is not a record entry")
        entries.append(entry)
    return entries


def tick_input(entry: dict[str, Any]) -> TickInput:
    return TickInput.model_validate(
        {name: entry[name] for name in ("buttons", "keys", "text") if entry.get(name) is not None}
    )


def advance_inputs(entry: dict[str, Any]) -> list[TickInput]:
    sent = [tick_input(item) for item in entry.get("inputs") or []]
    ran = entry["ran"]
    if not sent:
        return [TickInput()] * ran
    if entry.get("repeat"):
        return [sent[index % len(sent)] for index in range(ran)]
    return [sent[index] if index < len(sent) else TickInput() for index in range(ran)]


def digest_of(entry: dict[str, Any]) -> Digest:
    try:
        return Digest.model_validate(entry["digest"])
    except (KeyError, ValidationError) as error:
        raise ReplayError(f"{entry['kind']} entry at tick {entry['tick']} has no digest") from error


def build_plan(session_dir: Path) -> ReplayPlan:
    launch = load_launch(session_dir)
    segments = [Segment()]
    snapshots: dict[str, str] = {}
    for order, entry in enumerate(load_record(session_dir)):
        try:
            add_entry(launch, segments, snapshots, order, entry)
        except KeyError as error:
            raise ReplayError(
                f"{entry['kind']} entry at tick {entry['tick']} lacks the field {error}"
            ) from error
    return ReplayPlan(launch, segments, snapshots)


def add_entry(
    launch: SessionLaunch,
    segments: list[Segment],
    snapshots: dict[str, str],
    order: int,
    entry: dict[str, Any],
) -> None:
    kind = entry["kind"]
    tick = entry["tick"]
    segment = segments[-1]
    if kind == "advance":
        end = entry["end"]
        if end != tick + entry["ran"]:
            raise ReplayError(f"advance at tick {tick} ran {entry['ran']} ticks but ends at {end}")
        for offset, given in enumerate(advance_inputs(entry), start=1):
            segment.inputs[tick + offset] = given
        segment.add(
            order, Checkpoint(end, tick, entry.get("client"), entry.get("id"), digest_of(entry))
        )
    elif kind == "input":
        segment.inputs[tick] = tick_input(entry)
    elif kind == "eval":
        segment.add(
            order,
            EvalStep(
                tick,
                entry["end"],
                entry.get("client"),
                entry["source"],
                entry["ok"],
                digest_of(entry),
            ),
        )
    elif kind == "speed":
        segment.add(order, SpeedStep(tick, entry["speed"]))
    elif kind == "snapshot":
        snapshots[entry["name"]] = entry["hash"]
        segment.add(order, RestoreStep(tick, entry["name"], entry["hash"], entry["seed"]))
    elif kind == "restore":
        snapshots[entry["name"]] = entry["hash"]
        if entry["via"] == "boot":
            if launch.snapshot is None or launch.snapshot.name != entry["name"]:
                raise ReplayError(f"the record boots into {entry['name']}, launch.json does not")
            return
        if entry["via"] == "restore":
            segment.add(
                order, RestoreStep(entry["from"], entry["name"], entry["hash"], entry["seed"])
            )
        segments.append(Segment())
    elif kind not in IGNORED_KINDS:
        raise ReplayError(f"replay does not know record entries of kind {kind!r} (tick {tick})")


def check_plan(settings: Settings, plan: ReplayPlan) -> list[str]:
    launch = plan.launch
    if launch.clock == REAL_CLOCK:
        raise ReplayError(f"session {launch.session} ran on the real clock and cannot be replayed")
    if launch.build not in BUILDS:
        raise ReplayError(f"session {launch.session} ran build {launch.build}, which is unknown")
    starting = {} if launch.snapshot is None else {launch.snapshot.name: launch.snapshot.hash}
    for name, recorded in {**plan.snapshots, **starting}.items():
        try:
            current = read_snapshot(settings, name).hash
        except SnapshotError as error:
            raise ReplayError(f"session {launch.session} needs snapshot {name}: {error}") from error
        if current != recorded:
            raise ReplayError(
                f"session {launch.session} needs snapshot {name} with hash {recorded}, "
                f"which now has {current}"
            )
    current_hash = bridge_hash()
    if launch.stamp.bridge_hash == current_hash:
        return []
    ran = launch.stamp.bridge_hash
    return [f"session {launch.session} ran bridge {ran}; replaying on {current_hash}"]


def prepare_save(settings: Settings, session_dir: Path, session: str) -> str:
    held = live_lock(settings.lock_file)
    if held is not None:
        raise ReplayError(f"a game is already running (session {held.session}); `anil stop` it")
    start = session_dir / START_SAVE_DIR
    if not start.is_dir():
        raise ReplayError(f"session {session} kept no starting save ({start} is missing)")
    name = f"{REPLAY_SAVE_PREFIX}{session}"
    target = settings.saves / name
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(start, target)
    return name


def launch_options(plan: ReplayPlan, save: str) -> LaunchOptions:
    launch = plan.launch
    clock = None if launch.clock == REAL_CLOCK else datetime(*launch.clock)
    snapshot = None if launch.snapshot is None else launch.snapshot.name
    return LaunchOptions(save=save, clock=clock, seed=launch.seed, snapshot=snapshot)


def input_span(segment: Segment, start: int, end: int) -> list[dict[str, Any]]:
    span = [
        segment.inputs.get(tick, TickInput()).model_dump(exclude_defaults=True)
        for tick in range(start + 1, end + 1)
    ]
    while span and not span[-1]:
        span.pop()
    return span


def ensure(reply: Reply, what: str) -> Reply:
    if not reply.ok:
        raise ReplayError(f"{what} failed at tick {reply.tick}: {reply.error}")
    return reply


class Replayer:
    def __init__(
        self, session: Session, speed: Session, start_speed: SpeedPreset, report: Reporter
    ) -> None:
        self.session = session
        self.speed = speed
        self.report = report
        self.tick = ensure(session.client.request("rng"), "reading the tick").tick
        self.first_tick = self.tick
        self.advances = 0
        self.evals = 0
        self.restores = 0
        self.set_speed(start_speed)

    def run_to(self, segment: Segment, target: int) -> None:
        if target < self.tick:
            raise ReplayError(
                f"the record needs tick {target}, but the replay is already at tick {self.tick}"
            )
        if target == self.tick:
            return
        reply = ensure(
            self.session.client.request(
                "advance", ticks=target - self.tick, inputs=input_span(segment, self.tick, target)
            ),
            "advance",
        )
        stopped = reply.result.get("stopped") if isinstance(reply.result, dict) else None
        if stopped != "ticks" or reply.tick != target:
            raise ReplayError(
                f"the advance to tick {target} stopped on {stopped} at tick {reply.tick}"
            )
        self.tick = reply.tick

    def play(self, segment: Segment, final: bool) -> None:
        missed = [
            tick
            for tick, given in segment.inputs.items()
            if tick <= self.tick and given != TickInput()
        ]
        if missed:
            raise ReplayError(
                f"the record holds input for tick {min(missed)}, but the replay is already "
                f"at tick {self.tick}"
            )
        early = [
            step.tick
            for step in segment.ordered()
            if isinstance(step, SpeedStep) and step.tick < self.tick
        ]
        if early:
            raise ReplayError(
                f"the record changes the speed at tick {min(early)}, but the replay is already "
                f"at tick {self.tick}"
            )
        for step in segment.ordered():
            match step:
                case Checkpoint():
                    self.run_to(segment, step.tick)
                    self.check_advance(step)
                case EvalStep():
                    self.run_to(segment, step.tick)
                    self.replay_eval(step)
                case RestoreStep():
                    self.run_to(segment, step.tick)
                    self.replay_restore(step)
                case SpeedStep():
                    self.run_to(segment, step.tick)
                    self.set_speed(step.preset)
        if final and segment.inputs:
            last = max(segment.inputs)
            if last > self.tick:
                self.run_to(segment, last)

    def check_advance(self, step: Checkpoint) -> None:
        self.advances += 1
        replayed = self.digest_now()
        if replayed != step.digest:
            raise ReplayDivergence(
                f"first divergence: the advance over ticks {step.start}-{step.tick} "
                f"(client {step.client}, request {step.request}) recorded "
                f"{step.digest.model_dump()}, replayed {describe(replayed)}"
            )

    def digest_now(self) -> Digest | None:
        return ensure(self.session.client.request("rng"), "reading the digest").digest

    def replay_eval(self, step: EvalStep) -> None:
        self.evals += 1
        reply = self.session.client.request("eval", source=step.source)
        self.tick = reply.tick
        if reply.ok != step.ok or reply.tick != step.end or reply.digest != step.digest:
            outcome = "ok" if reply.ok else f"error {reply.error}"
            raise ReplayDivergence(
                f"first divergence: the eval at tick {step.tick} (client {step.client}) "
                f"{step.source!r} recorded ok={step.ok}, end {step.end}, "
                f"{step.digest.model_dump()}; replayed {outcome}, end {reply.tick}, "
                f"{describe(reply.digest)}"
            )

    def set_speed(self, preset: SpeedPreset) -> None:
        ensure(self.speed.client.request("speed", preset=preset), f"setting the speed {preset}")

    def replay_restore(self, step: RestoreStep) -> None:
        self.restores += 1
        reply = ensure(
            self.session.client.request(
                "snapshot", action="restore", name=step.name, seed=step.seed
            ),
            f"restoring snapshot {step.name}",
        )
        self.tick = reply.tick
        self.report(f"tick {step.tick}: restored snapshot {step.name} (seed {step.seed})")


def start_speed(settings: Settings, plan: ReplayPlan) -> SpeedPreset:
    snapshot = plan.launch.snapshot
    if snapshot is None:
        return START_SPEED
    try:
        return read_snapshot(settings, snapshot.name).speed
    except SnapshotError as error:
        raise ReplayError(
            f"session {plan.launch.session} needs snapshot {snapshot.name}: {error}"
        ) from error


def describe(digest: Digest | None) -> object:
    return None if digest is None else digest.model_dump()


def replay(settings: Settings, session: str, *, keep: bool, report: Reporter) -> ReplayOutcome:
    session_dir = settings.sessions / session
    plan = build_plan(session_dir)
    warnings = check_plan(settings, plan)
    save = prepare_save(settings, session_dir, session)
    running = run(BUILDS[plan.launch.build], settings, launch_options(plan, save))
    replay_session = running.handshake.session or running.session_dir.name
    log.info("session %s: replaying session %s", replay_session, session)
    for warning in warnings:
        log.warning(warning)
    report(f"session {replay_session}: replaying {session} from tick {running.handshake.tick}")
    try:
        with (
            drive(settings, DRIVER_NAME) as driver,
            attach(settings, SPEED_CLIENT_NAME, "control") as speed,
        ):
            replayer = Replayer(driver.session, speed, start_speed(settings, plan), report)
            for index, segment in enumerate(plan.segments):
                replayer.play(segment, final=index == len(plan.segments) - 1)
            return ReplayOutcome(
                session=replay_session,
                advances=replayer.advances,
                evals=replayer.evals,
                restores=replayer.restores,
                first_tick=replayer.first_tick,
                last_tick=replayer.tick,
            )
    finally:
        if not keep:
            report(stop(settings))
