import json
import logging
import re
import secrets
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from anil.bridge.client import BridgeClient, BridgeError
from anil.bridge.protocol import Handshake
from anil.bridge.sources import LAUNCH_FILE, bridge_hash
from anil.harness.lock import (
    GameLock,
    acquire,
    live_lock,
    lock_is_live,
    read_lock,
    release,
    write_lock,
)
from anil.harness.snapshot import SnapshotError, read_snapshot
from anil.install.builds import Build
from anil.install.deploy import game_dir, read_stamp
from anil.install.windows import (
    GameStart,
    InteropError,
    WindowPlacement,
    kill_windows_process,
    launch_game,
    place_game_window,
    to_unc,
    to_windows,
    windows_processes_named,
)
from anil.settings import Settings

GAME_EXE = "Game.exe"
HANDSHAKE_TIMEOUT_SECONDS = 60.0
EPHEMERAL_RANGE_FILE = Path("/proc/sys/net/ipv4/ip_local_port_range")
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
DEFAULT_CLOCK = "2026-01-01T12:00"
REAL_CLOCK = "real"
SAVE_NAME = re.compile(r"[A-Za-z0-9_-]+")
SEED_LIMIT = 2**32
START_SAVE_DIR = "save"

log = logging.getLogger("harness.launch")


class LaunchError(Exception):
    pass


@dataclass(frozen=True)
class LaunchOptions:
    save: str
    clock: datetime | None
    seed: int | None
    snapshot: str | None = None
    hidden: bool = False


@dataclass(frozen=True)
class RunningGame:
    handshake: Handshake
    session_dir: Path
    save_dir: Path
    clock: datetime | None
    seed: int
    snapshot: str | None
    window: WindowPlacement | None


def parse_clock(text: str) -> datetime | None:
    if text == REAL_CLOCK:
        return None
    try:
        clock = datetime.fromisoformat(text)
    except ValueError as error:
        raise LaunchError(
            f"clock {text!r} is neither {REAL_CLOCK!r} nor a time like {DEFAULT_CLOCK}"
        ) from error
    if clock.tzinfo is not None:
        raise LaunchError(f"clock {text!r} carries a time zone; the game reads local time")
    return clock


def clock_field(clock: datetime | None) -> list[int] | str:
    if clock is None:
        return REAL_CLOCK
    return [clock.year, clock.month, clock.day, clock.hour, clock.minute, clock.second]


def save_dir_for(settings: Settings, name: str) -> Path:
    if not SAVE_NAME.fullmatch(name):
        raise LaunchError(f"save name {name!r} may hold only letters, digits, '-' and '_'")
    return settings.saves / name


def ephemeral_range() -> tuple[int, int]:
    low, high = EPHEMERAL_RANGE_FILE.read_text().split()
    return int(low), int(high)


def check_port(port: int) -> None:
    low, high = ephemeral_range()
    if low <= port <= high:
        raise LaunchError(
            f"bridge port {port} is inside the ephemeral range {low}-{high}, which Windows "
            "reserves under mirrored networking; set ANIL_BRIDGE_PORT outside it"
        )


def create_session(settings: Settings) -> tuple[str, Path]:
    base = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    settings.sessions.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 100):
        session = base if attempt == 1 else f"{base}-{attempt}"
        session_dir = settings.sessions / session
        try:
            session_dir.mkdir()
        except FileExistsError:
            continue
        return session, session_dir
    raise LaunchError(f"could not create a session directory under {settings.sessions}")


class SessionLog(logging.FileHandler):
    pass


def attach_session_log(session_dir: Path) -> None:
    harness_log = logging.getLogger("harness")
    for previous in [each for each in harness_log.handlers if isinstance(each, SessionLog)]:
        harness_log.removeHandler(previous)
        previous.close()
    handler = SessionLog(session_dir / "harness.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    harness_log.addHandler(handler)


def run(build: Build, settings: Settings, options: LaunchOptions) -> RunningGame:
    check_port(settings.bridge_port)
    save_dir = save_dir_for(settings, options.save)
    clock = options.clock
    seed = options.seed
    start: dict[str, object] | None = None
    if options.snapshot is not None:
        try:
            snapshot = read_snapshot(settings, options.snapshot)
        except SnapshotError as error:
            raise LaunchError(str(error)) from error
        year, month, day, hour, minute, second = snapshot.clock
        clock = datetime(year, month, day, hour, minute, second)
        seed = snapshot.seed if seed is None else seed
        start = {"name": snapshot.name, "hash": snapshot.hash, "seed": seed}
    seed = seed if seed is not None else secrets.randbelow(SEED_LIMIT)
    if not 0 <= seed < SEED_LIMIT:
        raise LaunchError(f"seed {seed} is outside 0-{SEED_LIMIT - 1}")
    target = game_dir(settings)
    stamp = read_stamp(target)
    if stamp is None or not stamp.base_complete:
        raise LaunchError(f"{target} is not deployed; run `anil install --harness`")
    if stamp.build != build.name:
        raise LaunchError(f"{target} holds build {stamp.build}, not {build.name}; redeploy")
    if stamp.bridge_hash is None:
        raise LaunchError(f"{target} has no bridge; run `anil install --harness`")
    current_hash = bridge_hash()
    if stamp.bridge_hash != current_hash:
        raise LaunchError(
            f"the deployed bridge {stamp.bridge_hash} differs from the repo's {current_hash}; "
            "run `anil install --harness`"
        )
    held = live_lock(settings.lock_file)
    if held is not None:
        raise LaunchError(f"a game is already running (session {held.session}); `anil stop` it")
    session, session_dir = create_session(settings)
    attach_session_log(session_dir)
    lock = acquire(settings.lock_file, session)
    save_dir.mkdir(parents=True, exist_ok=True)
    shutil.copytree(save_dir, session_dir / START_SAVE_DIR)
    settings.snapshots.mkdir(parents=True, exist_ok=True)
    launch = {
        "session": session,
        "port": settings.bridge_port,
        "session_dir": to_unc(session_dir),
        "bridge_log": to_unc(session_dir / "bridge.log"),
        "save": options.save,
        "save_dir": to_unc(save_dir),
        "clock": clock_field(clock),
        "seed": seed,
        "snapshots_dir": to_unc(settings.snapshots),
        "snapshot": start,
    }
    (session_dir / "launch.json").write_text(
        json.dumps({**launch, "build": build.name, "stamp": stamp.model_dump()}, indent=2) + "\n"
    )
    (target / LAUNCH_FILE).write_text(json.dumps(launch) + "\n")
    log.info(
        "session %s: launching %s (build %s, save %s, clock %s, seed %s, snapshot %s)",
        session,
        target / GAME_EXE,
        build.name,
        options.save,
        clock or REAL_CLOCK,
        seed,
        options.snapshot,
    )
    try:
        game_start = launch_game(to_windows(target / GAME_EXE))
        log.info(
            "session %s: started game pid %s, foreground window %s",
            session,
            game_start.pid,
            game_start.foreground,
        )
        handshake = handshake_with(settings, session, stamp.bridge_hash, lock, options.snapshot)
    except BaseException as error:
        log.error("session %s: launch failed: %s", session, error)
        outcome = abandon_launch(settings, session, target)
        if isinstance(error, (BridgeError, LaunchError, InteropError, OSError)):
            raise LaunchError(f"{error}; {outcome}") from error
        raise
    finally:
        (target / LAUNCH_FILE).unlink(missing_ok=True)
    log.info(
        "session %s: handshake ok: pid %s, build %s, bridge %s, protocol %s, tick %s",
        session,
        handshake.pid,
        handshake.build,
        handshake.bridge_hash,
        handshake.protocol,
        handshake.tick,
    )
    window = place_window(session, handshake.pid, game_start, options.hidden)
    return RunningGame(
        handshake=handshake,
        session_dir=session_dir,
        save_dir=save_dir,
        clock=clock,
        seed=seed,
        snapshot=options.snapshot,
        window=window,
    )


def place_window(session: str, pid: int, start: GameStart, hidden: bool) -> WindowPlacement | None:
    try:
        placement = place_game_window(pid, start.foreground, not hidden)
    except InteropError as error:
        log.warning("session %s: could not place the game window: %s", session, error)
        return None
    log.info(
        "session %s: game window %s on %s at %s; foreground taken %s, restored %s",
        session,
        "shown" if placement.visible else "hidden",
        placement.monitor or "the only monitor",
        placement.rect,
        placement.taken,
        placement.restored,
    )
    return placement


def handshake_with(
    settings: Settings,
    session: str,
    deployed_hash: str | None,
    lock: GameLock,
    snapshot: str | None,
) -> Handshake:
    with BridgeClient.connect(
        settings.bridge_port, name="anil run", timeout=HANDSHAKE_TIMEOUT_SECONDS
    ) as client:
        handshake = client.hello()
    if handshake.session != session:
        raise LaunchError(
            f"the bridge on port {settings.bridge_port} belongs to session {handshake.session}, "
            f"not {session}: another game holds the port"
        )
    lock.game_pid = handshake.pid
    write_lock(settings.lock_file, lock)
    if handshake.bridge_hash != deployed_hash:
        raise LaunchError(
            f"the game runs bridge {handshake.bridge_hash}, but the deploy stamp says "
            f"{deployed_hash}; redeploy with `anil install --harness`"
        )
    if handshake.snapshot != snapshot:
        raise LaunchError(
            f"the game booted into snapshot {handshake.snapshot}, not {snapshot}; see bridge.log"
        )
    return handshake


def kill_games_under(folder: Path) -> list[int]:
    root = to_windows(folder)
    killed = []
    for pid, executable in windows_processes_named(GAME_EXE):
        if executable is None or not executable.is_relative_to(root):
            continue
        try:
            kill_windows_process(pid)
        except InteropError as error:
            log.warning("could not kill game pid %s: %s", pid, error)
            continue
        killed.append(pid)
    return killed


def abandon_launch(settings: Settings, session: str, target: Path) -> str:
    try:
        killed = kill_games_under(target)
    except InteropError as error:
        log.error("session %s: could not look for a leftover game: %s", session, error)
        outcome = f"could not look for a leftover game ({error}); check `tasklist.exe`"
    else:
        for pid in killed:
            log.info("session %s: killed leftover game pid %s", session, pid)
        pids = ", ".join(str(pid) for pid in killed)
        outcome = f"killed the game (pid {pids})" if killed else "no game was left running"
    release(settings.lock_file)
    return outcome


def stop(settings: Settings) -> str:
    lock = read_lock(settings.lock_file)
    if lock is None:
        return "no game is running"
    session_dir = settings.sessions / lock.session
    if session_dir.is_dir():
        attach_session_log(session_dir)
    live = lock_is_live(lock)
    if lock.game_pid is None and live:
        raise LaunchError(
            f"session {lock.session} is still launching (harness pid {lock.harness_pid})"
        )
    if lock.game_pid is None or not live:
        release(settings.lock_file)
        log.info("session %s: removed a stale lock", lock.session)
        return f"removed the stale lock of session {lock.session}"
    kill_windows_process(lock.game_pid)
    release(settings.lock_file)
    log.info("session %s: killed game pid %s", lock.session, lock.game_pid)
    return f"stopped session {lock.session} (game pid {lock.game_pid})"
