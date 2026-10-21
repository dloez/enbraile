import json
import logging
import sqlite3
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from anil.bridge.client import BridgeError
from anil.bridge.protocol import NoteResult
from anil.harness import gamedb
from anil.harness.drive import DriveError
from anil.harness.investigate import InvestigateError, Session, attach
from anil.harness.snapshot import SnapshotError
from anil.harness.world import WorldError
from anil.install.windows import InteropError
from anil.settings import Settings

CHECK_KIND = "check"
SHOWN = 5
log = logging.getLogger("harness.check")


type Reporter = Callable[[str], None]


class CheckError(Exception):
    pass


@dataclass
class CheckResult:
    name: str
    passed: bool = True
    evidence: list[str] = field(default_factory=list)

    def expect(self, label: str, actual: Any, expected: Any) -> bool:
        ok = actual == expected
        line = f"{label}: {actual!r}" if ok else f"{label}: {actual!r}, expected {expected!r}"
        return self.mark(ok, line)

    def mark(self, ok: bool, line: str) -> bool:
        self.evidence.append(f"{'ok ' if ok else 'BAD'} {line}")
        self.passed = self.passed and ok
        return ok

    def note(self, line: str) -> None:
        self.evidence.append(f"    {line}")


def mark_all(result: CheckResult, label: str, problems: list[str], total: int) -> None:
    shown = "; ".join(problems[:SHOWN])
    result.mark(
        not problems,
        f"{label}: {total - len(problems)} of {total} hold{', ' + shown if shown else ''}",
    )


def eval_inspect(session: Session, source: str) -> str:
    return session.eval(source).value.inspect


def record(session: Session, result: CheckResult) -> None:
    reply = session.call(
        "note",
        kind=CHECK_KIND,
        entry={"name": result.name, "passed": result.passed, "evidence": result.evidence},
    )
    if not NoteResult.model_validate(reply.result).recorded:
        log.info("the session keeps no record; the check %s entry was dropped", result.name)


LIVE_ERRORS = (
    BridgeError,
    CheckError,
    InvestigateError,
    InteropError,
    SnapshotError,
    DriveError,
    WorldError,
    OSError,
    ValueError,
    KeyError,
    IndexError,
)


def report_result(result: CheckResult, report: Reporter) -> None:
    report(f"{'pass' if result.passed else 'FAIL'} {result.name}")
    for line in result.evidence:
        report(f"  {line}")


GAMEDB_CHECK = "gamedb"
GAMEDB_CLIENT_NAME = "anil db check"
GAMEDB_CHUNK = 200
GAMEDB_KEYS = "AnilJSON.encode({cls}::DATA.keys)"
GAMEDB_ENTRIES = (
    "AnilJSON.encode({cls}::DATA.values[{start}, {count}].map {{ |d| "
    "[d.id, d.instance_variables.to_h {{ |v| x = d.instance_variable_get(v); "
    "[v.to_s, x.is_a?(GameData::Move) ? x.id : x] }}] }})"
)
GAMEDB_TM_MOVES = (
    "AnilJSON.encode((($PokemonGlobal && $PokemonGlobal.tm_move_map) || {}).map { |i, m| "
    "[i, m.respond_to?(:id) ? m.id : m] })"
)
GAMEDB_ROLLED_FIELD = "@move"
GAMEDB_MATCHUPS = (
    "AnilJSON.encode(GameData::Type.keys.to_h { |a| "
    "[a, GameData::Type.keys.to_h { |d| [d, Effectiveness.calculate(a, d)] }] })"
)


def gamedb_eval(session: Session, source: str) -> Any:
    return json.loads(json.loads(eval_inspect(session, source).replace("\\#", "#")))


def gamedb_kind(
    session: Session, connection: sqlite3.Connection, kind: gamedb.Kind, result: CheckResult
) -> None:
    cls = gamedb.GAME_CLASSES[kind]
    cached = list(gamedb.entries(connection, kind))
    live_keys = [gamedb.entry_id(key) for key in gamedb_eval(session, GAMEDB_KEYS.format(cls=cls))]
    result.expect(
        f"{kind}: ids in order ({len(cached)} cached, {len(live_keys)} live)",
        [found.id for found in cached] == live_keys,
        True,
    )
    live: dict[str, dict[str, Any]] = {}
    for start in range(0, len(live_keys), GAMEDB_CHUNK):
        source = GAMEDB_ENTRIES.format(cls=cls, start=start, count=GAMEDB_CHUNK)
        live.update((gamedb.entry_id(key), raw) for key, raw in gamedb_eval(session, source))
    rolled = dict(gamedb_eval(session, GAMEDB_TM_MOVES)) if kind == "items" else {}
    differences = [
        f"{found.id}: {', '.join(gamedb_fields(found.raw, live.get(found.id)))}"
        for found in cached
        if not gamedb_accepted(found.raw, live.get(found.id), rolled.get(found.id))
    ]
    label = f"{kind}: every cached entry equal to live {cls}"
    if kind == "items":
        label += f", or {GAMEDB_ROLLED_FIELD} rolled as tm_move_map gives it"
    mark_all(result, label, differences, len(cached))
    if rolled:
        gamedb_note_rolled(result, cached, live, rolled)


def gamedb_accepted(raw: dict[str, Any], live: dict[str, Any] | None, rolled: Any) -> bool:
    if raw == live:
        return True
    if live is None or rolled is None:
        return False
    return live.get(GAMEDB_ROLLED_FIELD) == rolled and raw == {
        **live,
        GAMEDB_ROLLED_FIELD: raw.get(GAMEDB_ROLLED_FIELD),
    }


def gamedb_note_rolled(
    result: CheckResult,
    cached: list[gamedb.Entry],
    live: dict[str, dict[str, Any]],
    rolled: dict[str, Any],
) -> None:
    accepted = [
        found
        for found in cached
        if found.id in rolled and gamedb_accepted(found.raw, live.get(found.id), rolled[found.id])
    ]
    file_move = [
        f"{found.id} {rolled[found.id]}" for found in accepted if found.raw == live.get(found.id)
    ]
    rolled_move = [
        f"{found.id} {rolled[found.id]}" for found in accepted if found.raw != live.get(found.id)
    ]
    result.note(
        f"rolled TMs accepted with the data-file {GAMEDB_ROLLED_FIELD} ({len(file_move)}): "
        f"{', '.join(file_move) or 'none'}"
    )
    result.note(
        f"rolled TMs accepted with the rolled {GAMEDB_ROLLED_FIELD} ({len(rolled_move)}): "
        f"{', '.join(rolled_move) or 'none'}"
    )


def gamedb_fields(raw: dict[str, Any], live: dict[str, Any] | None) -> list[str]:
    if live is None:
        return ["not live"]
    return [
        f"{name} cached {raw.get(name)!r}, live {live.get(name)!r}"
        for name in sorted(set(raw) | set(live))
        if raw.get(name) != live.get(name)
    ]


def gamedb_matchups(session: Session, connection: sqlite3.Connection, result: CheckResult) -> None:
    live = gamedb_eval(session, GAMEDB_MATCHUPS)
    types = gamedb.type_ids(connection)
    wrong = [
        f"{attack} against {defend}: cached {cached}, live {live[attack][defend]}"
        for attack in types
        for defend in types
        if (cached := gamedb.matchup(connection, attack, defend).multiplier) != live[attack][defend]
    ]
    mark_all(result, "type matchups equal to live Effectiveness.calculate", wrong, len(types) ** 2)
    for defend in ("FAIRY", "DRAGON"):
        result.note(
            f"against {defend}: "
            + ", ".join(
                f"{attack} {live[attack][defend]}" for attack in types if live[attack][defend] != 1
            )
        )


def check_gamedb(session: Session, connection: sqlite3.Connection) -> CheckResult:
    result = CheckResult(GAMEDB_CHECK)
    result.note(f"cache stamp {gamedb.counts(connection).stamp}")
    try:
        for kind in gamedb.KINDS:
            gamedb_kind(session, connection, kind, result)
        gamedb_matchups(session, connection, result)
    except LIVE_ERRORS as error:
        result.mark(False, f"the check stopped: {type(error).__name__}: {error}")
    record(session, result)
    return result


def run_gamedb_check(
    settings: Settings, connection: sqlite3.Connection, report: Reporter
) -> CheckResult:
    with attach(settings, GAMEDB_CLIENT_NAME) as session:
        result = check_gamedb(session, connection)
    report_result(result, report)
    return result
