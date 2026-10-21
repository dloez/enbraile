import logging
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from anil.bridge.protocol import Event, ReadRequest
from anil.harness.changes import Changed, Mark, StateChanges, changes_fields, mark, state_changes
from anil.harness.context import MENU, POKEDEX_ENTRY, UNKNOWN, Context
from anil.harness.drive import Driver
from anil.harness.menu import bag_row, in_chain
from anil.harness.state import LAST_BATTLE, Battle, Battler, Named, StateError, read_battle
from anil.harness.steps import (
    CANCEL,
    CHOICE,
    MESSAGE,
    NUMBER,
    STUCK_STEPS,
    TRANSITION,
    WINDOW_TICKS,
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

log = logging.getLogger("harness.battle")

BATTLE_KIND = "battle"
BATTLE_COMMAND = "battle_command"
BATTLE_FIGHT = "battle_fight"
BATTLE_TARGET = "battle_target"
BATTLE_BAG = "battle_bag"
BATTLE_SWITCH = "battle_switch"
BACKABLE = frozenset({BATTLE_FIGHT, BATTLE_TARGET, BATTLE_BAG})
BAG_SCREENS = frozenset({"bag_party", "bag_commands"})
BAG_MESSAGES = frozenset({"party_message", "bag_message"})
BAG_PARTY = "bag_party"
FIGHT_COMMAND = 0
BAG_COMMAND = 1
POKEMON_COMMAND = 2
RUN_COMMAND = 3
RUN_TEXT = "Huir"
POKEMON_TEXT = "Pokémon"
BAG_TEXT = "Mochila"
USE_TEXT = "Usar"
ON_POKEMON = (1, 2)
ON_MOVE = 2
ON_BATTLER = 3
ON_FOE = 4
NO_TARGET = 5
SWITCH_TEXT = "Cambiar"
YES = "Sí"
NO = "No"
NEXT_POKEMON = "¿Quieres sacar a otro Pokémon?"
ADD_TO_PARTY = "Agregar al equipo"
SEND_TO_BOX = "Enviar a una caja"
SEND_TO_PC = "Enviar al PC"
BAG_QUESTION = "¿Quieres guardar el objeto en la mochila?"
STORE = "store"
CHOOSE_TO_BOX = 1
PARTY_PAYLOAD = "menu"
PARTY_COMMANDS = "party_commands"
PARTY_ROWS = 6
OPEN_TICKS = 120
STRUGGLE = "STRUGGLE"
SINGLES = [1, 1]
GRID_PRESSES = 6
TARGET_PRESSES = 6
ONE_TARGET = 1
NOT_FIRST = 1
BACK_PRESSES = 3
BATTLE_ID = ("battle_id", "AnilBridge.battle.object_id")
LAST_ID = ("last_id", f"{LAST_BATTLE}.object_id")
TURN = ("turn", "AnilBridge.battle@turnCount")
ENCORE = ("encore", "PBEffects::Encore")
OUTCOMES: dict[int, "BattleOutcome"] = {1: "won", 2: "lost", 3: "fled", 4: "caught", 5: "draw"}

type BattleOutcome = Literal["won", "lost", "fled", "caught", "draw"]


@dataclass(frozen=True)
class BattleMove:
    id: str
    name: str | None
    pp: int
    total_pp: int


@dataclass(frozen=True)
class BattleDecision:
    kind: Literal["command", "replace", "next_pokemon", "full_party"]
    battler: int
    turn: int
    prompt: str | None
    commands: list[str]
    moves: list[BattleMove]
    slots: list[int] = field(default_factory=list)
    caught: str | None = None
    caught_item: str | None = None
    held: dict[int, str] = field(default_factory=dict)


@dataclass(frozen=True)
class BattlerChange:
    index: int
    change: Literal["added", "removed", "changed"]
    species: str | None
    fields: dict[str, Changed[Any]] = field(default_factory=dict)


@dataclass(frozen=True)
class BattleChanges:
    turn: Changed[int] | None = None
    weather: Changed[str] | None = None
    terrain: Changed[str] | None = None
    battlers: list[BattlerChange] = field(default_factory=list)
    ended: bool = False

    @property
    def empty(self) -> bool:
        return not any((self.turn, self.weather, self.terrain, self.battlers, self.ended))


@dataclass(frozen=True)
class Stop:
    outcome: Outcome
    reason: str
    decision: BattleDecision | None = None


@dataclass(frozen=True)
class BattleResult:
    outcome: Outcome
    reason: str
    started: int
    tick: int
    context: Context
    transcript: list[Line]
    decision: BattleDecision | None
    frames: list[str]
    changes: StateChanges
    battle_changes: BattleChanges
    battle_outcome: BattleOutcome | None
    events: list[Event] = field(default_factory=list)
    battle_before: Battle | None = None
    battle_after: Battle | None = None


@dataclass(frozen=True)
class Acted:
    battler: int
    turn: int
    lines: int


def label(named: Named) -> str:
    return named.name or named.id


def battler_fields(battler: Battler) -> dict[str, Any]:
    return {
        "species": label(battler.species),
        "pokemon": battler.pokemon_index,
        "hp": battler.hp,
        "status": label(battler.status),
        "fainted": battler.fainted,
        "stages": {stat: stage for stat, stage in battler.stages.items() if stage},
    }


def battle_changes(before: Battle | None, after: Battle | None, ended: bool) -> BattleChanges:
    if before is None or after is None:
        return BattleChanges(ended=ended)
    old = {battler.index: battler for battler in before.battlers}
    new = {battler.index: battler for battler in after.battlers}
    battlers = []
    for index in sorted(old.keys() | new.keys()):
        was, now = old.get(index), new.get(index)
        if was is None and now is not None:
            battlers.append(BattlerChange(index, "added", label(now.species)))
        elif now is None and was is not None:
            battlers.append(BattlerChange(index, "removed", label(was.species)))
        elif was is not None and now is not None:
            fields_was, fields_now = battler_fields(was), battler_fields(now)
            differ = {
                key: Changed(fields_was[key], fields_now[key])
                for key in fields_was
                if fields_was[key] != fields_now[key]
            }
            if differ:
                battlers.append(BattlerChange(index, "changed", label(now.species), differ))
    return BattleChanges(
        turn=Changed(before.turn, after.turn) if before.turn != after.turn else None,
        weather=Changed(before.weather, after.weather) if before.weather != after.weather else None,
        terrain=Changed(before.terrain, after.terrain) if before.terrain != after.terrain else None,
        battlers=battlers,
        ended=ended,
    )


def battle_changes_fields(changes: BattleChanges) -> dict[str, Any]:
    return {key: value for key, value in asdict(changes).items() if value}


def stopped(ended: Ended) -> Stop:
    return Stop(ended.outcome, ended.reason)


@dataclass
class Fight(Steps):
    acted: Acted | None = None
    picked: int | None = None
    bag: str | None = None

    def value(self, path: tuple[str, str]) -> Any:
        read = self.session.read(ReadRequest(paths=[path], depth=1)).value
        if read.errors:
            raise StateError(f"reading {path[1]} failed: {read.errors}")
        return read.values.get(path[0])

    def battle(self) -> Battle:
        found = read_battle(self.session).value
        if found is None:
            raise StateError("the battle closed while the call read it")
        return found

    def run(self, view: Look) -> Stop:
        quiet = 0
        while True:
            name = view.context.name
            if name not in (BATTLE_SWITCH, MENU):
                self.picked = None
            if name == UNKNOWN:
                return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
            if not view.battle:
                if name != TRANSITION:
                    back = "the idle overworld" if view.idle else where(view)
                    return Stop("finished", f"back in {back} at tick {view.tick}")
                progressed = self.wait(view)
            elif name == BATTLE_COMMAND:
                return self.at_command(view)
            elif self.full_prompt(view):
                return Stop(
                    "decision",
                    f"the party is full and the game asks where the catch goes at tick {view.tick}",
                    self.full_decision(view),
                )
            elif self.bag_prompt(view) and self.bag is not None:
                step = self.choice(view, self.bag, lambda: None)
                if isinstance(step, Ended):
                    return stopped(step)
                self.bag = None
                progressed = True
            elif name == BATTLE_SWITCH and self.picked is not None:
                return self.switch_refused(view)
            elif name == BATTLE_SWITCH and not cancellable(view):
                return Stop(
                    "decision",
                    f"the party screen is open to send a Pokémon in at tick {view.tick}",
                    self.replace_decision(view),
                )
            elif self.backable(view):
                if self.acted is not None:
                    return self.refused_by_game(view)
                step = self.back_out(view)
                if isinstance(step, Stop):
                    return step
                progressed = True
            elif in_chain(view):
                return Stop("handoff", f"a prompt chain opened: {where(view)} at tick {view.tick}")
            elif name == MENU and view.context.screen in BAG_MESSAGES:
                progressed = self.message(view)
            elif name == POKEDEX_ENTRY:
                progressed = self.close_entry(view)
            elif self.next_prompt(view):
                return Stop(
                    "decision",
                    f"the game asks whether to send in another Pokémon at tick {view.tick}",
                    self.next_decision(view),
                )
            elif name in (CHOICE, NUMBER):
                return Stop("handoff", f"{where(view)} opened at tick {view.tick}")
            elif name == MESSAGE:
                progressed = self.message(view)
            else:
                progressed = self.wait(view)
            quiet = 0 if progressed else quiet + 1
            if quiet >= STUCK_STEPS:
                return Stop("stuck", f"{quiet} steps in {where(view)} made no progress")
            view = self.look()

    def at_command(self, view: Look) -> Stop:
        payload = view.payload(BATTLE_COMMAND) or {}
        battler = payload.get("battler")
        turn = self.value(TURN)
        decision = self.decision(payload, turn)
        acted = self.acted
        if acted is not None and acted.battler == battler and acted.turn == turn:
            shown = [
                line for line in self.transcript[acted.lines :] if isinstance(line, MessageLine)
            ]
            reason = shown[-1].text if shown else "the game went back to the command menu"
            return Stop("failed", reason, decision)
        return Stop(
            "decision",
            f"the command menu for battler {battler} is open on turn {turn} at tick {view.tick}",
            decision,
        )

    def backable(self, view: Look) -> bool:
        name = view.context.name
        return (
            name in BACKABLE
            or (name == BATTLE_SWITCH and cancellable(view))
            or (name == MENU and view.context.screen == PARTY_COMMANDS)
            or (name == MENU and view.context.screen in BAG_SCREENS)
        )

    def slots(self, index: int) -> list[int]:
        found = self.value(("slots", f"AnilBridge.switchable({index})"))
        return [slot for slot in found or [] if isinstance(slot, int)]

    def replace_decision(self, view: Look) -> BattleDecision:
        payload = view.payload(BATTLE_SWITCH) or {}
        index = payload.get("battler")
        battler = index if isinstance(index, int) else -1
        return BattleDecision(
            "replace",
            battler=battler,
            turn=self.value(TURN),
            prompt=None,
            commands=[],
            moves=[],
            slots=self.slots(battler),
        )

    def next_prompt(self, view: Look) -> bool:
        if not view.battle or view.context.name != CHOICE:
            return False
        payload = view.payload(CHOICE) or {}
        return self.text(payload.get("text")) == NEXT_POKEMON

    def full_prompt(self, view: Look) -> bool:
        if not view.battle or view.context.name != CHOICE or view.payload(STORE) is None:
            return False
        payload = view.payload(CHOICE) or {}
        options = [self.text(option) for option in payload.get("options") or []]
        return ADD_TO_PARTY in options

    def bag_prompt(self, view: Look) -> bool:
        if not view.battle or view.context.name != CHOICE or view.payload(STORE) is None:
            return False
        prompt = self.prompt(view, view.payload(CHOICE) or {})
        return prompt is not None and prompt.endswith(BAG_QUESTION)

    def held(self) -> dict[int, str]:
        path = ("items", "AnilBridge.party_items")
        found = self.session.read(ReadRequest(paths=[path], depth=2)).value.values.get("items")
        return {slot: str(item) for slot, item in enumerate(found or []) if item is not None}

    def full_decision(self, view: Look) -> BattleDecision:
        payload = view.payload(CHOICE) or {}
        store = view.payload(STORE) or {}
        held = self.held()
        party = self.value(("party", "$player.party.length"))
        item = store.get("item")
        return BattleDecision(
            "full_party",
            battler=0,
            turn=self.value(TURN),
            prompt=self.text(payload.get("text")),
            commands=[self.text(option) for option in payload.get("options") or []],
            moves=[],
            slots=list(range(party)) if isinstance(party, int) else [],
            caught=self.text(store.get("name")) or str(store.get("species")),
            caught_item=None if item is None else str(item),
            held=held,
        )

    def fainted(self) -> int:
        found = self.value(("next", "AnilBridge.next_battler"))
        return found if isinstance(found, int) else 0

    def next_decision(self, view: Look) -> BattleDecision:
        payload = view.payload(CHOICE) or {}
        index = self.fainted()
        return BattleDecision(
            "next_pokemon",
            battler=index,
            turn=self.value(TURN),
            prompt=self.text(payload.get("text")),
            commands=[self.text(option) for option in payload.get("options") or []],
            moves=[],
            slots=self.slots(index),
        )

    def switch_refused(self, view: Look) -> Stop:
        start = self.picked or 0
        self.picked = None
        if cancellable(view):
            return self.refused_by_game(view)
        shown = [line for line in self.transcript[start:] if isinstance(line, MessageLine)]
        reason = shown[-1].text if shown else "the game kept the party screen open"
        return Stop("failed", reason, self.replace_decision(view))

    def refusal(self, call: str) -> str | None:
        reason = self.value(("refusal", call))
        if reason is None:
            return None
        self.session.eval(f"AnilBridge.reveal_refusal({call})")
        return self.text(reason) or f"the game refuses {call}"

    def pick(self, view: Look, index: int, slot: int, command: str = SWITCH_TEXT) -> Look | Stop:
        opened = self.reach(view, BATTLE_SWITCH, OPEN_TICKS)
        if isinstance(opened, Stop):
            return opened
        row = self.value(("row", f"AnilBridge.switch_row({index}, {slot})"))
        name = self.value(("name", f"AnilBridge.battle.pbParty({index})[{slot}].name"))
        member = self.text(name) or f"slot {slot}"
        if not isinstance(row, int):
            return Stop("stuck", f"party slot {slot} has no row on the party screen")
        reached = self.cursor_to(opened, PARTY_PAYLOAD, row, PARTY_ROWS, member, ("RIGHT", "LEFT"))
        if isinstance(reached, Ended):
            return stopped(reached)
        view = reached[0]
        log.info("pokemon %r on tick %d", member, view.tick)
        self.note("step", prompt="pokemon", screen=BATTLE_SWITCH, answer=member)
        self.record(AnswerLine(view.tick, "pokemon", None, member))
        if not self.confirm(view):
            return Stop("stuck", f"C on {member} in the party screen opened nothing")
        step = self.choice(self.look(), command, lambda: None)
        if isinstance(step, Ended):
            return stopped(step)
        return self.look()

    def decision(self, payload: dict[str, Any], turn: int) -> BattleDecision:
        texts = [self.text(text) for text in payload.get("texts") or []]
        index = payload.get("battler")
        battle = self.battle()
        battler = next((entry for entry in battle.battlers if entry.index == index), None)
        moves = (
            [
                BattleMove(move.move.id, move.move.name, move.pp, move.total_pp)
                for move in battler.moves
            ]
            if battler is not None
            else []
        )
        return BattleDecision(
            "command",
            battler=index if isinstance(index, int) else -1,
            turn=turn,
            prompt=texts[0] if texts else None,
            commands=texts[1:],
            moves=moves,
        )

    def refused_by_game(self, view: Look) -> Stop:
        start = 0 if self.acted is None else self.acted.lines
        shown = [line for line in self.transcript[start:] if isinstance(line, MessageLine)]
        reason = shown[-1].text if shown else f"the game kept {where(view)} open"
        back = self.back_out(view)
        if isinstance(back, Stop):
            return back
        payload = back.payload(BATTLE_COMMAND) or {}
        return Stop("failed", reason, self.decision(payload, self.value(TURN)))

    def back_out(self, view: Look) -> Look | Stop:
        for _ in range(BACK_PRESSES):
            if view.context.name == BATTLE_COMMAND or self.full_prompt(view):
                return view
            self.note("step", prompt="back", screen=view.context.name)
            if not self.confirm(view, CANCEL):
                return Stop("stuck", f"B on {where(view)} closed nothing")
            view = self.look()
            while view.context.name in (MESSAGE, TRANSITION):
                progressed = self.message(view) if view.context.name == MESSAGE else self.wait(view)
                if not progressed:
                    break
                view = self.look()
        if view.context.name == BATTLE_COMMAND or self.full_prompt(view):
            return view
        return Stop("stuck", f"B pressed {BACK_PRESSES} times never reached the command menu")

    def reach(self, view: Look, context: str, ticks: int = WINDOW_TICKS) -> Look | Stop:
        for _ in range(ticks):
            if view.context.name == context:
                return view
            self.advance(1)
            view = self.look()
        return Stop("stuck", f"{context} never opened within {ticks} ticks")

    def grid_to(self, view: Look, kind: str, target: int, label: str, count: int) -> Look | Stop:
        for _ in range(GRID_PRESSES):
            found = self.live(view, kind, "cursor", view.context.name)
            if isinstance(found, Ended):
                return stopped(found)
            view, payload = found
            cursor = payload["cursor"]
            if cursor == target:
                return view
            across = (cursor & 2) | (target & 1)
            if (cursor ^ target) & 1 and across < count:
                self.press("RIGHT" if target & 1 else "LEFT")
            else:
                self.press("DOWN" if target & 2 else "UP")
            view = self.look()
        return Stop("stuck", f"the cursor never reached {label!r} in {GRID_PRESSES} presses")

    def to_target(self, view: Look) -> Look | Stop:
        for _ in range(WINDOW_TICKS):
            if view.context.name == BATTLE_TARGET:
                return view
            if view.context.name == MESSAGE:
                self.message(view)
            else:
                self.advance(1)
            view = self.look()
        return Stop("stuck", f"the target screen never opened; the game is in {where(view)}")

    def aim(self, view: Look, aim: "Aim") -> Look | Stop:
        if aim.name is None:
            self.note("step", prompt="target", screen=BATTLE_TARGET, answer=None)
            if not self.confirm(view):
                return Stop("stuck", "C on the target screen closed nothing")
            return self.look()
        target, name = aim.index, aim.name
        for _ in range(TARGET_PRESSES):
            found = self.live(view, BATTLE_TARGET, "cursor")
            if isinstance(found, Ended):
                return stopped(found)
            view, payload = found
            cursor = payload["cursor"]
            if cursor == target:
                break
            if (cursor ^ target) & 1:
                self.press("DOWN" if cursor & 1 else "UP")
            else:
                self.press("RIGHT" if (target > cursor) == (cursor % 2 == 0) else "LEFT")
            view = self.look()
        else:
            return Stop(
                "stuck", f"the target cursor never reached {name!r} in {TARGET_PRESSES} presses"
            )
        log.info("target %r on tick %d", name, view.tick)
        self.note("step", prompt="target", screen=BATTLE_TARGET, answer=target)
        self.record(AnswerLine(view.tick, "target", None, name))
        if not self.confirm(view):
            return Stop("stuck", f"C on target {name!r} closed nothing")
        return self.look()

    def choose(
        self, view: Look, kind: str, target: int, prompt: str, options: list[str]
    ) -> Look | Stop:
        reached = self.grid_to(view, kind, target, options[target], len(options))
        if isinstance(reached, Stop):
            return reached
        log.info("%s %r on tick %d", prompt, options[target], reached.tick)
        self.note("step", prompt=prompt, screen=kind, answer=options[target])
        self.record(AnswerLine(reached.tick, prompt, options, options[target]))
        if not self.confirm(reached):
            return Stop("stuck", f"C on {options[target]!r} closed nothing")
        return self.look()


def cancellable(view: Look) -> bool:
    return bool((view.payload(BATTLE_SWITCH) or {}).get("can_cancel"))


def result_fields(result: BattleResult) -> dict[str, Any]:
    return {
        "outcome": result.outcome,
        "reason": result.reason,
        "decision": decision_fields(result.decision),
        "ticks": result.tick - result.started,
        "context": result.context.name,
        "battle_outcome": result.battle_outcome,
        "battle_changes": battle_changes_fields(result.battle_changes),
        "changes": changes_fields(result.changes),
        "wild_foes": wild_foes(result.battle_before or result.battle_after),
    }


def wild_foes(battle: Battle | None) -> list[dict[str, Any]] | None:
    if battle is None or not battle.wild:
        return None
    return [
        {"species": battler.species.id, "shiny": battler.shiny}
        for battler in battle.battlers
        if battler.side == "opponent" and battler.pokemon_index >= 0
    ]


def conclude(fight: Fight, first: Look, stop: Stop, before: Mark, start_id: Any) -> BattleResult:
    last = first if stop.outcome == "refused" else fight.look()
    after = mark(fight.session)
    final = after.state.battle
    outcome: BattleOutcome | None = None
    reason = stop.reason
    ended_before = start_id is None and stop.outcome == "finished"
    if final is None and (
        ended_before or (start_id is not None and fight.value(LAST_ID) == start_id)
    ):
        final = read_battle(fight.session, LAST_BATTLE).value
        found = None if final is None else OUTCOMES.get(final.decision)
        if found is not None:
            outcome = found
            if stop.outcome == "finished":
                reason = f"the battle ended ({found}); {reason}"
    result = BattleResult(
        outcome=stop.outcome,
        reason=reason,
        started=first.tick,
        tick=last.tick,
        context=last.context,
        transcript=fight.transcript,
        decision=stop.decision,
        frames=last.frames,
        changes=state_changes(before, after),
        battle_changes=battle_changes(
            before.state.battle,
            final,
            ended=before.state.battle is not None and after.state.battle is None,
        ),
        battle_outcome=outcome,
        events=fight.events,
        battle_before=before.state.battle,
        battle_after=final,
    )
    fight.note("result", **result_fields(result))
    return result


def begin(
    driver: Driver, report: Callable[[str], None], entry: str, **fields: Any
) -> tuple[Fight, Mark, Look, Any]:
    fight = Fight(driver, BATTLE_KIND, log, report)
    note(driver.session, BATTLE_KIND, "start", entry=entry, **fields)
    before = mark(driver.session)
    first = fight.look()
    if not first.battle and first.context.name == TRANSITION:
        fight.wait(first)
        first = fight.look()
    start_id = fight.value(BATTLE_ID) if first.battle else None
    return fight, before, first, start_id


def no_battle(fight: Fight, view: Look) -> str:
    last = fight.value(("last_decision", f"{LAST_BATTLE}@decision"))
    ended = f"; the last battle ended ({OUTCOMES[last]})" if last in OUTCOMES else ""
    return f"no battle is running; the game is in {where(view)}{ended}"


def command_refusal(fight: Fight, view: Look) -> str | None:
    if not view.battle:
        return no_battle(fight, view)
    if view.context.name != BATTLE_COMMAND:
        return f"the command menu is not open; the game is in {where(view)}"
    return None


def command_mode(view: Look) -> Any:
    return (view.payload(BATTLE_COMMAND) or {}).get("mode")


def command_options(fight: Fight, view: Look) -> tuple[int, list[str]]:
    payload = view.payload(BATTLE_COMMAND) or {}
    texts = [fight.text(text) for text in payload.get("texts") or []]
    return payload.get("battler", -1), texts[1:]


def continue_battle(driver: Driver, report: Callable[[str], None] = lambda _: None) -> BattleResult:
    fight, before, first, start_id = begin(driver, report, "continue")
    last = fight.value(("last_decision", f"{LAST_BATTLE}@decision"))
    if not first.battle and last in OUTCOMES:
        back = "the idle overworld" if first.idle else where(first)
        stop = Stop("finished", f"no battle is running; back in {back} at tick {first.tick}")
    elif not first.battle:
        stop = Stop("refused", no_battle(fight, first))
    elif in_chain(first):
        stop = Stop("refused", f"a prompt chain is open ({where(first)}); continue_menu answers it")
    else:
        stop = fight.run(first)
    return conclude(fight, first, stop, before, start_id)


@dataclass(frozen=True)
class Aim:
    index: int
    name: str | None


@dataclass(frozen=True)
class Chosen:
    slot: int | None
    menu: bool
    aim: Aim | None = None


def single(battle: Battle) -> bool:
    return battle.side_sizes == SINGLES


def move_aim(fight: Fight, index: int, slot: int, move: str, target: int | None) -> Aim | str:
    path = ("targets", f"AnilBridge.move_targets({index}, {slot})")
    found = fight.session.read(ReadRequest(paths=[path], depth=2)).value.values.get("targets")
    if not isinstance(found, list):
        return f"the targets of {move} could not be read"
    kind, count, texts = found
    names = {at: fight.text(text) for at, text in enumerate(texts or []) if text}
    if count != ONE_TARGET:
        if target is not None:
            return f"{move} targets {kind}, which leaves no target to choose"
        return Aim(-1, None)
    if target is None:
        if len(names) == 1:
            only, name = next(iter(names.items()))
            return Aim(only, name)
        listed = ", ".join(f"{at} ({name})" for at, name in names.items())
        return f"{move} targets one battler; name one of {listed}"
    if target not in names:
        listed = ", ".join(str(at) for at in names)
        return (
            f"battler {target} is not on the field as a target of {move}; the targets are {listed}"
        )
    return Aim(target, names[target])


def move_choice(
    fight: Fight, battle: Battle, index: int, move: str, target: int | None
) -> Chosen | str:
    if single(battle) and target is not None:
        return "a single battle takes no target"
    battler = next((entry for entry in battle.battlers if entry.index == index), None)
    if battler is None:
        return f"battler {index} is not on the field"
    known = [entry.move.id for entry in battler.moves]
    menu = bool(fight.value(("menu", f"AnilBridge.battle.pbCanShowFightMenu?({index})")))
    if move == STRUGGLE:
        if menu or battler.effects[fight.value(ENCORE)]:
            return f"{battler.nickname} can still choose a move; Struggle is only used when none can be"
        if target is not None:
            return "Struggle picks its own target"
        return Chosen(None, menu)
    if move not in known:
        return f"{battler.nickname} does not know {move}; it knows {', '.join(known)}"
    slot = known.index(move)
    reason = fight.value(("refusal", f"AnilBridge.move_refusal({index}, {slot})"))
    if reason is not None:
        return fight.text(reason) or f"the game refuses {move}"
    if single(battle):
        return Chosen(slot, menu)
    aim = move_aim(fight, index, slot, move, target)
    if isinstance(aim, str):
        return aim
    return Chosen(slot, menu, aim)


def fight(
    driver: Driver,
    move: str,
    target: int | None = None,
    report: Callable[[str], None] = lambda _: None,
) -> BattleResult:
    steps, before, first, start_id = begin(driver, report, "fight", move=move, target=target)
    refusal = command_refusal(steps, first)
    if refusal is not None:
        return conclude(steps, first, Stop("refused", refusal), before, start_id)
    index, options = command_options(steps, first)
    battle = steps.battle()
    chosen = move_choice(steps, battle, index, move, target)
    if isinstance(chosen, str):
        return conclude(steps, first, Stop("refused", chosen), before, start_id)
    turn = steps.value(TURN)
    lines = len(steps.transcript)
    view = steps.choose(first, BATTLE_COMMAND, FIGHT_COMMAND, "command", options)
    if isinstance(view, Stop):
        return conclude(steps, first, view, before, start_id)
    if chosen.menu and chosen.slot is not None:
        view = steps.reach(view, BATTLE_FIGHT)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
        battler = next(entry for entry in battle.battlers if entry.index == index)
        names = [label(entry.move) for entry in battler.moves]
        view = steps.choose(view, BATTLE_FIGHT, chosen.slot, "move", names)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
    if chosen.aim is not None:
        view = steps.to_target(view)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
        view = steps.aim(view, chosen.aim)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
    steps.acted = Acted(index, turn, lines)
    return conclude(steps, first, steps.run(view), before, start_id)


def answer_next(steps: Fight, view: Look, answer: str) -> Look | Stop:
    step = steps.choice(view, answer, lambda: None)
    if isinstance(step, Ended):
        return stopped(step)
    return steps.look()


def run(driver: Driver, report: Callable[[str], None] = lambda _: None) -> BattleResult:
    steps, before, first, start_id = begin(driver, report, "run")
    if first.battle and steps.next_prompt(first):
        index = steps.fainted()
        reason = steps.refusal(f"AnilBridge.run_refusal({index}, true)")
        if reason is not None:
            return conclude(steps, first, Stop("refused", reason), before, start_id)
        view = answer_next(steps, first, NO)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
        return conclude(steps, first, steps.run(view), before, start_id)
    refusal = command_refusal(steps, first)
    if refusal is not None:
        return conclude(steps, first, Stop("refused", refusal), before, start_id)
    index, options = command_options(steps, first)
    if len(options) <= RUN_COMMAND or options[RUN_COMMAND] != RUN_TEXT:
        shown = options[RUN_COMMAND] if len(options) > RUN_COMMAND else None
        stop = Stop("refused", f"the command menu shows {shown!r} where {RUN_TEXT!r} would be")
        return conclude(steps, first, stop, before, start_id)
    reason = steps.refusal(f"AnilBridge.run_refusal({index})")
    if reason is not None:
        return conclude(steps, first, Stop("refused", reason), before, start_id)
    turn = steps.value(TURN)
    lines = len(steps.transcript)
    view = steps.choose(first, BATTLE_COMMAND, RUN_COMMAND, "command", options)
    if isinstance(view, Stop):
        return conclude(steps, first, view, before, start_id)
    steps.acted = Acted(index, turn, lines)
    return conclude(steps, first, steps.run(view), before, start_id)


def switch(
    driver: Driver, slot: int, report: Callable[[str], None] = lambda _: None
) -> BattleResult:
    steps, before, first, start_id = begin(driver, report, "switch", slot=slot)
    if not first.battle:
        return conclude(steps, first, Stop("refused", no_battle(steps, first)), before, start_id)
    name = first.context.name
    lines = len(steps.transcript)
    if name == BATTLE_COMMAND:
        index, options = command_options(steps, first)
        if len(options) <= POKEMON_COMMAND or options[POKEMON_COMMAND] != POKEMON_TEXT:
            shown = options[POKEMON_COMMAND] if len(options) > POKEMON_COMMAND else None
            stop = Stop(
                "refused", f"the command menu shows {shown!r} where {POKEMON_TEXT!r} would be"
            )
            return conclude(steps, first, stop, before, start_id)
        reason = steps.refusal(f"AnilBridge.switch_refusal({index}, {slot}, false)")
        if reason is not None:
            return conclude(steps, first, Stop("refused", reason), before, start_id)
        turn = steps.value(TURN)
        view = steps.choose(first, BATTLE_COMMAND, POKEMON_COMMAND, "command", options)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
        steps.acted = Acted(index, turn, lines)
    elif name == BATTLE_SWITCH and not cancellable(first):
        index = (first.payload(BATTLE_SWITCH) or {}).get("battler", -1)
        reason = steps.refusal(f"AnilBridge.switch_refusal({index}, {slot}, true)")
        if reason is not None:
            return conclude(steps, first, Stop("refused", reason), before, start_id)
        view = first
    elif steps.next_prompt(first):
        index = steps.fainted()
        reason = steps.refusal(f"AnilBridge.switch_refusal({index}, {slot}, true)")
        if reason is not None:
            return conclude(steps, first, Stop("refused", reason), before, start_id)
        view = answer_next(steps, first, YES)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
    else:
        stop = Stop(
            "refused",
            "neither the command menu, a replacement nor the next-Pokémon question is open; "
            f"the game is in {where(first)}",
        )
        return conclude(steps, first, stop, before, start_id)
    picked = steps.pick(view, index, slot)
    if isinstance(picked, Stop):
        return conclude(steps, first, picked, before, start_id)
    steps.picked = lines
    return conclude(steps, first, steps.run(picked), before, start_id)


@dataclass(frozen=True)
class BagItem:
    id: str
    name: str
    use: int
    pocket: int
    row: int
    rows: int


@dataclass(frozen=True)
class ItemUse:
    item: BagItem
    slot: int
    move: int
    panel: bool


def bag_item(steps: Fight, item: str) -> BagItem | str:
    path = ("item", f'AnilBridge.battle_item("{item}")')
    found = steps.session.read(ReadRequest(paths=[path], depth=2)).value.values.get("item")
    if not isinstance(found, list):
        return f"{item} is not an item"
    id, name, use, place = found
    label = steps.text(name) or id
    if not use:
        return f"{label} cannot be used in battle"
    if not isinstance(place, list):
        return f"{label} is not in the bag"
    pocket, row, rows, _ = place
    return BagItem(id, label, use, pocket, row, rows)


def item_use(
    steps: Fight,
    battle: Battle,
    index: int,
    item: BagItem,
    pokemon: int | None,
    move: str | None,
    target: int | None,
) -> ItemUse | str:
    if target is not None and item.use not in (ON_BATTLER, ON_FOE):
        return f"{item.name} takes no target"
    if item.use in ON_POKEMON:
        if pokemon is None:
            return f"{item.name} is used on a party Pokémon; name its slot"
        party = steps.value(("party", f"AnilBridge.battle.pbParty({index}).length"))
        if not isinstance(party, int) or not 0 <= pokemon < party:
            return f"party slot {pokemon} is empty; the party has {party} Pokémon"
        if item.use != ON_MOVE and move is not None:
            return f"{item.name} is not used on a move"
        slot_move = -1
        if item.use == ON_MOVE:
            path = ("moves", f"AnilBridge.battle.pbParty({index})[{pokemon}].moves")
            moves = steps.session.read(ReadRequest(paths=[path], depth=3)).value.values.get("moves")
            known = [entry.get("ivars", {}).get("id") for entry in moves or []]
            if move is None:
                return f"{item.name} restores a move; name one of {', '.join(map(str, known))}"
            if move not in known:
                return f"party slot {pokemon} does not know {move}; it knows {', '.join(map(str, known))}"
            slot_move = known.index(move)
        alone = steps.value(("alone", f"AnilBridge.battle.pbTeamLengthFromBattlerIndex({index})"))
        return ItemUse(item, pokemon, slot_move, alone != 1 or item.use == ON_MOVE)
    if pokemon is not None or move is not None:
        return f"{item.name} takes no party slot or move"
    if item.use == ON_FOE:
        foes = [entry.index for entry in battle.battlers if entry.index % 2 and not entry.fainted]
        if not foes:
            return "no foe is on the field"
        if target is not None and target not in foes:
            listed = ", ".join(str(foe) for foe in foes)
            return f"battler {target} is not a foe on the field; the foes are {listed}"
        return ItemUse(item, foes[0] if target is None else target, -1, False)
    if item.use == ON_BATTLER:
        return battler_use(steps, battle, index, item, target)
    return ItemUse(item, index, -1, False)


def battler_use(
    steps: Fight, battle: Battle, index: int, item: BagItem, target: int | None
) -> ItemUse | str:
    count = steps.value(("count", "AnilBridge.battle.pbPlayerBattlerCount"))
    if count == 1:
        if target is not None and target != index:
            return f"{item.name} goes to battler {index}, the only one of ours on the field"
        target = index
    else:
        owned = [
            entry.index
            for entry in battle.battlers
            if entry.index % 2 == 0
            and not entry.fainted
            and steps.value(("owned", f"AnilBridge.battle.pbOwnedByPlayer?({entry.index})"))
        ]
        listed = ", ".join(str(at) for at in owned)
        if target is None:
            return f"{item.name} is used on one of our battlers; name one of {listed}"
        if target not in owned:
            return f"battler {target} is not one of ours on the field; ours are {listed}"
    own = steps.value(("own", f"AnilBridge.battle.battlers[{target}].pokemonIndex"))
    if not isinstance(own, int):
        return f"battler {target} has no Pokémon"
    return ItemUse(item, own, -1, count != 1)


def use_on(steps: Fight, view: Look, index: int, use: ItemUse) -> Look | Stop:
    panel = steps.reach(view, MENU, OPEN_TICKS)
    if isinstance(panel, Stop):
        return panel
    if panel.context.screen != BAG_PARTY:
        return Stop("stuck", f"the party panel did not open; the game is in {where(panel)}")
    row = steps.value(("row", f"AnilBridge.switch_row({index}, {use.slot})"))
    name = steps.value(("name", f"AnilBridge.battle.pbParty({index})[{use.slot}].name"))
    member = steps.text(name) or f"slot {use.slot}"
    if not isinstance(row, int):
        return Stop("stuck", f"party slot {use.slot} has no row on the party panel")
    reached = steps.cursor_to(panel, PARTY_PAYLOAD, row, PARTY_ROWS, member, ("RIGHT", "LEFT"))
    if isinstance(reached, Ended):
        return stopped(reached)
    view = reached[0]
    log.info("pokemon %r on tick %d", member, view.tick)
    steps.note("step", prompt="pokemon", screen=BAG_PARTY, answer=member)
    steps.record(AnswerLine(view.tick, "pokemon", None, member))
    if not steps.confirm(view):
        return Stop("stuck", f"C on {member} in the party panel opened nothing")
    view = steps.look()
    if use.item.use != ON_MOVE:
        return view
    found = steps.live(view, CHOICE, "cursor", MENU)
    if isinstance(found, Ended):
        return stopped(found)
    view, payload = found
    options = [steps.text(option) for option in payload.get("options") or []]
    if use.move >= len(options):
        return Stop("stuck", f"the move list {options} has no row {use.move}")
    picked = steps.cursor_to(view, CHOICE, use.move, len(options), options[use.move])
    if isinstance(picked, Ended):
        return stopped(picked)
    view = picked[0]
    steps.record(AnswerLine(view.tick, steps.prompt(view, payload), options, options[use.move]))
    if not steps.confirm(view):
        return Stop("stuck", f"C on {options[use.move]!r} closed nothing")
    return steps.look()


def item(
    driver: Driver,
    name: str,
    pokemon: int | None = None,
    move: str | None = None,
    target: int | None = None,
    report: Callable[[str], None] = lambda _: None,
) -> BattleResult:
    steps, before, first, start_id = begin(
        driver, report, "item", item=name, pokemon=pokemon, move=move, target=target
    )
    refusal = command_refusal(steps, first)
    if refusal is not None:
        return conclude(steps, first, Stop("refused", refusal), before, start_id)
    index, options = command_options(steps, first)
    if len(options) <= BAG_COMMAND or options[BAG_COMMAND] != BAG_TEXT:
        shown = options[BAG_COMMAND] if len(options) > BAG_COMMAND else None
        stop = Stop("refused", f"the command menu shows {shown!r} where {BAG_TEXT!r} would be")
        return conclude(steps, first, stop, before, start_id)
    reason = steps.refusal("AnilBridge.bag_refusal")
    if reason is not None:
        return conclude(steps, first, Stop("refused", reason), before, start_id)
    found = bag_item(steps, name)
    if isinstance(found, str):
        return conclude(steps, first, Stop("refused", found), before, start_id)
    use = item_use(steps, steps.battle(), index, found, pokemon, move, target)
    if isinstance(use, str):
        return conclude(steps, first, Stop("refused", use), before, start_id)
    first_action = "false" if command_mode(first) == NOT_FIRST else "true"
    reason = steps.refusal(
        f'AnilBridge.item_refusal({index}, "{found.id}", {use.slot}, {use.move}, {first_action})'
    )
    if reason is not None:
        return conclude(steps, first, Stop("refused", reason), before, start_id)
    turn = steps.value(TURN)
    lines = len(steps.transcript)
    view = steps.choose(first, BATTLE_COMMAND, BAG_COMMAND, "command", options)
    if isinstance(view, Stop):
        return conclude(steps, first, view, before, start_id)
    view = steps.reach(view, BATTLE_BAG, OPEN_TICKS)
    if isinstance(view, Stop):
        return conclude(steps, first, view, before, start_id)
    reached = bag_row(
        steps, view, BATTLE_BAG, found.pocket, found.row, found.rows, found.id, found.name
    )
    if isinstance(reached, Ended):
        return conclude(steps, first, stopped(reached), before, start_id)
    log.info("item %r on tick %d", found.name, reached.tick)
    steps.note("step", prompt="item", screen=BATTLE_BAG, answer=found.id)
    steps.record(AnswerLine(reached.tick, "item", None, found.name))
    if not steps.confirm(reached):
        return conclude(
            steps, first, Stop("stuck", f"C on {found.name} opened nothing"), before, start_id
        )
    step = steps.choice(steps.look(), USE_TEXT, lambda: None)
    if isinstance(step, Ended):
        return conclude(steps, first, stopped(step), before, start_id)
    view = steps.look()
    if use.panel:
        view = use_on(steps, view, index, use)
        if isinstance(view, Stop):
            return conclude(steps, first, view, before, start_id)
    steps.acted = Acted(index, turn, lines)
    return conclude(steps, first, steps.run(view), before, start_id)


def store_refusal(decision: BattleDecision, slot: int | None, bag: bool | None) -> str | None:
    if slot is None and SEND_TO_BOX not in decision.commands:
        return f"the game offers no box for {decision.caught}; name a party slot"
    if slot is None:
        holder, item = decision.caught, decision.caught_item
    elif slot not in decision.slots:
        return f"party slot {slot} is empty; the party has {len(decision.slots)} Pokémon"
    else:
        holder, item = f"party slot {slot}", decision.held.get(slot)
    if item is not None and bag is None:
        return f"{holder} holds {item}; say whether the item goes to the bag"
    if item is None and bag is not None:
        return f"{holder} holds no item, so the game asks nothing about the bag"
    return None


def store(
    driver: Driver,
    slot: int | None = None,
    bag: bool | None = None,
    report: Callable[[str], None] = lambda _: None,
) -> BattleResult:
    steps, before, first, start_id = begin(driver, report, "store", slot=slot, bag=bag)
    if not first.battle:
        return conclude(steps, first, Stop("refused", no_battle(steps, first)), before, start_id)
    if not steps.full_prompt(first):
        stop = Stop(
            "refused",
            f"the game is not asking where a catch goes; the game is in {where(first)}",
        )
        return conclude(steps, first, stop, before, start_id)
    decision = steps.full_decision(first)
    refusal = store_refusal(decision, slot, bag)
    if refusal is not None:
        return conclude(steps, first, Stop("refused", refusal, decision), before, start_id)
    steps.bag = None if bag is None else YES if bag else NO
    answer = SEND_TO_BOX if slot is None else ADD_TO_PARTY
    step = steps.choice(first, answer, lambda: None)
    if isinstance(step, Ended):
        return conclude(steps, first, stopped(step), before, start_id)
    view = steps.look()
    if slot is not None:
        while view.context.name in (MESSAGE, TRANSITION):
            progressed = steps.message(view) if view.context.name == MESSAGE else steps.wait(view)
            view = steps.look()
            if not progressed:
                break
        picked = steps.pick(view, 0, slot, SEND_TO_PC)
        if isinstance(picked, Stop):
            return conclude(steps, first, picked, before, start_id)
        view = picked
    return conclude(steps, first, steps.run(view), before, start_id)
