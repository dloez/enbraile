import json
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image

from anil.bridge.client import BridgeClient, BridgeError
from anil.bridge.protocol import (
    Digest,
    EvalResult,
    Event,
    ReadRequest,
    ReadResult,
    Reply,
    RngResult,
    Role,
    ShotResult,
    SpeedResult,
    StackResult,
)
from anil.harness.lock import live_lock
from anil.settings import Settings

ATTACH_TIMEOUT_SECONDS = 5.0
RECORD_FILE = "record.jsonl"


class InvestigateError(Exception):
    pass


@dataclass(frozen=True)
class Answer[T]:
    tick: int
    value: T
    caller: list[str] = field(default_factory=list)
    payloads: list[dict[str, Any]] = field(default_factory=list)
    digest: Digest | None = None
    events: list[Event] = field(default_factory=list)


def answer[T](reply: Reply, value: T) -> Answer[T]:
    return Answer(reply.tick, value, reply.caller, reply.payloads, reply.digest)


def recorded_events(session_dir: Path, after: int, before: int | None) -> list[Event]:
    events = []
    with (session_dir / RECORD_FILE).open(encoding="utf-8") as record:
        for line in record:
            if not line.endswith("\n"):
                break
            entry = json.loads(line)
            if entry.get("kind") != "event":
                continue
            seq = entry["seq"]
            if seq > after and (before is None or seq < before):
                events.append(
                    Event(seq=seq, tick=entry["tick"], kind=entry["event"], data=entry["data"])
                )
    return events


@dataclass
class Session:
    client: BridgeClient
    session: str
    session_dir: Path
    settings: Settings
    event_seq: int = 0
    since: int | None = None
    inbox: list[Event] = field(default_factory=list)

    def follow_events(self, since: int | None = None) -> None:
        self.since = self.event_seq if since is None else since

    def take_events(self) -> list[Event]:
        events = self.inbox
        self.inbox = []
        return events

    def call(self, cmd: str, **args: object) -> Reply:
        cursor = self.since
        reply = (
            self.client.request(cmd, **args)
            if cursor is None
            else self.client.request(cmd, since=cursor, **args)
        )
        if not reply.ok:
            raise InvestigateError(f"{cmd} failed at tick {reply.tick}: {reply.error}")
        if cursor is None:
            return reply
        events = reply.events
        if reply.events_gap:
            first = events[0].seq if events else None
            events = [*recorded_events(self.session_dir, cursor, first), *events]
        if events:
            self.inbox.extend(events)
            self.since = events[-1].seq
        return reply

    def eval(self, source: str) -> Answer[EvalResult]:
        reply = self.call("eval", source=source)
        return answer(reply, EvalResult.model_validate(reply.result))

    def stack(self) -> Answer[StackResult]:
        reply = self.call("stack")
        return answer(reply, StackResult.model_validate(reply.result))

    def shot(self) -> Answer[Path]:
        reply = self.call("shot")
        bitmap = self.session_dir / ShotResult.model_validate(reply.result).file
        png = bitmap.with_suffix(".png")
        with Image.open(bitmap) as image:
            image.convert("RGB").save(png)
        bitmap.unlink()
        return answer(reply, png)

    def read(self, request: ReadRequest) -> Answer[ReadResult]:
        reply = self.call("read", **request.model_dump(exclude_none=True))
        return answer(reply, ReadResult.model_validate(reply.result))

    def rng(self) -> Answer[RngResult]:
        reply = self.call("rng")
        return answer(reply, RngResult.model_validate(reply.result))

    def speed(self) -> Answer[SpeedResult]:
        reply = self.call("speed")
        return answer(reply, SpeedResult.model_validate(reply.result))


@contextmanager
def attach(settings: Settings, name: str, role: Role | None = None) -> Generator[Session]:
    lock = live_lock(settings.lock_file)
    if lock is None or lock.game_pid is None:
        raise InvestigateError("no game is running; start one with `anil run`")
    try:
        client = BridgeClient.connect(
            settings.bridge_port, name=name, timeout=ATTACH_TIMEOUT_SECONDS
        )
    except BridgeError as error:
        raise InvestigateError(str(error)) from error
    with client:
        handshake = client.hello(role)
        if handshake.session != lock.session:
            raise InvestigateError(
                f"the bridge on port {settings.bridge_port} belongs to session "
                f"{handshake.session}, not the running session {lock.session}"
            )
        yield Session(
            client,
            lock.session,
            settings.sessions / lock.session,
            settings,
            handshake.event_seq,
        )
