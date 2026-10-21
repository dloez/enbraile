import logging
import re
import sqlite3
import unicodedata
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from anil.bridge.protocol import Event, ReadRequest, TickInput
from anil.harness.changes import (
    Mark,
    StateChanges,
    changes_fields,
    item_counts,
    mark,
    member_fields,
    state_changes,
)
from anil.harness.context import (
    BATTLE_LEARN_MOVE,
    EVENT,
    MENU,
    POKEDEX_ENTRY,
    RELEARNER,
    SPECIAL,
    UNKNOWN,
    Context,
    frame_key,
)
from anil.harness.drive import Driver, buttons, keys
from anil.harness.investigate import Session
from anil.harness.state import GameState, Names, read_names
from anil.harness.steps import (
    CANCEL,
    CHOICE,
    CONFIRM,
    MESSAGE,
    NUMBER,
    PRESS_TICKS,
    STUCK_STEPS,
    TRANSITION,
    AnswerLine,
    Ended,
    Line,
    Look,
    MessageLine,
    Outcome,
    Steps,
    decision_fields,
    note,
    where,
)
from anil.harness.world import MAP_REDIRECTS, Landing, Place, landing_target, landings

log = logging.getLogger("harness.menu")

MENU_KIND = "menu"
MENU_PAYLOAD = "menu"
NAMING = "naming"
EVOLUTION = "evolution"
FORGET_MOVE = "forget_move"
CHAIN = frozenset({"learn_move", FORGET_MOVE, EVOLUTION, "stats", NAMING})
EVOLUTION_START = "¡Anda!"
LEARN_CONFIRM = re.compile(r"^¿Quieres que .+ olvide un movimiento")
GIVE_UP_CONFIRM = re.compile(r"^¿(?:Dejas de aprender|Quieres que no aprenda) ")
YES = "Sí"
NO = "No"
BACKSPACE = "BACKSPACE"
RETURN = "RETURN"
CANCEL_TICKS = 600
TEXT_ENTRY = "322:UI_TextEntry:"
TEXT_INPUT = ("textinput", "$PokemonSystem.textinput")
KEYBOARD_INPUT = 0
GRID_REFUSAL = "the text entry is on the cursor grid; names are typed only in keyboard mode"
NAME_TICKS = 120
PAUSE = "pause"
BAG = "bag"
BAG_PARTY = "bag_party"
PARTY = "party"
MART_BUY = "mart_buy"
MART_SELL = "mart_sell"
REGION_MAP = "region_map"
MOVE_REMINDER = "move_reminder"
RESTING = frozenset({PAUSE, BAG, BAG_PARTY, PARTY, MART_BUY, MART_SELL, REGION_MAP, MOVE_REMINDER})
RESTING_PAYLOAD = {MART_SELL: BAG}
MART_LISTS = {MART_BUY: "buy list", MART_SELL: "sell list"}
BAG_ROW = "Bolsa"
POKEMON_ROW = "Pokémon"
SAVE_ROW = "Guardar"
USE = "Usar"
GIVE = "Dar"
ITEM_COMMAND = "Objeto"
TAKE = "Guardar"
SWITCH = "Cambiar"
EXP_SHARE = "Repartir Exp."
SAVE_INTO = "Guardar en {}"
VIAL_KEY = "JUMPUP"
VIALS = ("VIAL", "EMPTYVIAL")
FLY_KEY = "JUMPDOWN"
POKERIDER = "POKERIDER"
FOLLOWER_LINE = "No se puede usar cuando hay alguien contigo."
INDOOR_LINE = "No se puede usar aquí."
MAP_KEYS = {(1, 0): "RIGHT", (-1, 0): "LEFT", (0, 1): "DOWN", (0, -1): "UP"}
MAP_PRESSES = 60
MAP_SETTLE_TICKS = 30
EXP_SHARE_ENABLED = ("exp_share_enabled", "$player.expshare_enabled?")
TEACH_CONFIRM = re.compile(r"^¿Quieres enseñarle ")
SWAP_CONFIRM = re.compile(r"^¿Quieres intercambiar los dos objetos\?")
EXP_SHARE_CONFIRM = re.compile(r"^¿Quieres (?:activar|desactivar) el Repartir Experiencia ")
VIAL_CONFIRM = re.compile(r"^¿Quieres curar a tu equipo\?")
SAVE_CONFIRM = re.compile(r"^¿Quieres guardar la partida\?")
BUY_CONFIRM = re.compile(r"^¿Así que quieres ")
SELL_CONFIRM = re.compile(r"^Puedo pagarte ")
BAG_REPLIES = ((TEACH_CONFIRM, YES), (SWAP_CONFIRM, YES))
MART_REPLIES = ((BUY_CONFIRM, YES), (SELL_CONFIRM, YES))
RELEARN_CONFIRM = re.compile(r"^¿Enseñar ")
RELEARN_QUIT = re.compile(r"^¿Prefieres que .+ no aprenda un movimiento nuevo\?")
RELEARN_REPLIES = ((RELEARN_CONFIRM, YES), (RELEARN_QUIT, YES))
POKEMON_USE = 1
LENS = "LENSOFTRUTH"
LENS_TIME = ("lens", "$scene@eye_of_truth_time")
USE_OPTION = 2
GIVE_OPTION = 1
OPEN_PRESSES = 3
SCREEN_TICKS = 60
CLOSE_PRESSES = 6
POCKET_PRESSES = 24
PICKER_PRESSES = 120
PICKER_STEP = 10
PARTY_SLOTS = 6
PAUSE_PARTY_FRAME = "pbPokemonScreen"
STORE_ACTIONS_FRAME = "pbShowUserStoreActions"


@dataclass(frozen=True)
class Nickname:
    name: str


@dataclass(frozen=True)
class Forget:
    slot: int


@dataclass(frozen=True)
class Skip:
    pass


@dataclass(frozen=True)
class Evolve:
    allow: bool


type MenuAnswer = Nickname | Forget | Skip | Evolve
type AnswerKind = Literal["nickname", "move", "evolution"]


@dataclass(frozen=True)
class MenuDecision:
    kind: AnswerKind
    prompt: str | None
    species: str | None = None
    new_species: str | None = None
    move: str | None = None
    moves: list[str] | None = None
    options: list[str] | None = None
    cursor: int | None = None
    can_cancel: bool | None = None
    move_id: str | None = None
    personal_id: int | None = None


@dataclass(frozen=True)
class Stop:
    outcome: Outcome
    reason: str
    decision: MenuDecision | None = None


@dataclass(frozen=True)
class MenuResult:
    outcome: Outcome
    reason: str
    started: int
    tick: int
    context: Context
    transcript: list[Line]
    decision: MenuDecision | None
    unused: list[MenuAnswer]
    frames: list[str]
    changes: StateChanges
    events: list[Event] = field(default_factory=list)


class AnswerError(ValueError):
    pass


def answer_kind(answer: MenuAnswer) -> AnswerKind:
    if isinstance(answer, Nickname):
        return "nickname"
    if isinstance(answer, Evolve):
        return "evolution"
    return "move"


def answer_text(answer: MenuAnswer) -> str:
    if isinstance(answer, Nickname):
        return f"nickname={answer.name}"
    if isinstance(answer, Forget):
        return f"forget={answer.slot}"
    if isinstance(answer, Evolve):
        return f"evolve={'yes' if answer.allow else 'no'}"
    return "skip"


def parse_answer(text: str) -> MenuAnswer:
    name, _, value = text.partition("=")
    if name == "nickname" and "=" in text:
        return Nickname(value)
    if name == "forget" and value.isdigit():
        return Forget(int(value))
    if text == "skip":
        return Skip()
    if name == "evolve" and value in ("yes", "no"):
        return Evolve(value == "yes")
    raise AnswerError(
        f"{text!r} is not an answer: use nickname=NAME, forget=SLOT, skip, evolve=yes or evolve=no"
    )


def in_chain(view: Look) -> bool:
    return view.context.name == SPECIAL and view.context.screen in CHAIN


def chain_open(view: Look) -> bool:
    return in_chain(view) or (view.context.name == POKEDEX_ENTRY and not view.battle)


def battle_learning(view: Look) -> bool:
    return any(frame_key(frame) == BATTLE_LEARN_MOVE for frame in view.frames)


def event_chooser(view: Look) -> bool:
    return (
        view.context.name == MENU
        and view.context.screen == PARTY
        and not any(PAUSE_PARTY_FRAME in frame for frame in view.frames)
    )


def relearning(view: Look) -> bool:
    return any(frame_key(frame) == RELEARNER for frame in view.frames)


def relearner_closed(view: Look) -> bool:
    return view.context.name != TRANSITION and not relearning(view)


def offered_moves(payload: dict[str, Any]) -> list[str]:
    return [str(entry[0]) for entry in payload.get("moves") or [] if entry]


def knows(state: GameState, personal_id: Any, move: str) -> bool:
    return any(
        member.personal_id == personal_id and any(each.move.id == move for each in member.moves)
        for member in state.party
    )


def storing(view: Look) -> bool:
    return event_chooser(view) and any(STORE_ACTIONS_FRAME in frame for frame in view.frames)


def grid_entry(session: Session, view: Look) -> bool:
    if not any(frame.startswith(TEXT_ENTRY) for frame in view.frames):
        return False
    read = session.read(ReadRequest(paths=[TEXT_INPUT], depth=1)).value
    return read.values.get(TEXT_INPUT[0]) not in (None, KEYBOARD_INPUT)


def stopped(ended: Ended) -> Stop:
    return Stop(ended.outcome, ended.reason)


def unanswered(ended: Ended, reply: str) -> Stop:
    if ended.outcome != "decision" or ended.decision is None:
        return stopped(ended)
    asked = ended.decision
    return Stop(
        "stuck",
        f"the game asked {asked.prompt!r} with options {asked.options}, none of them {reply!r}",
    )


@dataclass
class Chain(Steps):
    answers: list[MenuAnswer] = field(default_factory=list)
    names: Names | None = None

    def first(self, kind: AnswerKind) -> MenuAnswer | None:
        return next((answer for answer in self.answers if answer_kind(answer) == kind), None)

    def taker(self, answer: MenuAnswer) -> Callable[[], None]:
        return lambda: self.answers.remove(answer)

    def name_of(self, table: str, id: Any) -> str | None:
        if id is None:
            return None
        if self.names is None:
            self.names = read_names(self.session)
        return getattr(self.names, table).get(str(id), str(id))

    def run(self, view: Look) -> Stop:
        quiet = 0
        while True:
            if view.context.name == POKEDEX_ENTRY:
                progressed = self.close_entry(view)
            elif not in_chain(view):
                if view.context.name == UNKNOWN:
                    if grid_entry(self.session, view):
                        return Stop("refused", GRID_REFUSAL)
                    return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
                if view.context.name != TRANSITION or (view.battle and not battle_learning(view)):
                    back = "the idle overworld" if view.idle else where(view)
                    return Stop("finished", f"the chain closed; back in {back} at tick {view.tick}")
                progressed = self.wait(view)
            else:
                step = self.step(view)
                if isinstance(step, Stop):
                    return step
                progressed = step
            quiet = 0 if progressed else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"{quiet} steps in {where(view)} made no progress")
            view = self.look()

    def step(self, view: Look) -> bool | Stop:
        newest = view.newest
        kind = None if newest is None else newest.get("kind")
        if newest is None or kind is None:
            return self.wait(view)
        if kind == NAMING:
            self.prompted(view, NAMING)
            return self.naming(view, newest)
        if kind == CHOICE:
            self.prompted(view, "learn_confirm")
            return self.learn_confirm(view, newest)
        if kind == MENU_PAYLOAD and newest.get("screen") == FORGET_MOVE:
            self.prompted(view, FORGET_MOVE)
            return self.forget(view, newest)
        if kind == MESSAGE:
            if view.context.screen == EVOLUTION and self.text(newest.get("text")).endswith(
                EVOLUTION_START
            ):
                self.prompted(view, EVOLUTION)
                return self.evolution(view)
            return self.message(view)
        return self.wait(view)

    def prompted(self, view: Look, prompt: str) -> None:
        log.info("%s prompt on tick %d", prompt, view.tick)
        self.note("step", prompt=prompt, screen=view.context.screen)

    def naming(self, view: Look, payload: dict[str, Any]) -> bool | Stop:
        species = self.name_of("species", payload.get("species"))
        prompt = f"nickname for {species}" if species else "name"
        answer = self.first("nickname")
        if not isinstance(answer, Nickname):
            return Stop(
                "decision",
                "the naming screen is open with no nickname answer",
                MenuDecision("nickname", prompt, species=species),
            )
        name = answer.name
        minimum, maximum = payload.get("min") or 0, payload.get("max")
        if payload.get("forced") and (
            not name or (species is not None and name.lower() == species.lower())
        ):
            return Stop("failed", f"the forced-nickname rule refuses {name!r} for {species}")
        if len(name) < minimum or (isinstance(maximum, int) and len(name) > maximum):
            return Stop("failed", f"{name!r} is not {minimum} to {maximum} characters long")
        found = self.entry(view, "")
        if isinstance(found, Stop):
            return found
        self.advance(1, [TickInput(text=name)])
        found = self.entry(self.look(), name)
        if isinstance(found, Stop):
            return found
        self.taker(answer)()
        self.record(AnswerLine(found.tick, prompt, None, name))
        result = self.advance(
            NAME_TICKS, [keys(RETURN), TickInput()], repeat=True, until=["payloads"]
        )
        if result.stopped != "payloads":
            return Stop("stuck", f"RETURN closed nothing within {NAME_TICKS} ticks")
        return True

    def entry(self, view: Look, text: str) -> Look | Stop:
        for _ in range(NAME_TICKS):
            payload = view.payload(NAMING)
            if payload is None:
                return Stop("stuck", f"the naming screen closed at tick {view.tick}")
            shown = payload.get("text")
            if shown == text:
                return view
            if shown is not None and text == "" and shown:
                self.advance(PRESS_TICKS, [keys(BACKSPACE), TickInput()])
            else:
                self.advance(1)
            view = self.look()
        return Stop("stuck", f"the name entry never read {text!r} (it read {shown!r})")

    def learn_confirm(self, view: Look, payload: dict[str, Any]) -> bool | Stop:
        prompt = self.prompt(view, payload) or ""
        answer = self.first("move")
        if answer is None:
            return Stop(
                "decision",
                "a move-learning question is open with no forget or skip answer",
                MenuDecision(
                    "move",
                    prompt,
                    options=[self.text(option) for option in payload.get("options") or []],
                    cursor=payload.get("cursor"),
                ),
            )
        skip = isinstance(answer, Skip)
        if GIVE_UP_CONFIRM.match(prompt):
            reply = YES if skip else NO
        elif LEARN_CONFIRM.match(prompt):
            reply = NO if skip else YES
        else:
            return Stop("stuck", f"the move-learning chain asked {prompt!r}, not a known question")
        taken = self.taker(answer) if skip else lambda: None
        step = self.choice(view, reply, taken)
        return unanswered(step, reply) if isinstance(step, Ended) else step

    def forget(self, view: Look, payload: dict[str, Any]) -> bool | Stop:
        moves = [self.name_of("moves", move) or "" for move in payload.get("moves") or []]
        move = self.name_of("moves", payload.get("move"))
        prompt = f"forget a move to learn {move}"
        answer = self.first("move")
        decision = MenuDecision(
            "move",
            prompt,
            species=self.name_of("species", payload.get("species")),
            move=move,
            moves=moves,
            options=[*moves, move or ""],
            cursor=payload.get("cursor"),
            move_id=payload.get("move"),
            personal_id=payload.get("personal_id"),
        )
        if answer is None:
            return Stop("decision", "the forget-move screen is open with no answer", decision)
        if isinstance(answer, Skip):
            self.record(AnswerLine(view.tick, prompt, decision.options, f"keep all, not {move}"))
            if not self.confirm(view, CANCEL):
                return Stop("stuck", "B on the forget-move screen closed nothing")
            return True
        assert isinstance(answer, Forget)
        if not 0 <= answer.slot < len(moves):
            return Stop(
                "decision",
                f"forget={answer.slot} is not a known move's slot (0 to {len(moves) - 1})",
                decision,
            )
        reached = self.cursor_to(
            view, MENU_PAYLOAD, answer.slot, len(moves) + 1, moves[answer.slot]
        )
        if isinstance(reached, Ended):
            return stopped(reached)
        view, _ = reached
        self.taker(answer)()
        self.record(AnswerLine(view.tick, prompt, decision.options, moves[answer.slot]))
        if not self.confirm(view):
            return Stop("stuck", "C on the move to forget closed nothing")
        return True

    def evolution(self, view: Look) -> bool | Stop:
        scene = view.payload(EVOLUTION) or {}
        if not scene.get("can_cancel"):
            return self.message(view)
        species = self.name_of("species", scene.get("species"))
        new_species = self.name_of("species", scene.get("new_species"))
        prompt = f"{species} evolving into {new_species}"
        answer = self.first("evolution")
        if not isinstance(answer, Evolve):
            return Stop(
                "decision",
                "an evolution that can be cancelled is starting with no evolve answer",
                MenuDecision(
                    "evolution",
                    prompt,
                    species=species,
                    new_species=new_species,
                    can_cancel=True,
                ),
            )
        self.message(view)
        self.taker(answer)()
        self.record(
            AnswerLine(
                self.tick, prompt, ["evolve", "cancel"], "evolve" if answer.allow else "cancel"
            )
        )
        if answer.allow:
            return True
        result = self.advance(
            CANCEL_TICKS, [buttons(CANCEL), TickInput()], repeat=True, until=["payloads"]
        )
        if result.stopped != "payloads":
            return Stop(
                "stuck", f"B during the evolution changed nothing within {CANCEL_TICKS} ticks"
            )
        return True


@dataclass(frozen=True)
class Item:
    id: str
    name: str
    pocket: int
    row: int
    rows: int
    quantity: int
    field_use: int
    machine: bool
    holdable: bool


def find_item(session: Session, state: GameState, id: str) -> Item | None:
    held = item_counts(state)
    for pocket in state.bag:
        for row, (named, _) in enumerate(pocket.items):
            if named.id != id:
                continue
            data = f'GameData::Item.get("{id}")'
            facts = session.read(
                ReadRequest(
                    paths=[
                        ("field_use", f"{data}.field_use"),
                        ("machine", f"{data}.is_machine?"),
                        ("holdable", f"{data}.can_hold?"),
                        ("important", f"{data}.is_important?"),
                    ],
                    depth=1,
                )
            ).value.values
            return Item(
                id=id,
                name=named.name or id,
                pocket=pocket.index,
                row=row,
                rows=len(pocket.items) + 1,
                quantity=held[id][1],
                field_use=facts.get("field_use") or 0,
                machine=bool(facts.get("machine")),
                holdable=bool(facts.get("holdable")) and not facts.get("important"),
            )
    return None


def bag_row(
    steps: Steps, view: Look, context: str, pocket: int, row: int, rows: int, id: str, name: str
) -> Look | Ended:
    found = steps.live(view, MENU_PAYLOAD, "pocket", context)
    presses = 0
    while not isinstance(found, Ended) and found[1].get("pocket") != pocket:
        if presses >= POCKET_PRESSES:
            return Ended(
                "stuck",
                f"the bag never reached pocket {pocket} "
                f"(at {found[1].get('pocket')} after {presses} presses)",
            )
        steps.press("RIGHT" if pocket > found[1]["pocket"] else "LEFT")
        presses += 1
        found = steps.live(steps.look(), MENU_PAYLOAD, "pocket", context)
    if isinstance(found, Ended):
        return found
    reached = steps.cursor_to(found[0], MENU_PAYLOAD, row, rows, name)
    if isinstance(reached, Ended):
        return reached
    view, payload = reached
    if payload.get("item") != id:
        return Ended("stuck", f"row {row} of pocket {pocket} holds {payload.get('item')}")
    return view


def member_name(state: GameState, slot: int) -> str:
    member = state.party[slot]
    return member.nickname or member.species.name or member.species.id


def mail(session: Session, slot: int) -> bool:
    path = ("mail", f"$player.party[{slot}].mail")
    return session.read(ReadRequest(paths=[path], depth=1)).value.values.get("mail") is not None


def held(state: GameState, id: str) -> int:
    return item_counts(state).get(id, (None, 0))[1]


def member_changed(before: GameState, after: GameState, slot: int) -> bool:
    if slot >= len(after.party):
        return True
    return member_fields(before.party[slot]) != member_fields(after.party[slot])


def start_refusal(view: Look, state: GameState, slot: int | None = None) -> str | None:
    if view.battle or not view.idle:
        place = "a battle" if view.battle else where(view)
        return f"the game is in {place}, not the idle overworld"
    if slot is not None and not 0 <= slot < len(state.party):
        return f"party slot {slot} is empty; the party has {len(state.party)} Pokémon"
    return None


@dataclass
class Verb(Chain):
    wanted: int = 1
    refusal: str | None = None
    replies: Sequence[tuple[re.Pattern[str], str]] = BAG_REPLIES

    def resting(self, view: Look) -> bool:
        newest = view.newest
        screen = view.context.screen
        return (
            view.context.name == MENU
            and screen in RESTING
            and newest is not None
            and newest.get("kind") == MENU_PAYLOAD
            and newest.get("screen") == RESTING_PAYLOAD.get(screen, screen)
        )

    def press_into(self, view: Look, button: str, screen: str) -> Look | Stop:
        for _ in range(OPEN_PRESSES):
            self.press(button)
            spent = 0
            while True:
                now = self.look()
                if now.context.name == MENU and now.context.screen == screen:
                    return now
                if now.context.name == UNKNOWN:
                    return Stop("handoff", f"{where(now)} opened at tick {now.tick}")
                if spent >= SCREEN_TICKS:
                    break
                result = self.advance(SCREEN_TICKS - spent, until=["payloads", "signature"])
                spent += result.ticks
        return Stop(
            "stuck", f"{button} pressed {OPEN_PRESSES} times never opened the {screen} screen"
        )

    def open_pause(self, view: Look) -> Look | Stop:
        opened = self.press_into(view, CANCEL, PAUSE)
        if isinstance(opened, Stop):
            return opened
        self.prompted(opened, PAUSE)
        return opened

    def to_row(self, view: Look, label: str) -> Look | Stop:
        pause = view.payload(MENU_PAYLOAD) or {}
        options = [self.text(option) for option in pause.get("options") or []]
        if label not in options:
            return Stop("stuck", f"the pause menu has no {label!r} row: {options}")
        reached = self.cursor_to(view, MENU_PAYLOAD, options.index(label), len(options), label)
        if isinstance(reached, Ended):
            return stopped(reached)
        return reached[0]

    def open_screen(self, view: Look, label: str, screen: str) -> Look | Stop:
        opened = self.open_pause(view)
        if isinstance(opened, Stop):
            return opened
        row = self.to_row(opened, label)
        if isinstance(row, Stop):
            return row
        shown = self.press_into(row, CONFIRM, screen)
        if isinstance(shown, Stop):
            return shown
        self.prompted(shown, screen)
        return shown

    def open_bag(self, view: Look) -> Look | Stop:
        return self.open_screen(view, BAG_ROW, BAG)

    def party_command(self, view: Look, slot: int, member: str, label: str) -> Look | Stop:
        party = self.open_screen(view, POKEMON_ROW, PARTY)
        if isinstance(party, Stop):
            return party
        reached = self.to_member(party, slot, member)
        if isinstance(reached, Stop):
            return reached
        if not self.confirm(reached):
            return Stop("stuck", f"C on {member} in the party opened nothing")
        return self.command(self.look(), label)

    def to_member(self, view: Look, slot: int, member: str) -> Look | Stop:
        reached = self.cursor_to(view, MENU_PAYLOAD, slot, PARTY_SLOTS, member, ("RIGHT", "LEFT"))
        if isinstance(reached, Ended):
            return stopped(reached)
        self.prompted(reached[0], "slot")
        return reached[0]

    def to_item(self, view: Look, item: Item) -> Look | Stop:
        reached = bag_row(self, view, MENU, item.pocket, item.row, item.rows, item.id, item.name)
        if isinstance(reached, Ended):
            return stopped(reached)
        self.prompted(reached, "item")
        if not self.confirm(reached):
            return Stop("stuck", f"C on {item.name} opened nothing")
        return self.look()

    def command(self, view: Look, label: str) -> Look | Stop:
        found = self.live(view, CHOICE, "cursor", MENU)
        if isinstance(found, Ended):
            return stopped(found)
        view, payload = found
        options = [self.text(option) for option in payload.get("options") or []]
        if label not in options:
            return Stop("stuck", f"the item's commands {options} have no {label!r}")
        step = self.choice(view, label, lambda: None)
        if isinstance(step, Ended):
            return stopped(step)
        return self.look()

    def to_slot(self, view: Look, slot: int, option: int, label: str) -> Look | Stop:
        settled = self.settle(view)
        if isinstance(settled, Stop):
            return settled
        panel = settled.payload(MENU_PAYLOAD) or {}
        if settled.context.screen != BAG_PARTY or panel.get("option") != option:
            return Stop("stuck", f"the party panel did not open; the game is in {where(settled)}")
        reached = self.cursor_to(settled, MENU_PAYLOAD, slot, PARTY_SLOTS, label, ("RIGHT", "LEFT"))
        if isinstance(reached, Ended):
            return stopped(reached)
        self.prompted(reached[0], BAG_PARTY)
        return reached[0]

    def settle(self, view: Look, until: Callable[[Look], bool] | None = None) -> Look | Stop:
        quiet = 0
        while not (
            self.resting(view)
            or (view.idle and not view.battle)
            or (until is not None and until(view))
        ):
            newest = view.newest
            kind = None if newest is None else newest.get("kind")
            if in_chain(view):
                step = self.step(view)
            elif view.context.name == POKEDEX_ENTRY:
                step = self.close_entry(view)
            elif view.context.name == UNKNOWN:
                if grid_entry(self.session, view):
                    return Stop("refused", GRID_REFUSAL)
                return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
            elif view.context.name == TRANSITION or newest is None:
                step = self.wait(view)
            elif kind == MESSAGE and newest.get("brief"):
                step = self.brief(view, newest)
            elif kind == MESSAGE:
                step = self.message(view)
            elif kind == CHOICE:
                step = self.confirm_prompt(view, newest)
            elif kind == NUMBER:
                step = self.quantity(view)
            else:
                step = self.wait(view)
            if isinstance(step, Stop):
                return step
            quiet = 0 if step else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"{quiet} steps in {where(view)} made no progress")
            view = self.look()
        return view

    def brief(self, view: Look, payload: dict[str, Any]) -> bool:
        key = (payload.get("tick"), payload.get("text"))
        if key not in self.shown:
            self.shown.add(key)
            raw = str(payload.get("text") or "")
            self.record(MessageLine(view.tick, raw, self.text(raw)))
        return self.wait(view)

    def confirm_prompt(self, view: Look, payload: dict[str, Any]) -> bool | Stop:
        prompt = self.prompt(view, payload) or ""
        reply = next((reply for pattern, reply in self.replies if pattern.match(prompt)), None)
        if reply is None:
            return Stop("stuck", f"the game asked {prompt!r}, not a known question")
        self.prompted(view, "confirm")
        step = self.choice(view, reply, lambda: None)
        return unanswered(step, reply) if isinstance(step, Ended) else step

    def quantity(self, view: Look) -> bool | Stop:
        context = view.context.name
        found = self.live(view, NUMBER, "value", context)
        if isinstance(found, Ended):
            return stopped(found)
        view, payload = found
        self.prompted(view, "quantity")
        maximum = payload.get("max")
        if not isinstance(maximum, int) or self.wanted > maximum:
            self.refusal = f"the game allows at most {maximum} at once here, not {self.wanted}"
            if not self.confirm(view, CANCEL):
                return Stop("stuck", "B on the quantity picker closed nothing")
            return True
        presses = 0
        while payload["value"] != self.wanted:
            if presses >= PICKER_PRESSES:
                return Stop(
                    "stuck", f"the quantity never reached {self.wanted} (at {payload['value']})"
                )
            gap = self.wanted - payload["value"]
            if gap >= PICKER_STEP:
                self.press("RIGHT")
            elif gap <= -PICKER_STEP:
                self.press("LEFT")
            else:
                self.press("UP" if gap > 0 else "DOWN")
            presses += 1
            found = self.live(self.look(), NUMBER, "value", context)
            if isinstance(found, Ended):
                return stopped(found)
            view, payload = found
        self.record(
            AnswerLine(
                view.tick,
                self.prompt(view, payload),
                None,
                str(self.wanted),
                minimum=payload.get("min"),
                maximum=maximum,
            )
        )
        if not self.confirm(view):
            return Stop("stuck", "C on the quantity closed nothing")
        return True

    def close(self, view: Look) -> Stop | None:
        for _ in range(CLOSE_PRESSES * STUCK_STEPS):
            if view.idle and not view.battle:
                return None
            if self.resting(view):
                if not self.confirm(view, CANCEL):
                    return Stop("stuck", f"B in {where(view)} closed nothing")
            elif view.context.name in (TRANSITION, EVENT) or not view.context.payloads:
                self.wait(view)
            else:
                settled = self.settle(view)
                if isinstance(settled, Stop):
                    return settled
            view = self.look()
        return Stop("stuck", f"the menus never closed; the game is in {where(view)}")

    def after_chain(self, view: Look) -> Stop | None:
        if not any(
            payload.get("kind") == MENU_PAYLOAD and payload.get("screen") == PAUSE
            for payload in view.context.payloads
        ):
            return None
        closed = self.close(view)
        if closed is not None:
            return closed
        return Stop(
            "finished",
            f"the chain closed, then the bag and the pause menu; "
            f"back on the idle overworld at tick {self.tick}",
        )

    def last_message(self, since: int) -> str | None:
        return next(
            (
                line.text
                for line in reversed(self.transcript[since:])
                if isinstance(line, MessageLine)
            ),
            None,
        )

    def use(self, view: Look, item: Item, slot: int, count: int, member: str) -> Stop:
        opened = self.open_bag(view)
        if isinstance(opened, Stop):
            return opened
        chosen = self.to_item(opened, item)
        if isinstance(chosen, Stop):
            return chosen
        commanded = self.command(chosen, USE)
        if isinstance(commanded, Stop):
            return commanded
        panel = self.to_slot(commanded, slot, USE_OPTION, member)
        if isinstance(panel, Stop):
            return panel
        remaining = count
        while remaining:
            before = mark(self.session)
            since = len(self.transcript)
            self.wanted, self.refusal = remaining, None
            unanswered = len(self.answers)
            if not self.confirm(panel):
                return Stop("stuck", f"C on {member} in the party panel opened nothing")
            settled = self.settle(self.look())
            if isinstance(settled, Stop):
                return settled
            after = mark(self.session)
            used = held(before.state, item.id) - held(after.state, item.id)
            changed = used > 0 or member_changed(before.state, after.state, slot)
            if self.refusal is not None or not (changed or len(self.answers) < unanswered):
                closed = self.close(settled)
                if closed is not None:
                    return closed
                reason = self.refusal or self.last_message(since) or "nothing changed"
                return Stop("failed", reason)
            remaining = max(remaining - (used or 1), 0)
            if remaining and settled.context.screen != BAG_PARTY:
                return Stop("stuck", f"the party panel closed with {remaining} uses left")
            panel = settled
        closed = self.close(self.look())
        if closed is not None:
            return closed
        return Stop(
            "finished",
            f"used {count} {item.name} on {member}; back on the idle overworld at tick {self.tick}",
        )

    def give(self, view: Look, item: Item, slot: int, member: str) -> Stop:
        opened = self.open_bag(view)
        if isinstance(opened, Stop):
            return opened
        chosen = self.to_item(opened, item)
        if isinstance(chosen, Stop):
            return chosen
        commanded = self.command(chosen, GIVE)
        if isinstance(commanded, Stop):
            return commanded
        panel = self.to_slot(commanded, slot, GIVE_OPTION, member)
        if isinstance(panel, Stop):
            return panel
        before = mark(self.session)
        since = len(self.transcript)
        if not self.confirm(panel):
            return Stop("stuck", f"C on {member} in the party panel opened nothing")
        settled = self.settle(self.look())
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session)
        closed = self.close(settled)
        if closed is not None:
            return closed
        if not member_changed(before.state, after.state, slot):
            return Stop("failed", self.last_message(since) or "nothing changed")
        return Stop(
            "finished",
            f"gave {item.name} to {member}; back on the idle overworld at tick {self.tick}",
        )

    def take(self, view: Look, before: GameState, slot: int, member: str) -> Stop:
        commanded = self.party_command(view, slot, member, ITEM_COMMAND)
        if isinstance(commanded, Stop):
            return commanded
        since = len(self.transcript)
        taken = self.command(commanded, TAKE)
        if isinstance(taken, Stop):
            return taken
        settled = self.settle(taken)
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        closed = self.close(settled)
        if closed is not None:
            return closed
        if not member_changed(before, after, slot):
            return Stop("failed", self.last_message(since) or "nothing changed")
        item = before.party[slot].item
        name = "its item" if item is None else item.name or item.id
        return Stop(
            "finished",
            f"took {name} from {member}; back on the idle overworld at tick {self.tick}",
        )

    def swap(self, view: Look, before: GameState, a: int, b: int) -> Stop:
        first, second = member_name(before, a), member_name(before, b)
        commanded = self.party_command(view, a, first, SWITCH)
        if isinstance(commanded, Stop):
            return commanded
        switching = self.settle(commanded)
        if isinstance(switching, Stop):
            return switching
        party = switching.payload(MENU_PAYLOAD) or {}
        if switching.context.screen != PARTY or not party.get("switching"):
            return Stop(
                "stuck", f"the party did not reopen to switch; the game is in {where(switching)}"
            )
        reached = self.to_member(switching, b, second)
        if isinstance(reached, Stop):
            return reached
        if not self.confirm(reached):
            return Stop("stuck", f"C on {second} while switching swapped nothing")
        settled = self.settle(self.look())
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        closed = self.close(settled)
        if closed is not None:
            return closed
        swapped = (
            len(after.party) == len(before.party)
            and member_fields(after.party[a]) == member_fields(before.party[b])
            and member_fields(after.party[b]) == member_fields(before.party[a])
        )
        if not swapped:
            return Stop("failed", "the party order did not change")
        return Stop(
            "finished",
            f"swapped {first} (slot {a}) and {second} (slot {b}); "
            f"back on the idle overworld at tick {self.tick}",
        )

    def choose(self, view: Look, slot: int | None, member: str | None) -> Stop:
        if slot is None or member is None:
            label = "no Pokémon"
            pressed = self.confirm(view, CANCEL)
        else:
            reached = self.to_member(view, slot, member)
            if isinstance(reached, Stop):
                return reached
            label = f"{member} (slot {slot})"
            pressed = self.confirm(reached)
        if not pressed:
            return Stop("stuck", f"choosing {label} on the party screen closed nothing")
        quiet = 0
        now = self.look()
        while now.context.name == TRANSITION:
            quiet = 0 if self.wait(now) else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"after choosing {label}, {where(now)} made no progress")
            now = self.look()
        if now.context.screen == PARTY:
            shown = now.payload(MESSAGE) or {}
            said = self.text(shown.get("text")) if shown.get("text") else None
            return Stop(
                "failed",
                f"the party screen stayed open after choosing {label}"
                + (f": {said!r}" if said else ""),
            )
        return Stop(
            "finished",
            f"chose {label}; the party screen closed, now in {where(now)} at tick {now.tick}",
        )

    def exp_share(self, view: Look, slot: int, on: bool, member: str) -> Stop:
        commanded = self.party_command(view, slot, member, EXP_SHARE)
        if isinstance(commanded, Stop):
            return commanded
        since = len(self.transcript)
        settled = self.settle(commanded)
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        closed = self.close(settled)
        if closed is not None:
            return closed
        if slot >= len(after.party) or after.party[slot].exp_share != on:
            return Stop("failed", self.last_message(since) or "the exp share did not change")
        return Stop(
            "finished",
            f"exp share {'on' if on else 'off'} for {member}; "
            f"back on the idle overworld at tick {self.tick}",
        )

    def vial(self, view: Look, before: GameState) -> Stop:
        opened = self.open_pause(view)
        if isinstance(opened, Stop):
            return opened
        since = len(self.transcript)
        if not self.confirm(opened, VIAL_KEY):
            return Stop("stuck", f"{VIAL_KEY} in the pause menu opened nothing")
        settled = self.settle(self.look())
        if isinstance(settled, Stop):
            return settled
        after = mark(self.session).state
        closed = self.close(settled)
        if closed is not None:
            return closed
        if after.vial is None:
            return Stop("failed", self.last_message(since) or "the Pokévial healed nothing")
        start = after.vial.max_charges if before.vial is None else before.vial.charges
        if after.vial.charges >= start:
            return Stop("failed", self.last_message(since) or "the Pokévial healed nothing")
        return Stop(
            "finished",
            f"the Pokévial healed the party, {after.vial.charges} charges left; "
            f"back on the idle overworld at tick {self.tick}",
        )

    def fly(self, view: Look, landing: Landing, place: Place) -> Stop:
        opened = self.open_pause(view)
        if isinstance(opened, Stop):
            return opened
        shown = self.press_into(opened, FLY_KEY, REGION_MAP)
        if isinstance(shown, Stop):
            return shown
        self.prompted(shown, REGION_MAP)
        region = (shown.payload(MENU_PAYLOAD) or {}).get("region")
        if region != landing.region:
            closed = self.close(shown)
            return closed or Stop(
                "failed",
                f"the region map shows region {region}, not {landing.name}'s {landing.region}",
            )
        reached = self.map_cursor(shown, landing)
        if isinstance(reached, Stop):
            return reached
        since = len(self.transcript)
        if not self.confirm(reached):
            return Stop("stuck", f"C on {landing.name} in the region map closed nothing")
        settled = self.settle(self.look())
        if isinstance(settled, Stop):
            return settled
        closed = self.close(settled)
        if closed is not None:
            return closed
        position = mark(self.session).state.position
        here = None if position is None else Place(position.map_id, position.x, position.y)
        if here != place:
            where_now = "nowhere" if here is None else f"map {here.map_id} ({here.x}, {here.y})"
            return Stop("failed", self.last_message(since) or f"still on {where_now}")
        return Stop(
            "finished",
            f"flew to {landing.name}; landed on map {place.map_id} at ({place.x}, {place.y}) "
            f"on the idle overworld at tick {self.tick}",
        )

    def lens(self, view: Look, item: Item) -> Stop:
        opened = self.open_bag(view)
        if isinstance(opened, Stop):
            return opened
        chosen = self.to_item(opened, item)
        if isinstance(chosen, Stop):
            return chosen
        since = len(self.transcript)
        commanded = self.command(chosen, USE)
        if isinstance(commanded, Stop):
            return commanded
        settled = self.settle(commanded)
        if isinstance(settled, Stop):
            return settled
        closed = self.close(settled)
        if closed is not None:
            return closed
        frames = lens_time(self.session)
        if frames <= 0:
            return Stop("failed", self.last_message(since) or f"{item.name} did not take effect")
        return Stop(
            "finished",
            f"used {item.name}, {frames} frames left; "
            f"back on the idle overworld at tick {self.tick}",
        )

    def map_cursor(self, view: Look, landing: Landing) -> Look | Stop:
        found = self.live(view, MENU_PAYLOAD, "x", MENU)
        if isinstance(found, Ended):
            return stopped(found)
        view, payload = found
        presses = 0
        while (payload["x"], payload["y"]) != (landing.x, landing.y):
            if presses >= MAP_PRESSES:
                return Stop(
                    "stuck",
                    f"the region map cursor never reached {landing.name} "
                    f"(at ({payload['x']}, {payload['y']}) after {presses} presses)",
                )
            dx, dy = landing.x - payload["x"], landing.y - payload["y"]
            step = (1 if dx > 0 else -1, 0) if dx else (0, 1 if dy > 0 else -1)
            start = (payload["x"], payload["y"])
            self.press(MAP_KEYS[step])
            presses += 1
            spent = 0
            while True:
                found = self.live(self.look(), MENU_PAYLOAD, "x", MENU)
                if isinstance(found, Ended):
                    return stopped(found)
                view, payload = found
                if payload.get("settled") and (payload["x"], payload["y"]) != start:
                    break
                if spent >= MAP_SETTLE_TICKS:
                    break
                self.advance(1)
                spent += 1
        self.prompted(view, "landing")
        return view

    def save(self, view: Look, slot: str) -> Stop:
        opened = self.open_pause(view)
        if isinstance(opened, Stop):
            return opened
        row = self.to_row(opened, SAVE_ROW)
        if isinstance(row, Stop):
            return row
        since = len(self.transcript)
        if not self.confirm(row):
            return Stop("stuck", f"C on {SAVE_ROW!r} opened nothing")
        settled = self.settle(self.look())
        if isinstance(settled, Stop):
            return settled
        if settled.idle:
            return Stop(
                "finished", f"saved into {slot!r}; back on the idle overworld at tick {self.tick}"
            )
        closed = self.close(settled)
        if closed is not None:
            return closed
        return Stop("failed", self.last_message(since) or "the game did not save")

    def leave(self, view: Look) -> Stop | None:
        if not self.resting(view):
            settled = self.settle(view)
            if isinstance(settled, Stop):
                return settled
            view = settled
        if not self.confirm(view, CANCEL):
            return Stop("stuck", f"B in {where(view)} closed nothing")
        quiet = 0
        view = self.look()
        while not (view.idle or view.context.name in (MESSAGE, CHOICE)):
            if view.context.name == UNKNOWN:
                return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
            quiet = 0 if self.wait(view) else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"leaving the mart's list, {where(view)} made no progress")
            view = self.look()
        return None

    def failed(self, view: Look, since: int, fallback: str) -> Stop:
        left = self.leave(view)
        if left is not None:
            return left
        return Stop("failed", self.refusal or self.last_message(since) or fallback)

    def buy(self, view: Look, orders: Sequence[tuple[str, int]]) -> Stop:
        bought = []
        for id, quantity in orders:
            name = self.name_of("items", id) or id
            stock = [str(entry) for entry in (view.payload(MENU_PAYLOAD) or {}).get("stock") or []]
            if id not in stock:
                return self.failed(view, len(self.transcript), f"{name} is no longer in stock")
            reached = self.cursor_to(view, MENU_PAYLOAD, stock.index(id), len(stock) + 1, name)
            if isinstance(reached, Ended):
                return stopped(reached)
            view, payload = reached
            if payload.get("item") != id:
                return Stop(
                    "stuck", f"row {stock.index(id)} of the buy list holds {payload.get('item')}"
                )
            self.prompted(view, "item")
            before = mark(self.session)
            since = len(self.transcript)
            self.wanted, self.refusal = quantity, None
            if not self.confirm(view):
                return Stop("stuck", f"C on {name} in the buy list opened nothing")
            settled = self.settle(self.look())
            if isinstance(settled, Stop):
                return settled
            got = held(mark(self.session).state, id) - held(before.state, id)
            if self.refusal is not None or got < quantity:
                return self.failed(settled, since, f"no {name} was bought")
            if settled.context.screen != MART_BUY:
                return Stop(
                    "stuck", f"the buy list did not reopen; the game is in {where(settled)}"
                )
            bought.append(f"{quantity} {name}")
            view = settled
        left = self.leave(view)
        if left is not None:
            return left
        done = f"bought {', '.join(bought)}" if bought else "left the buy list"
        return Stop("finished", f"{done}; back with the clerk at tick {self.tick}")

    def sell(self, view: Look, orders: Sequence[tuple[str, int]]) -> Stop:
        sold = []
        for id, quantity in orders:
            before = mark(self.session)
            item = find_item(self.session, before.state, id)
            if item is None or item.quantity < quantity:
                count = 0 if item is None else item.quantity
                return self.failed(
                    view, len(self.transcript), f"the bag holds {count} {id}, not {quantity}"
                )
            since = len(self.transcript)
            chosen = self.to_item(view, item)
            if isinstance(chosen, Stop):
                return chosen
            self.wanted, self.refusal = quantity, None
            settled = self.settle(chosen)
            if isinstance(settled, Stop):
                return settled
            gone = held(before.state, id) - held(mark(self.session).state, id)
            if self.refusal is not None or gone < quantity:
                return self.failed(settled, since, f"no {item.name} was sold")
            if settled.context.screen != MART_SELL:
                return Stop(
                    "stuck", f"the sell list did not reopen; the game is in {where(settled)}"
                )
            sold.append(f"{quantity} {item.name}")
            view = settled
        left = self.leave(view)
        if left is not None:
            return left
        done = f"sold {', '.join(sold)}" if sold else "left the sell list"
        return Stop("finished", f"{done}; back with the clerk at tick {self.tick}")

    def relearn(self, view: Look, moves: Sequence[str]) -> Stop:
        taught = []
        for move in moves:
            name = self.name_of("moves", move) or move
            payload = view.payload(MENU_PAYLOAD) or {}
            offered = offered_moves(payload)
            member = self.name_of("species", payload.get("species")) or "the Pokémon"
            if move not in offered:
                return self.relearn_failed(view, f"{name} is no longer on the list")
            reached = self.cursor_to(view, MENU_PAYLOAD, offered.index(move), len(offered), name)
            if isinstance(reached, Ended):
                return stopped(reached)
            view, payload = reached
            if offered_moves(payload)[payload["cursor"]] != move:
                return Stop(
                    "stuck", f"row {payload['cursor']} of the relearner's list is not {name}"
                )
            self.prompted(view, "move")
            since = len(self.transcript)
            if not self.confirm(view):
                return Stop("stuck", f"C on {name} in the relearner's list opened nothing")
            settled = self.settle(self.look(), relearner_closed)
            if isinstance(settled, Stop):
                return settled
            if not knows(mark(self.session).state, payload.get("personal_id"), move):
                reason = self.last_message(since) or f"{member} did not learn {name}"
                return self.relearn_failed(settled, reason)
            taught.append(name)
            view = settled
            if relearner_closed(view):
                break
        left = self.leave_relearner(view)
        if isinstance(left, Stop):
            return left
        done = f"taught {', '.join(taught)}" if taught else "left the relearner"
        return Stop(
            "finished", f"{done}; the relearner closed, now in {where(left)} at tick {left.tick}"
        )

    def relearn_failed(self, view: Look, reason: str) -> Stop:
        left = self.leave_relearner(view)
        if isinstance(left, Stop):
            return left
        return Stop("failed", reason)

    def leave_relearner(self, view: Look) -> Look | Stop:
        if relearner_closed(view):
            return view
        if self.resting(view) and not self.confirm(view, CANCEL):
            return Stop("stuck", "B on the relearner's list closed nothing")
        settled = self.settle(self.look(), relearner_closed)
        if isinstance(settled, Stop):
            return settled
        if not relearner_closed(settled):
            return Stop("stuck", f"the relearner stayed open; the game is in {where(settled)}")
        return settled


def result_fields(result: MenuResult) -> dict[str, Any]:
    return {
        "outcome": result.outcome,
        "reason": result.reason,
        "decision": decision_fields(result.decision),
        "unused": [answer_text(answer) for answer in result.unused],
        "ticks": result.tick - result.started,
        "context": result.context.name,
        "changes": changes_fields(result.changes),
    }


def conclude(
    chain: Chain, first: Look, stop: Stop, before: Mark, *, with_boxes: bool = False
) -> MenuResult:
    last = first if stop.outcome == "refused" else chain.look()
    result = MenuResult(
        outcome=stop.outcome,
        reason=stop.reason,
        started=first.tick,
        tick=last.tick,
        context=last.context,
        transcript=chain.transcript,
        decision=stop.decision,
        unused=chain.answers,
        frames=last.frames,
        changes=state_changes(before, mark(chain.session), with_boxes=with_boxes),
        events=chain.events,
    )
    chain.note("result", **result_fields(result))
    return result


def continue_menu(
    driver: Driver,
    answers: Sequence[MenuAnswer],
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    session = driver.session
    chain = Verb(driver, MENU_KIND, log, report, answers=list(answers))
    note(
        session,
        MENU_KIND,
        "start",
        entry="continue",
        answers=[answer_text(answer) for answer in answers],
    )
    before = mark(session)
    first = chain.look()
    if chain_open(first):
        stop = chain.run(first)
        if stop.outcome == "finished":
            stop = chain.after_chain(chain.look()) or stop
    elif first.context.name == UNKNOWN and grid_entry(session, first):
        stop = Stop("refused", GRID_REFUSAL)
    else:
        place = "the idle overworld" if first.idle else where(first)
        stop = Stop("refused", f"no prompt chain is open; the game is in {place}")
    return conclude(chain, first, stop, before)


def use_item(
    driver: Driver,
    item: str,
    pokemon: int,
    count: int = 1,
    answers: Sequence[MenuAnswer] = (),
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report, answers=list(answers))
    note(
        session,
        MENU_KIND,
        "start",
        entry="use_item",
        item=item,
        pokemon=pokemon,
        count=count,
        answers=[answer_text(answer) for answer in answers],
    )
    before = mark(session)
    first = verb.look()
    found = find_item(session, before.state, item)
    refusal = start_refusal(first, before.state, pokemon)
    if refusal is None:
        if found is None:
            refusal = f"{item} is not in the bag"
        elif count < 1 or count > found.quantity:
            refusal = f"count {count} is not 1 to the {found.quantity} {found.name} held"
        elif not found.machine and found.field_use != POKEMON_USE:
            refusal = f"{found.name} is not used on a Pokémon"
        elif found.machine and count != 1:
            refusal = f"{found.name} teaches one move; count must be 1"
    if refusal is not None or found is None:
        stop = Stop("refused", refusal or f"{item} is not in the bag")
    else:
        stop = verb.use(first, found, pokemon, count, member_name(before.state, pokemon))
    return conclude(verb, first, stop, before)


def give_item(
    driver: Driver,
    item: str,
    pokemon: int,
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="give_item", item=item, pokemon=pokemon, answers=[])
    before = mark(session)
    first = verb.look()
    found = find_item(session, before.state, item)
    refusal = start_refusal(first, before.state, pokemon)
    if refusal is None:
        if found is None:
            refusal = f"{item} is not in the bag"
        elif not found.holdable:
            refusal = f"{found.name} cannot be held"
    if refusal is not None or found is None:
        stop = Stop("refused", refusal or f"{item} is not in the bag")
    else:
        stop = verb.give(first, found, pokemon, member_name(before.state, pokemon))
    return conclude(verb, first, stop, before)


def take_item(
    driver: Driver, pokemon: int, report: Callable[[str], None] = lambda _: None
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="take_item", pokemon=pokemon, answers=[])
    before = mark(session)
    first = verb.look()
    refusal = start_refusal(first, before.state, pokemon)
    if refusal is None and before.state.party[pokemon].item is None:
        refusal = f"{member_name(before.state, pokemon)} holds no item"
    elif refusal is None and mail(session, pokemon):
        refusal = f"{member_name(before.state, pokemon)} holds mail, which has no take command here"
    if refusal is not None:
        stop = Stop("refused", refusal)
    else:
        stop = verb.take(first, before.state, pokemon, member_name(before.state, pokemon))
    return conclude(verb, first, stop, before)


def swap_party(
    driver: Driver, a: int, b: int, report: Callable[[str], None] = lambda _: None
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="swap_party", pokemon=a, other=b, answers=[])
    before = mark(session)
    first = verb.look()
    refusal = start_refusal(first, before.state, a) or start_refusal(first, before.state, b)
    if refusal is None and a == b:
        refusal = f"slots {a} and {b} are the same"
    if refusal is not None:
        stop = Stop("refused", refusal)
    else:
        stop = verb.swap(first, before.state, a, b)
    return conclude(verb, first, stop, before)


def choose_pokemon(
    driver: Driver, slot: int | None, report: Callable[[str], None] = lambda _: None
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="choose_pokemon", pokemon=slot, answers=[])
    before = mark(session)
    first = verb.look()
    party = before.state.party
    if not event_chooser(first):
        place = "the idle overworld" if first.idle else where(first)
        stop = Stop(
            "refused", f"no party screen an event opened is showing; the game is in {place}"
        )
    elif slot is not None and not 0 <= slot < len(party):
        stop = Stop("refused", f"slot {slot} is empty; the party has {len(party)}")
    else:
        member = None if slot is None else member_name(before.state, slot)
        stop = verb.choose(first, slot, member)
    return conclude(verb, first, stop, before, with_boxes=True)


def set_exp_share(
    driver: Driver, pokemon: int, on: bool, report: Callable[[str], None] = lambda _: None
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report, replies=((EXP_SHARE_CONFIRM, YES),))
    note(session, MENU_KIND, "start", entry="set_exp_share", pokemon=pokemon, on=on, answers=[])
    before = mark(session)
    first = verb.look()
    refusal = start_refusal(first, before.state, pokemon)
    if refusal is None:
        enabled = session.read(ReadRequest(paths=[EXP_SHARE_ENABLED], depth=1)).value.values
        if not enabled.get(EXP_SHARE_ENABLED[0]):
            refusal = "the exp share is not enabled in this game"
    if refusal is not None:
        stop = Stop("refused", refusal)
    elif before.state.party[pokemon].exp_share == on:
        member = member_name(before.state, pokemon)
        stop = Stop("finished", f"exp share already {'on' if on else 'off'} for {member}")
    else:
        stop = verb.exp_share(first, pokemon, on, member_name(before.state, pokemon))
    return conclude(verb, first, stop, before)


def use_vial(driver: Driver, report: Callable[[str], None] = lambda _: None) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report, replies=((VIAL_CONFIRM, YES),))
    note(session, MENU_KIND, "start", entry="use_vial", answers=[])
    before = mark(session)
    first = verb.look()
    refusal = start_refusal(first, before.state)
    if refusal is None and not any(held(before.state, id) for id in VIALS):
        refusal = "the bag holds no Pokévial"
    if refusal is not None:
        stop = Stop("refused", refusal)
    else:
        stop = verb.vial(first, before.state)
    return conclude(verb, first, stop, before)


def lens_time(session: Session) -> int:
    frames = session.read(ReadRequest(paths=[LENS_TIME], depth=1)).value.values.get("lens")
    return frames if isinstance(frames, int) else 0


def use_lens(driver: Driver, report: Callable[[str], None] = lambda _: None) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="use_lens", answers=[])
    before = mark(session)
    first = verb.look()
    found = find_item(session, before.state, LENS)
    refusal = start_refusal(first, before.state)
    if refusal is None and found is None:
        refusal = "the bag holds no Lente de la Verdad"
    if refusal is None and lens_time(session) > 0:
        refusal = "the Lente de la Verdad is already in use"
    if refusal is not None or found is None:
        stop = Stop("refused", refusal or "the bag holds no Lente de la Verdad")
    else:
        stop = verb.lens(first, found)
    return conclude(verb, first, stop, before)


def save(driver: Driver, report: Callable[[str], None] = lambda _: None) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="save", answers=[])
    before = mark(session)
    first = verb.look()
    trainer = before.state.trainer
    slot = None if trainer is None else trainer.save_slot
    refusal = start_refusal(first, before.state)
    if refusal is not None or slot is None:
        stop = Stop("refused", refusal or "the game has no save slot yet")
    else:
        verb.replies = ((SAVE_CONFIRM, SAVE_INTO.format(slot)),)
        stop = verb.save(first, slot)
    return conclude(verb, first, stop, before)


def town_key(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold().strip()


def find_landing(connection: sqlite3.Connection, town: str) -> Landing | str:
    found = landings(connection)
    wanted = town_key(town)
    matched = [landing for landing in found if town_key(landing.name) == wanted]
    if town.isdigit():
        matched = matched or [landing for landing in found if landing.place.map_id == int(town)]
    if len(matched) == 1:
        return matched[0]
    names = ", ".join(landing.name for landing in found)
    if matched:
        return f"{town!r} names {len(matched)} landing points: {names}"
    return f"{town!r} is no landing point on the region map; they are: {names}"


FLY_READS = (
    ("follower_allows", "$game_player.can_map_transfer_with_follower?"),
    ("outdoor", "$game_map.metadata.outdoor_map"),
    ("visited", "$PokemonGlobal.visitedMaps"),
)


def landing_place(session: Session, landing: Landing) -> Place:
    redirect = MAP_REDIRECTS.get(landing.place.map_id)
    if redirect is None:
        return landing.place
    path = ("redirect", f"$game_switches[{redirect[1]}]")
    on = session.read(ReadRequest(paths=[path], depth=1)).value.values.get("redirect") is True
    return landing_target(landing, lambda _: on)


def fly_refusal(session: Session, state: GameState, landing: Landing) -> str | None:
    if not held(state, POKERIDER):
        return "the bag holds no PokéRider"
    paths = list(FLY_READS)
    if landing.switch is not None:
        paths.append(("shown", f"$game_switches[{landing.switch}]"))
    values = session.read(ReadRequest(paths=paths, depth=1)).value.values
    if values.get("follower_allows") is not True:
        return FOLLOWER_LINE
    if values.get("outdoor") is not True:
        return INDOOR_LINE
    visited = values.get("visited") or []
    map_id = landing.place.map_id
    if not (map_id < len(visited) and visited[map_id] is True):
        return (
            f"{landing.name} (map {map_id}) is not visited; the region map offers no landing there"
        )
    if landing.switch is not None and values.get("shown") is not True:
        return f"{landing.name}'s landing is hidden until switch {landing.switch} is on"
    return None


def fly(
    driver: Driver,
    connection: sqlite3.Connection,
    town: str,
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report)
    note(session, MENU_KIND, "start", entry="fly", town=town, answers=[])
    before = mark(session)
    first = verb.look()
    landing = find_landing(connection, town)
    refusal = landing if isinstance(landing, str) else start_refusal(first, before.state)
    if refusal is None and isinstance(landing, Landing):
        refusal = fly_refusal(session, before.state, landing)
    if refusal is not None or not isinstance(landing, Landing):
        stop = Stop("refused", refusal or "no landing point")
    else:
        stop = verb.fly(first, landing, landing_place(session, landing))
    return conclude(verb, first, stop, before)


def important(session: Session, id: str) -> bool:
    path = ("important", f'GameData::Item.get("{id}").is_important?')
    return bool(session.read(ReadRequest(paths=[path], depth=1)).value.values.get("important"))


def mart_list(verb: Verb, first: Look, screen: str) -> Look | str:
    view = first
    quiet = 0
    while view.context.name == TRANSITION and quiet < STUCK_STEPS:
        quiet = 0 if verb.wait(view) else quiet + 1
        view = verb.look()
    if view.battle or not verb.resting(view) or view.context.screen != screen:
        place = "a battle" if view.battle else where(view)
        return f"the mart's {MART_LISTS[screen]} is not open; the game is in {place}"
    return view


def order_refusal(orders: Sequence[tuple[str, int]]) -> str | None:
    return next(
        (
            f"{id} ×{quantity}: the quantity must be at least 1"
            for id, quantity in orders
            if quantity < 1
        ),
        None,
    )


def mart_start(verb: Verb, entry: str, orders: Sequence[tuple[str, int]]) -> tuple[Mark, Look]:
    note(
        verb.session,
        MENU_KIND,
        "start",
        entry=entry,
        items=[[id, quantity] for id, quantity in orders],
        answers=[],
    )
    return mark(verb.session), verb.look()


def buy(
    driver: Driver,
    orders: Sequence[tuple[str, int]],
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    verb = Verb(driver, MENU_KIND, log, report, replies=MART_REPLIES)
    before, first = mart_start(verb, "buy", orders)
    shown = mart_list(verb, first, MART_BUY)
    refusal = shown if isinstance(shown, str) else order_refusal(orders)
    if refusal is None and isinstance(shown, Look):
        stock = [str(entry) for entry in (shown.payload(MENU_PAYLOAD) or {}).get("stock") or []]
        for id, quantity in orders:
            if id not in stock:
                refusal = f"{id} is not in the mart's stock {stock}"
            elif quantity != 1 and important(verb.session, id):
                refusal = f"{id} is a key item; only 1 can be bought"
            if refusal is not None:
                break
    if refusal is not None or not isinstance(shown, Look):
        stop = Stop("refused", refusal or "the buy list is not open")
    else:
        stop = verb.buy(shown, orders)
    return conclude(verb, first, stop, before)


def sell(
    driver: Driver,
    orders: Sequence[tuple[str, int]],
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    verb = Verb(driver, MENU_KIND, log, report, replies=MART_REPLIES)
    before, first = mart_start(verb, "sell", orders)
    shown = mart_list(verb, first, MART_SELL)
    refusal = shown if isinstance(shown, str) else order_refusal(orders)
    if refusal is None:
        wanted: dict[str, int] = {}
        for id, quantity in orders:
            wanted[id] = wanted.get(id, 0) + quantity
        for id, quantity in wanted.items():
            count = held(before.state, id)
            if count < quantity:
                refusal = f"the bag holds {count} {id}, not {quantity}"
                break
    if refusal is not None or not isinstance(shown, Look):
        stop = Stop("refused", refusal or "the sell list is not open")
    else:
        stop = verb.sell(shown, orders)
    return conclude(verb, first, stop, before)


def relearner_list(verb: Verb, first: Look) -> Look | str:
    view = first
    quiet = 0
    while view.context.name == TRANSITION and quiet < STUCK_STEPS:
        quiet = 0 if verb.wait(view) else quiet + 1
        view = verb.look()
    if view.battle or not verb.resting(view) or view.context.screen != MOVE_REMINDER:
        place = "a battle" if view.battle else where(view)
        return f"the move relearner's list is not open; the game is in {place}"
    return view


def relearn(
    driver: Driver,
    moves: Sequence[str],
    answers: Sequence[MenuAnswer] = (),
    report: Callable[[str], None] = lambda _: None,
) -> MenuResult:
    session = driver.session
    verb = Verb(driver, MENU_KIND, log, report, answers=list(answers), replies=RELEARN_REPLIES)
    note(
        session,
        MENU_KIND,
        "start",
        entry="relearn",
        moves=list(moves),
        answers=[answer_text(answer) for answer in answers],
    )
    before = mark(session)
    first = verb.look()
    shown = relearner_list(verb, first)
    refusal = shown if isinstance(shown, str) else None
    if refusal is None and isinstance(shown, Look):
        offered = offered_moves(shown.payload(MENU_PAYLOAD) or {})
        if len(set(moves)) != len(moves):
            refusal = f"a move is named twice in {list(moves)}"
        for move in moves:
            if refusal is None and move not in offered:
                refusal = f"{move} is not on the relearner's list {offered}"
    if refusal is not None or not isinstance(shown, Look):
        stop = Stop("refused", refusal or "the move relearner's list is not open")
    else:
        stop = verb.relearn(shown, moves)
    return conclude(verb, first, stop, before)
