import logging
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from anil.bridge.protocol import ReadRequest
from anil.harness.changes import mark
from anil.harness.context import MENU, UNKNOWN
from anil.harness.drive import Driver
from anil.harness.investigate import Session
from anil.harness.menu import (
    MENU_KIND,
    MENU_PAYLOAD,
    NO,
    PARTY_SLOTS,
    MenuResult,
    Stop,
    Verb,
    conclude,
    member_name,
    stopped,
    unanswered,
)
from anil.harness.state import GameState, Pokemon
from anil.harness.steps import (
    CANCEL,
    CHOICE,
    CONFIRM,
    MESSAGE,
    STUCK_STEPS,
    TRANSITION,
    AnswerLine,
    Ended,
    Look,
    note,
    where,
)

log = logging.getLogger("harness.menu")

STORAGE_BOX = "storage_box"
STORAGE_PARTY = "storage_party"
STORAGE_SCREENS = frozenset({STORAGE_BOX, STORAGE_PARTY})
BOX_WIDTH = 6
BOX_SLOTS = 30
BOX_NAME = -1
PARTY_BUTTON = -2
CLOSE_BUTTON = -3
PANEL_ROWS = PARTY_SLOTS + 1
GRID_PRESSES = 3
MOVE = "Mover"
PLACE = "Dejar"
WITHDRAW = "Sacar"
DEPOSIT = "Guardar"
BOX_PROMPT = re.compile(r"^¿Dejar en qué caja\?")
MORE_PROMPT = re.compile(r"^¿Desea hacer más operaciones\?")
BOX_COUNT = ("boxes", "$PokemonStorage.maxBoxes")


@dataclass(frozen=True)
class Withdraw:
    box: int
    slot: int


@dataclass(frozen=True)
class Deposit:
    pokemon: int
    box: int


@dataclass(frozen=True)
class Move:
    source: tuple[int, int]
    target: tuple[int, int]


type PcOp = Withdraw | Deposit | Move


class OpError(ValueError):
    pass


def op_text(op: PcOp) -> str:
    if isinstance(op, Withdraw):
        return f"withdraw={op.box},{op.slot}"
    if isinstance(op, Deposit):
        return f"deposit={op.pokemon},{op.box}"
    return f"move={op.source[0]},{op.source[1]}:{op.target[0]},{op.target[1]}"


def pair(text: str) -> tuple[int, int] | None:
    first, comma, second = text.partition(",")
    if not comma or not first.isdigit() or not second.isdigit():
        return None
    return int(first), int(second)


def parse_op(text: str) -> PcOp:
    name, _, value = text.partition("=")
    if name in ("withdraw", "deposit") and (numbers := pair(value)) is not None:
        return Withdraw(*numbers) if name == "withdraw" else Deposit(*numbers)
    source, _, target = value.partition(":")
    if name == "move" and (start := pair(source)) is not None and (end := pair(target)):
        return Move(start, end)
    raise OpError(
        f"{text!r} is not an operation: use withdraw=BOX,SLOT, deposit=PARTY_SLOT,BOX "
        "or move=BOX,SLOT:BOX,SLOT"
    )


def occupant(state: GameState, box: int, slot: int) -> Pokemon | None:
    return next(
        (stored.pokemon for stored in state.boxes if stored.box == box and stored.slot == slot),
        None,
    )


def stored_in(state: GameState, box: int) -> int:
    return sum(1 for stored in state.boxes if stored.box == box)


def pokemon_name(pokemon: Pokemon | None) -> str:
    if pokemon is None:
        return "nothing"
    return pokemon.nickname or pokemon.species.name or pokemon.species.id


def box_count(session: Session) -> int:
    read = session.read(ReadRequest(paths=[BOX_COUNT], depth=1)).value.values
    return int(read.get(BOX_COUNT[0]) or 0)


def cell_refusal(op: PcOp, box: int, slot: int, boxes: int) -> str | None:
    if not 0 <= box < boxes:
        return f"{op_text(op)}: there is no box {box}; boxes are 0 to {boxes - 1}"
    if not 0 <= slot < BOX_SLOTS:
        return f"{op_text(op)}: there is no slot {slot}; slots are 0 to {BOX_SLOTS - 1}"
    return None


def plan_refusal(ops: Sequence[PcOp], state: GameState, boxes: int) -> str | None:
    taken = {(stored.box, stored.slot) for stored in state.boxes}
    party = len(state.party)
    for op in ops:
        if isinstance(op, Withdraw):
            refusal = cell_refusal(op, op.box, op.slot, boxes)
            if refusal is not None:
                return refusal
            if (op.box, op.slot) not in taken:
                return f"{op_text(op)}: box {op.box} slot {op.slot} is empty"
            if party < PARTY_SLOTS:
                taken.discard((op.box, op.slot))
                party += 1
        elif isinstance(op, Deposit):
            refusal = cell_refusal(op, op.box, 0, boxes)
            if refusal is not None:
                return refusal
            if not 0 <= op.pokemon < party:
                return f"{op_text(op)}: party slot {op.pokemon} is empty; the party has {party}"
            free = next((slot for slot in range(BOX_SLOTS) if (op.box, slot) not in taken), None)
            if free is not None and party > 1:
                taken.add((op.box, free))
                party -= 1
        else:
            refusal = cell_refusal(op, *op.source, boxes) or cell_refusal(op, *op.target, boxes)
            if refusal is not None:
                return refusal
            if op.source == op.target:
                return f"{op_text(op)}: the source and target are the same slot"
            if op.source not in taken:
                return f"{op_text(op)}: box {op.source[0]} slot {op.source[1]} is empty"
            if op.target in taken:
                return f"{op_text(op)}: box {op.target[0]} slot {op.target[1]} is taken"
            taken.discard(op.source)
            taken.add(op.target)
    return None


@dataclass
class Storage(Verb):
    boxes: int = 0
    target_box: int | None = None
    box_picked: bool = False

    def resting(self, view: Look) -> bool:
        newest = view.newest
        screen = view.context.screen
        return (
            view.context.name == MENU
            and screen in STORAGE_SCREENS
            and newest is not None
            and newest.get("kind") == MENU_PAYLOAD
            and newest.get("screen") == screen
        )

    def confirm_prompt(self, view: Look, payload: dict[str, Any]) -> bool | Stop:
        prompt = self.prompt(view, payload) or ""
        if self.target_box is not None and BOX_PROMPT.match(prompt):
            return self.choose_box(view, payload, prompt)
        return super().confirm_prompt(view, payload)

    def choose_box(self, view: Look, payload: dict[str, Any], prompt: str) -> bool | Stop:
        if self.box_picked or self.target_box is None:
            if not self.confirm(view, CANCEL):
                return Stop("stuck", "B on the box list closed nothing")
            return True
        options = [self.text(option) for option in payload.get("options") or []]
        if self.target_box >= len(options):
            return Stop("stuck", f"the box list has no row {self.target_box}: {options}")
        self.prompted(view, "box")
        label = options[self.target_box]
        reached = self.cursor_to(view, CHOICE, self.target_box, len(options), label)
        if isinstance(reached, Ended):
            return stopped(reached)
        view, _ = reached
        self.record(AnswerLine(view.tick, prompt, options, label))
        self.box_picked = True
        if not self.confirm(view):
            return Stop("stuck", f"C on {label!r} closed nothing")
        return True

    def grid(self, view: Look) -> tuple[Look, int, int] | Stop:
        quiet = 0
        while view.context.name == TRANSITION:
            quiet = 0 if self.wait(view) else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"{quiet} steps in {where(view)} made no progress")
            view = self.look()
        if view.context.name == UNKNOWN:
            return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
        if view.context.screen != STORAGE_BOX:
            return Stop("stuck", f"the box is not shown; the game is in {where(view)}")
        found = self.live(view, MENU_PAYLOAD, "cursor", MENU)
        if isinstance(found, Ended):
            return stopped(found)
        view, payload = found
        return view, payload["box"], payload["cursor"]

    def grid_key(self, shown: int, cursor: int, box: int, cell: int) -> str:
        if shown != box:
            if cursor != BOX_NAME:
                return "UP"
            forward = (box - shown) % self.boxes
            return "RIGHT" if forward <= self.boxes - forward else "LEFT"
        if cursor == BOX_NAME:
            return "DOWN"
        if cell == PARTY_BUTTON:
            return "LEFT" if cursor % BOX_WIDTH >= BOX_WIDTH // 2 else "DOWN"
        if cursor < 0:
            return "UP"
        row, column = divmod(cursor, BOX_WIDTH)
        target_row, target_column = divmod(cell, BOX_WIDTH)
        if row != target_row:
            return "DOWN" if target_row > row else "UP"
        return "RIGHT" if (target_column - column) % BOX_WIDTH <= BOX_WIDTH // 2 else "LEFT"

    def to_cell(self, view: Look, box: int | None, cell: int) -> Look | Stop:
        for _ in range(GRID_PRESSES * (self.boxes + BOX_SLOTS)):
            read = self.grid(view)
            if isinstance(read, Stop):
                return read
            view, shown, cursor = read
            wanted = shown if box is None else box
            if shown == wanted and cursor == cell:
                self.prompted(view, "box_slot")
                return view
            self.press(self.grid_key(shown, cursor, wanted, cell))
            view = self.look()
        place = "the party button" if cell == PARTY_BUTTON else f"box {box} slot {cell}"
        return Stop("stuck", f"the box cursor never reached {place}")

    def pick(self, view: Look, label: str, name: str) -> Look | Stop:
        if not self.confirm(view):
            return Stop("stuck", f"C on {name} opened nothing")
        return self.command(self.look(), label)

    def to_box_view(self, view: Look) -> Look | Stop:
        settled = self.settle(view)
        if isinstance(settled, Stop):
            return settled
        if settled.context.screen == STORAGE_PARTY:
            if not self.confirm(settled, CANCEL):
                return Stop("stuck", "B on the party panel closed nothing")
            settled = self.settle(self.look())
            if isinstance(settled, Stop):
                return settled
        if settled.context.screen != STORAGE_BOX:
            return Stop("stuck", f"the box did not come back; the game is in {where(settled)}")
        return settled

    def leave_storage(self, view: Look) -> Stop | None:
        home = self.to_box_view(view)
        if isinstance(home, Stop):
            return home
        if not self.confirm(home, CANCEL):
            return Stop("stuck", "B on the box asked nothing")
        asked = self.look()
        payload = asked.payload(CHOICE)
        prompt = None if payload is None else self.prompt(asked, payload)
        if payload is None or not MORE_PROMPT.match(prompt or ""):
            return Stop("stuck", f"B on the box did not ask to stop; the game is in {where(asked)}")
        step = self.choice(asked, NO, lambda: None)
        if isinstance(step, Ended):
            return unanswered(step, NO)
        quiet = 0
        view = self.look()
        while not (view.idle or view.context.name in (MESSAGE, CHOICE)):
            if view.context.name == UNKNOWN:
                return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
            quiet = 0 if self.wait(view) else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"closing the box, {where(view)} made no progress")
            view = self.look()
        return None

    def abandon(self, view: Look, since: int, fallback: str) -> Stop:
        reason = self.last_message(since) or fallback
        left = self.leave_storage(view)
        if left is not None:
            return left
        return Stop("failed", reason)

    def withdraw(self, view: Look, op: Withdraw) -> tuple[Look, str] | Stop:
        before = mark(self.session).state
        name = pokemon_name(occupant(before, op.box, op.slot))
        reached = self.to_cell(view, op.box, op.slot)
        if isinstance(reached, Stop):
            return reached
        since = len(self.transcript)
        commanded = self.pick(reached, WITHDRAW, name)
        if isinstance(commanded, Stop):
            return commanded
        settled = self.settle(commanded)
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        if len(after.party) != len(before.party) + 1 or occupant(after, op.box, op.slot):
            return self.abandon(settled, since, f"{name} was not withdrawn")
        return settled, f"withdrew {name} from box {op.box} slot {op.slot}"

    def deposit(self, view: Look, op: Deposit) -> tuple[Look, str] | Stop:
        before = mark(self.session).state
        name = member_name(before, op.pokemon)
        button = self.to_cell(view, None, PARTY_BUTTON)
        if isinstance(button, Stop):
            return button
        panel = self.press_into(button, CONFIRM, STORAGE_PARTY)
        if isinstance(panel, Stop):
            return panel
        reached = self.cursor_to(
            panel, MENU_PAYLOAD, op.pokemon, PANEL_ROWS, name, ("RIGHT", "LEFT")
        )
        if isinstance(reached, Ended):
            return stopped(reached)
        self.prompted(reached[0], STORAGE_PARTY)
        since = len(self.transcript)
        self.target_box, self.box_picked = op.box, False
        commanded = self.pick(reached[0], DEPOSIT, name)
        if isinstance(commanded, Stop):
            return commanded
        settled = self.settle(commanded)
        self.target_box = None
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        stored = stored_in(after, op.box) - stored_in(before, op.box)
        if len(after.party) != len(before.party) - 1 or stored != 1:
            return self.abandon(settled, since, f"{name} was not deposited")
        home = self.to_box_view(settled)
        if isinstance(home, Stop):
            return home
        return home, f"deposited {name} into box {op.box}"

    def move(self, view: Look, op: Move) -> tuple[Look, str] | Stop:
        before = mark(self.session).state
        name = pokemon_name(occupant(before, *op.source))
        reached = self.to_cell(view, *op.source)
        if isinstance(reached, Stop):
            return reached
        since = len(self.transcript)
        held = self.pick(reached, MOVE, name)
        if isinstance(held, Stop):
            return held
        settled = self.settle(held)
        if isinstance(settled, Stop):
            return settled
        target = self.to_cell(settled, *op.target)
        if isinstance(target, Stop):
            return target
        placed = self.pick(target, PLACE, name)
        if isinstance(placed, Stop):
            return placed
        settled = self.settle(placed)
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        if occupant(after, *op.source) is not None or occupant(after, *op.target) is None:
            return self.abandon(settled, since, f"{name} was not moved")
        return settled, (
            f"moved {name} from box {op.source[0]} slot {op.source[1]} "
            f"to box {op.target[0]} slot {op.target[1]}"
        )

    def organise(self, view: Look, ops: Sequence[PcOp]) -> Stop:
        done = []
        for op in ops:
            if isinstance(op, Withdraw):
                result = self.withdraw(view, op)
            elif isinstance(op, Deposit):
                result = self.deposit(view, op)
            else:
                result = self.move(view, op)
            if isinstance(result, Stop):
                return result
            view, summary = result
            done.append(summary)
        left = self.leave_storage(view)
        if left is not None:
            return left
        summary = "; ".join(done) if done else "closed the box"
        return Stop("finished", f"{summary}; back at the PC at tick {self.tick}")


def storage_box(verb: Storage, first: Look) -> Look | str:
    view = first
    quiet = 0
    while view.context.name == TRANSITION and quiet < STUCK_STEPS:
        quiet = 0 if verb.wait(view) else quiet + 1
        view = verb.look()
    if view.battle or not verb.resting(view) or view.context.screen != STORAGE_BOX:
        place = "a battle" if view.battle else where(view)
        return f"the PC's box is not open; the game is in {place}"
    return view


def pc(
    driver: Driver,
    ops: Sequence[PcOp],
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    session = driver.session
    verb = Storage(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="pc", ops=[op_text(op) for op in ops], answers=[])
    before = mark(session)
    first = verb.look()
    shown = storage_box(verb, first)
    refusal = shown if isinstance(shown, str) else None
    if refusal is None:
        verb.boxes = box_count(session)
        refusal = plan_refusal(ops, before.state, verb.boxes)
    if refusal is not None or not isinstance(shown, Look):
        stop = Stop("refused", refusal or "the PC's box is not open")
    else:
        stop = verb.organise(shown, ops)
    return conclude(verb, first, stop, before, with_boxes=True)
