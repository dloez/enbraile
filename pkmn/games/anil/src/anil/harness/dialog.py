import logging
import sqlite3
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

from anil.bridge.protocol import Event
from anil.harness.changes import Mark, StateChanges, changes_fields, mark, state_changes
from anil.harness.context import OVERWORLD, Context
from anil.harness.drive import Driver, buttons
from anil.harness.investigate import Session
from anil.harness.navigate import (
    ACTION_TRIGGER,
    DIRECTIONS,
    Atlas,
    Static,
    abilities_of,
    facing_tiles,
    live_world,
    over_trigger,
)
from anil.harness.steps import (
    CHOICE,
    CONFIRM,
    MESSAGE,
    NUMBER,
    STUCK_STEPS,
    WAITING,
    Decision,
    Ended,
    Line,
    Look,
    Outcome,
    Steps,
    decision_fields,
    note,
    where,
)

log = logging.getLogger("harness.dialog")

DIALOG_KIND = "dialog"
DRIVEN = frozenset({MESSAGE, CHOICE, NUMBER}) | WAITING
START_TICKS = 20
PLAYER_TOUCH = 1
EVENT_TOUCH = 2
PRESSABLE = frozenset({ACTION_TRIGGER, EVENT_TOUCH})
TRIGGER_NAMES = {PLAYER_TOUCH: "player touch", 3: "autorun", 4: "parallel process"}


@dataclass(frozen=True)
class DialogResult:
    outcome: Outcome
    reason: str
    started: int
    tick: int
    context: Context
    transcript: list[Line]
    decision: Decision | None
    unused: list[str]
    frames: list[str]
    changes: StateChanges
    events: list[Event] = field(default_factory=list)


def handoff(view: Look) -> bool:
    return view.battle or view.context.name not in DRIVEN | {OVERWORLD}


def handoff_reason(view: Look) -> str:
    if view.battle:
        return f"a battle started at tick {view.tick}"
    return f"{where(view)} opened at tick {view.tick}"


@dataclass
class Loop(Steps):
    answers: list[str] = field(default_factory=list)

    def take(self) -> None:
        self.answers.pop(0)

    def run(self, view: Look) -> Ended:
        quiet = 0
        while True:
            if handoff(view):
                return Ended("handoff", handoff_reason(view))
            if view.idle:
                return Ended("finished", f"back on the idle overworld at tick {view.tick}")
            name = view.context.name
            answer = self.answers[0] if self.answers else None
            if name == MESSAGE:
                progressed = self.message(view)
            elif name in (CHOICE, NUMBER):
                step = (
                    self.choice(view, answer, self.take)
                    if name == CHOICE
                    else self.number(view, answer, self.take)
                )
                if isinstance(step, Ended):
                    return step
                progressed = step
            else:
                progressed = self.wait(view)
            quiet = 0 if progressed else quiet + 1
            if quiet >= STUCK_STEPS:
                return Ended("stuck", f"{quiet} steps in {name} made no progress")
            view = self.look()


def new_loop(driver: Driver, answers: Sequence[str], report: Callable[[str], None]) -> Loop:
    return Loop(driver, DIALOG_KIND, log, report, answers=list(answers))


def result_fields(result: DialogResult) -> dict[str, Any]:
    return {
        "outcome": result.outcome,
        "reason": result.reason,
        "decision": decision_fields(result.decision),
        "unused": result.unused,
        "ticks": result.tick - result.started,
        "context": result.context.name,
        "changes": changes_fields(result.changes),
    }


def conclude(loop: Loop, first: Look, ended: Ended, before: Mark) -> DialogResult:
    last = first if ended.outcome == "refused" else loop.look()
    changes = state_changes(before, mark(loop.session))
    result = DialogResult(
        outcome=ended.outcome,
        reason=ended.reason,
        started=first.tick,
        tick=last.tick,
        context=last.context,
        transcript=loop.transcript,
        decision=ended.decision,
        unused=loop.answers,
        frames=last.frames,
        changes=changes,
        events=loop.events,
    )
    loop.note("result", **result_fields(result))
    return result


def continue_dialog(
    driver: Driver, answers: Sequence[str], report: Callable[[str], None] = lambda _: None
) -> DialogResult:
    session = driver.session
    loop = new_loop(driver, answers, report)
    note(session, DIALOG_KIND, "start", entry="continue", answers=list(answers))
    before = mark(session)
    first = loop.look()
    if first.idle:
        ended = Ended("refused", "nothing is open or running on the overworld")
    elif handoff(first):
        place = "a battle" if first.battle else first.context.name
        ended = Ended("refused", f"the game is in {place}, not a dialog")
    else:
        ended = loop.run(first)
    return conclude(loop, first, ended, before)


def start_refusal(
    session: Session, connection: sqlite3.Connection, view: Look, map_id: int, event_id: int
) -> str | None:
    if view.battle or view.context.name != OVERWORLD or view.context.payloads:
        place = "a battle" if view.battle else view.context.name
        return f"the game is in {place}, not the idle overworld"
    live = live_world(session, connection)
    if live.player.moving:
        return "the player is moving"
    if live.map_id != map_id:
        return f"the player is on map {live.map_id}, not map {map_id}"
    atlas = Atlas(Static(connection), live, abilities_of(live))
    spot = atlas.spots(map_id).get(event_id)
    if spot is None:
        return f"map {map_id} has no live event {event_id}"
    page = spot.page
    if page is None:
        return f"event {event_id} has no active page"
    if page.trigger == PLAYER_TOUCH:
        return f"event {event_id} starts by stepping onto it"
    if page.trigger not in PRESSABLE:
        return f"event {event_id}'s page {page.number} is {TRIGGER_NAMES.get(page.trigger, page.trigger)}, not started by C"
    tile = (live.player.x, live.player.y)
    grid = atlas.area(map_id, "foot").grid
    if page.trigger == ACTION_TRIGGER and over_trigger(grid, spot):
        if tile in spot.tiles:
            return None
        return f"the player at {tile} is not on event {event_id}'s tiles {sorted(spot.tiles)}"
    direction = facing_tiles(grid, spot).get(tile)
    if direction is None:
        return f"the player at {tile} is not on a tile facing event {event_id}"
    if live.player.direction != direction:
        return (
            f"the player at {tile} faces {DIRECTIONS[live.player.direction]}, "
            f"not {DIRECTIONS[direction]} toward event {event_id}"
        )
    return None


def interact(
    driver: Driver,
    connection: sqlite3.Connection,
    map_id: int,
    event_id: int,
    answers: Sequence[str],
    report: Callable[[str], None] = lambda _: None,
) -> DialogResult:
    session = driver.session
    loop = new_loop(driver, answers, report)
    note(
        session,
        DIALOG_KIND,
        "start",
        entry="interact",
        map=map_id,
        event=event_id,
        answers=list(answers),
    )
    before = mark(session)
    first = loop.look()
    refusal = start_refusal(session, connection, first, map_id, event_id)
    if refusal is not None:
        return conclude(loop, first, Ended("refused", refusal), before)
    loop.advance(1, [buttons(CONFIRM)])
    view = loop.look()
    for _ in range(START_TICKS):
        if not view.idle or view.battle:
            break
        loop.advance(1)
        view = loop.look()
    if view.idle and not view.battle:
        ended = Ended(
            "no_effect", f"C on event {event_id} started nothing within {START_TICKS} ticks"
        )
    else:
        log.info("C on event %d started %s at tick %d", event_id, view.context.name, view.tick)
        ended = loop.run(view)
    return conclude(loop, first, ended, before)
