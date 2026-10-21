import math
import sqlite3
from dataclasses import dataclass
from typing import Any, Final, Literal

from anil.bridge.protocol import Event, ShownFact
from anil.harness import gamedb
from anil.harness.battle import (
    BattleDecision,
    BattleOutcome,
    BattleResult,
    battler_fields,
    label,
)
from anil.harness.changes import (
    Changed,
    FlagChange,
    ItemChange,
    MemberChange,
    StateChanges,
    StoredChange,
)
from anil.harness.context import Context
from anil.harness.dialog import DialogResult
from anil.harness.gamedb import (
    OPPONENT_HIDDEN,
    REVEALED,
    WORLD,
    Ability,
    Item,
    Location,
    Matchup,
    Move,
    Species,
    Status,
    Tag,
    TrainerPokemon,
    TrainerType,
    Type,
)
from anil.harness.investigate import Session
from anil.harness.menu import MenuDecision, MenuResult, answer_text
from anil.harness.navigate import GoResult, Target
from anil.harness.random import (
    OPPONENT_SPECIES,
    OWN,
    AbilityEntry,
    Compatibility,
    Learnset,
    OpponentPokemon,
    RunRandom,
    Starter,
    TmMart,
    TmMove,
    TrainerTeam,
    WildSlot,
    read_random,
)
from anil.harness.state import (
    Battle,
    Battler,
    Command,
    GameState,
    Named,
    Pocket,
    Pokemon,
    Position,
    Reveals,
    Stored,
    Trainer,
    Transfer,
    Vial,
)
from anil.harness.steps import Decision, Line
from anil.harness.steps import Outcome as StepOutcome


class Hidden:
    def __repr__(self) -> str:
        return "hidden"

    def __str__(self) -> str:
        return "hidden"


HIDDEN: Final = Hidden()

type Known[T] = T | Hidden
type Policy = frozenset[Tag]

STORY: Policy = frozenset({WORLD, OWN, OPPONENT_SPECIES, REVEALED})
MAX_MOVES = 4
PUBLIC_EVENTS = frozenset({"battle_text", "reveal"})
SEND_OUT_UNSHOWN = frozenset({"trainer", "slot"})


@dataclass(frozen=True)
class KnownTrainer:
    id: str
    trainer_type: Known[TrainerType]
    name: str
    version: int
    lose_text: str
    lose_text_female: str
    items: Known[tuple[str, ...]]
    pokemon: tuple[Known[TrainerPokemon], ...]


@dataclass(frozen=True)
class KnownStarter:
    variable: int
    species: Known[str]
    level: Known[int | None]
    moves: Known[tuple[str, ...]]
    ability: Known[str | None]


@dataclass(frozen=True)
class KnownWildSlot:
    species: Known[str]
    chance: Known[int]
    min_level: Known[int]
    max_level: Known[int]


@dataclass(frozen=True)
class KnownOpponent:
    species: Known[str]
    level: Known[int | None]
    moves: Known[tuple[str, ...]]
    ability: Known[str | None]
    item: Known[str | None]
    nature: Known[str | None]
    ivs: Known[dict[str, int]]


@dataclass(frozen=True)
class KnownTeam:
    trainer: Known[str]
    party: tuple[KnownOpponent, ...]


@dataclass(frozen=True)
class KnownRandom:
    tick: int
    owned: Known[frozenset[str]]
    abilities: dict[str, Known[AbilityEntry]] | None
    learnsets: dict[str, Known[Learnset]] | None
    compatibility: dict[str, Known[Compatibility]] | None
    tm_moves: dict[str, Known[TmMove]] | None
    starters: tuple[KnownStarter | None, ...]
    wild: dict[int, dict[str, tuple[KnownWildSlot, ...]]] | None
    trainers: dict[str, KnownTeam] | None
    tm_marts: dict[int, Known[TmMart]] | None


@dataclass(frozen=True)
class KnownFoe:
    index: int
    trainer: str | None
    slot: int
    name: Known[str]
    species: Known[Named]
    form: Known[int]
    transformed_into: Known[Named | None]
    level: Known[int]
    gender: Known[int]
    shiny: Known[bool]
    types: Known[tuple[Named, ...] | None]
    status: Known[Named]
    hp_percent: Known[int]
    fainted: Known[bool]
    moves: tuple[Known[str], ...]
    ability: Known[str]
    remembered_item: Known[str]
    held_item: Known[str | None]
    shown: Known[tuple[ShownFact, ...]]
    stats: Known[dict[str, int]]
    stages: Known[dict[str, int]]
    effects: Known[list[Any]]


@dataclass(frozen=True)
class KnownMember:
    party_index: int
    trainer: str | None
    slot: int
    species: Known[Named]
    shown: Known[tuple[ShownFact, ...]]


@dataclass(frozen=True)
class KnownEffect:
    side: str
    effect: str
    since_turn: int
    turns: int
    layers: int | None


@dataclass(frozen=True)
class KnownBattle:
    side_sizes: tuple[int, ...]
    wild: bool
    balls: bool
    can_run: bool
    opponent: tuple[str, ...]
    opponent_ids: tuple[str, ...]
    turn: int
    decision: int
    weather: Known[str]
    weather_duration: Known[int]
    terrain: Known[str]
    terrain_duration: Known[int]
    battlers: tuple[Known[Battler] | KnownFoe, ...]
    player_party: Known[tuple[Pokemon | None, ...]]
    opponent_party: tuple[KnownMember, ...]
    remaining: Known[int]
    shown_effects: Known[tuple[KnownEffect, ...]]
    own_side_effects: Known[list[Any]]
    foe_side_effects: Known[list[Any]]
    field_effects: Known[list[Any]]


@dataclass(frozen=True)
class KnownState:
    tick: int
    context: Known[Context]
    trainer: Known[Trainer | None]
    party: Known[tuple[Pokemon, ...]]
    bag: Known[tuple[Pocket, ...]]
    vial: Known[Vial | None]
    boxes: Known[tuple[Stored, ...]]
    position: Known[Position | None]
    transfer: Known[Transfer | None]
    battle: KnownBattle | None
    command: Known[Command | None]
    switches: Known[dict[int, bool | None]]
    variables: Known[dict[int, Any]]
    self_switches: Known[dict[str, bool]]
    reveals: Known[Reveals]
    challenge_encs: Known[frozenset[int]]
    visited: Known[frozenset[int]]
    events: tuple[Event, ...]


@dataclass(frozen=True)
class KnownChanges:
    items: Known[list[ItemChange]]
    money: Known[Changed[int] | None]
    vial: Known[Changed[int | None] | None]
    party: Known[list[MemberChange]]
    boxes: Known[list[StoredChange]]
    position: Known[Changed[tuple[int, int, int] | None] | None]
    switches: Known[list[FlagChange[int]]]
    variables: Known[list[FlagChange[int]]]
    self_switches: Known[list[FlagChange[str]]]


@dataclass(frozen=True)
class KnownDialog:
    outcome: StepOutcome
    reason: str
    started: int
    tick: int
    context: Known[Context]
    transcript: Known[list[Line]]
    decision: Known[Decision | None]
    unused: list[str]
    changes: KnownChanges
    events: tuple[Event, ...]


@dataclass(frozen=True)
class KnownMenu:
    outcome: StepOutcome
    reason: str
    started: int
    tick: int
    context: Known[Context]
    transcript: Known[list[Line]]
    decision: Known[MenuDecision | None]
    unused: list[str]
    changes: KnownChanges
    events: tuple[Event, ...]


@dataclass(frozen=True)
class KnownGo:
    outcome: str
    target: Target
    started: int
    tick: int
    position: Known[tuple[int, int, int] | None]
    reason: str
    context: Known[Context | None]
    steps: int
    warps: int
    replans: int
    flights: int


@dataclass(frozen=True)
class KnownBattlerChange:
    index: int
    side: str
    change: Literal["added", "removed", "changed"]
    species: Known[str]
    fields: Known[dict[str, Changed[Any]]]


@dataclass(frozen=True)
class KnownBattleChanges:
    turn: Changed[int] | None
    weather: Known[Changed[str] | None]
    terrain: Known[Changed[str] | None]
    battlers: tuple[KnownBattlerChange, ...]
    ended: bool


@dataclass(frozen=True)
class KnownBattleResult:
    outcome: StepOutcome
    reason: str
    started: int
    tick: int
    context: Known[Context]
    transcript: Known[list[Line]]
    decision: Known[BattleDecision | None]
    battle_outcome: BattleOutcome | None
    battle_changes: KnownBattleChanges
    changes: KnownChanges
    events: tuple[Event, ...]


def event_tag(event: Event) -> Tag:
    return REVEALED if event.kind in PUBLIC_EVENTS else OPPONENT_HIDDEN


def screen_event(event: Event) -> Event:
    fact = event.data.get("fact")
    if event.kind != "reveal" or not isinstance(fact, dict) or fact.get("kind") != "send_out":
        return event
    shown = {name: value for name, value in event.data.items() if name not in SEND_OUT_UNSHOWN}
    shown["fact"] = {name: value for name, value in fact.items() if name != "illusion"}
    return event.model_copy(update={"data": shown})


def screen_payload(payload: dict[str, Any]) -> dict[str, Any]:
    battler = payload.get("battler")
    if not isinstance(battler, dict) or "ivars" not in battler:
        return payload
    return {**payload, "battler": battler["ivars"].get("index")}


def screen_context(context: Context) -> Context:
    return context.model_copy(
        update={"payloads": [screen_payload(payload) for payload in context.payloads]}
    )


def hp_percent(hp: int, total_hp: int) -> int:
    return math.ceil(hp / total_hp * 100) if total_hp > 0 else 0


def owner(battle: Battle, party_index: int) -> tuple[str | None, int]:
    if battle.wild:
        return None, party_index
    found = 0
    for number, start in enumerate(battle.party2_starts):
        if start > party_index:
            break
        found = number
    trainer = battle.opponent_ids[found] if found < len(battle.opponent_ids) else None
    return trainer, party_index - battle.party2_starts[found]


def remembered(reveals: Reveals, trainer: str | None, slot: int) -> tuple[ShownFact, ...]:
    held = reveals.wild if trainer is None else reveals.trainers.get(trainer, {})
    return tuple(held.get(slot, []))


def foe_fields(battler: Battler) -> dict[str, Any]:
    return {
        "species": label(battler.display_species),
        "hp_percent": hp_percent(battler.hp, battler.total_hp),
        "status": label(battler.status),
        "fainted": battler.fainted,
        "stages": {stat: stage for stat, stage in battler.stages.items() if stage},
    }


def shown_battler(battler: Battler) -> tuple[Tag, str, dict[str, Any]]:
    if battler.side == "player":
        return OWN, label(battler.species), battler_fields(battler)
    return REVEALED, label(battler.display_species), foe_fields(battler)


def changed[T](was: T, now: T) -> Changed[T] | None:
    return None if was == now else Changed(was, now)


def own_ids(shown: tuple[ShownFact, ...], kind: str) -> list[str]:
    return list(dict.fromkeys(fact.id for fact in shown if fact.kind == kind and fact.own))


class KnowledgeView:
    def __init__(self, policy: Policy, connection: sqlite3.Connection) -> None:
        self.policy = policy
        self.connection = connection

    def allow[T](self, tag: Tag, value: T) -> Known[T]:
        return value if tag in self.policy else HIDDEN

    def record[R: Species | Move | Ability | Item | Type | Status | TrainerType | Matchup](
        self, found: R
    ) -> Known[R]:
        return self.allow(found.tag, found)

    def species(self, species_id: str) -> Known[Species]:
        return self.record(gamedb.species(self.connection, species_id))

    def move(self, move_id: str) -> Known[Move]:
        return self.record(gamedb.move(self.connection, move_id))

    def ability(self, ability_id: str) -> Known[Ability]:
        return self.record(gamedb.ability(self.connection, ability_id))

    def item(self, item_id: str) -> Known[Item]:
        return self.record(gamedb.item(self.connection, item_id))

    def game_type(self, type_id: str) -> Known[Type]:
        return self.record(gamedb.game_type(self.connection, type_id))

    def status(self, status_id: str) -> Known[Status]:
        return self.record(gamedb.status(self.connection, status_id))

    def trainer_type(self, type_id: str) -> Known[TrainerType]:
        return self.record(gamedb.trainer_type(self.connection, type_id))

    def matchup(self, attack: str, *defend: str) -> Known[Matchup]:
        return self.record(gamedb.matchup(self.connection, attack, *defend))

    def trainer(self, trainer_id: str) -> Known[KnownTrainer]:
        found = gamedb.trainer(self.connection, trainer_id)
        if found.tag not in self.policy:
            return HIDDEN
        return KnownTrainer(
            id=found.id,
            trainer_type=self.record(found.trainer_type),
            name=found.name,
            version=found.version,
            lose_text=found.lose_text,
            lose_text_female=found.lose_text_female,
            items=self.allow(found.items_tag, found.items),
            pokemon=tuple(self.allow(member.tag, member) for member in found.pokemon),
        )

    def locations(self, map_id: int | None = None) -> list[Known[Location]]:
        return [
            self.allow(location.tag, location)
            for location in gamedb.locations(self.connection, map_id)
        ]

    def random(self, session: Session) -> KnownRandom:
        return self.rolled(read_random(session, self.connection))

    def rolled(self, run: RunRandom) -> KnownRandom:
        return KnownRandom(
            tick=run.tick,
            owned=self.allow(OWN, run.owned),
            abilities=self.table(run.abilities),
            learnsets=self.table(run.learnsets),
            compatibility=self.table(run.compatibility),
            tm_moves=self.table(run.tm_moves),
            starters=tuple(
                None if starter is None else self.starter(starter) for starter in run.starters
            ),
            wild=None
            if run.wild is None
            else {
                map_id: {
                    encounter_type: tuple(self.wild_slot(slot) for slot in slots)
                    for encounter_type, slots in types.items()
                }
                for map_id, types in run.wild.items()
            },
            trainers=None
            if run.trainers is None
            else {key: self.team(team) for key, team in run.trainers.items()},
            tm_marts=self.table(run.tm_marts),
        )

    def table[K, R: AbilityEntry | Learnset | Compatibility | TmMove | TmMart](
        self, found: dict[K, R] | None
    ) -> dict[K, Known[R]] | None:
        if found is None:
            return None
        return {key: self.allow(value.tag, value) for key, value in found.items()}

    def starter(self, starter: Starter) -> KnownStarter:
        return KnownStarter(
            variable=starter.variable,
            species=self.allow(starter.species_tag, starter.species),
            level=self.allow(starter.species_tag, starter.level),
            moves=self.allow(starter.tag, starter.moves),
            ability=self.allow(starter.tag, starter.ability),
        )

    def wild_slot(self, slot: WildSlot) -> KnownWildSlot:
        return KnownWildSlot(
            species=self.allow(slot.species_tag, slot.species),
            chance=self.allow(slot.tag, slot.chance),
            min_level=self.allow(slot.tag, slot.min_level),
            max_level=self.allow(slot.tag, slot.max_level),
        )

    def team(self, team: TrainerTeam) -> KnownTeam:
        return KnownTeam(
            trainer=self.allow(team.tag, team.trainer),
            party=tuple(self.opponent(member) for member in team.party),
        )

    def opponent(self, member: OpponentPokemon) -> KnownOpponent:
        return KnownOpponent(
            species=self.allow(member.species_tag, member.species),
            level=self.allow(member.tag, member.level),
            moves=self.allow(member.tag, member.moves),
            ability=self.allow(member.tag, member.ability),
            item=self.allow(member.tag, member.item),
            nature=self.allow(member.tag, member.nature),
            ivs=self.allow(member.tag, member.ivs),
        )

    def allow_shown[T](self, shown: list[T], tag: Tag) -> Known[T]:
        return shown[-1] if shown and tag in self.policy else HIDDEN

    def foe(self, battle: Battle, battler: Battler, reveals: Reveals) -> KnownFoe:
        shown_index = (
            battler.pokemon_index if battler.illusion_index is None else battler.illusion_index
        )
        trainer, slot = owner(battle, shown_index)
        shown = remembered(reveals, trainer, slot)
        moves: list[Known[str]] = [self.allow(REVEALED, move) for move in own_ids(shown, "move")]
        moves += [HIDDEN] * (MAX_MOVES - len(moves))
        types = None if battler.display_types is None else tuple(battler.display_types)
        return KnownFoe(
            index=battler.index,
            trainer=trainer,
            slot=slot,
            name=self.allow(REVEALED, battler.display_name),
            species=self.allow(OPPONENT_SPECIES, battler.display_species),
            form=self.allow(OPPONENT_SPECIES, battler.display_form),
            transformed_into=self.allow(REVEALED, battler.transform_species),
            level=self.allow(REVEALED, battler.level),
            gender=self.allow(REVEALED, battler.display_gender),
            shiny=self.allow(REVEALED, battler.shiny),
            types=self.allow(REVEALED, types),
            status=self.allow(REVEALED, battler.status),
            hp_percent=self.allow(REVEALED, hp_percent(battler.hp, battler.total_hp)),
            fainted=self.allow(REVEALED, battler.fainted),
            moves=tuple(moves),
            ability=self.allow_shown(own_ids(shown, "ability"), REVEALED),
            remembered_item=self.allow_shown(own_ids(shown, "item"), REVEALED),
            held_item=self.allow(REVEALED, reveals.held[shown_index])
            if shown_index in reveals.held
            else HIDDEN,
            shown=self.allow(REVEALED, shown),
            stats=self.allow(OPPONENT_HIDDEN, battler.stats.model_dump()),
            stages=self.allow(REVEALED, battler.stages),
            effects=self.allow(OPPONENT_HIDDEN, battler.effects),
        )

    def member(
        self, battle: Battle, party_index: int, pokemon: Pokemon, reveals: Reveals
    ) -> KnownMember:
        trainer, slot = owner(battle, party_index)
        return KnownMember(
            party_index=party_index,
            trainer=trainer,
            slot=slot,
            species=self.allow(OPPONENT_SPECIES, pokemon.species),
            shown=self.allow(REVEALED, remembered(reveals, trainer, slot)),
        )

    def battle(self, battle: Battle, reveals: Reveals) -> KnownBattle:
        sides = [*battle.side_effects, [], []]
        able = sum(
            1
            for pokemon in battle.opponent_party
            if pokemon is not None and pokemon.hp > 0 and not pokemon.egg
        )
        return KnownBattle(
            side_sizes=tuple(battle.side_sizes),
            wild=battle.wild,
            balls=battle.balls,
            can_run=battle.can_run,
            opponent=tuple(battle.opponent),
            opponent_ids=tuple(battle.opponent_ids),
            turn=battle.turn,
            decision=battle.decision,
            weather=self.allow(REVEALED, battle.weather),
            weather_duration=self.allow(OPPONENT_HIDDEN, battle.weather_duration),
            terrain=self.allow(REVEALED, battle.terrain),
            terrain_duration=self.allow(OPPONENT_HIDDEN, battle.terrain_duration),
            battlers=tuple(
                self.allow(OWN, battler)
                if battler.side == "player"
                else self.foe(battle, battler, reveals)
                for battler in battle.battlers
            ),
            player_party=self.allow(OWN, tuple(battle.player_party)),
            opponent_party=tuple(
                self.member(battle, party_index, pokemon, reveals)
                for party_index, pokemon in enumerate(battle.opponent_party)
                if pokemon is not None
            ),
            remaining=self.allow(REVEALED, able),
            shown_effects=self.allow(
                REVEALED,
                tuple(
                    KnownEffect(
                        side=effect.side,
                        effect=effect.effect,
                        since_turn=effect.turn,
                        turns=battle.turn - effect.turn,
                        layers=effect.layers,
                    )
                    for effect in reveals.effects
                ),
            ),
            own_side_effects=self.allow(OWN, sides[0]),
            foe_side_effects=self.allow(OPPONENT_HIDDEN, sides[1]),
            field_effects=self.allow(OPPONENT_HIDDEN, battle.field_effects),
        )

    def events(self, events: list[Event]) -> tuple[Event, ...]:
        return tuple(screen_event(event) for event in events if event_tag(event) in self.policy)

    def reveals(self, reveals: Reveals) -> Known[Reveals]:
        return self.allow(REVEALED, reveals)

    def changes(self, changes: StateChanges) -> KnownChanges:
        return KnownChanges(
            items=self.allow(OWN, changes.items),
            money=self.allow(OWN, changes.money),
            vial=self.allow(OWN, changes.vial),
            party=self.allow(OWN, changes.party),
            boxes=self.allow(OWN, changes.boxes),
            position=self.allow(OWN, changes.position),
            switches=self.allow(WORLD, changes.switches),
            variables=self.allow(WORLD, changes.variables),
            self_switches=self.allow(WORLD, changes.self_switches),
        )

    def dialog(self, result: DialogResult) -> KnownDialog:
        return KnownDialog(
            outcome=result.outcome,
            reason=result.reason,
            started=result.started,
            tick=result.tick,
            context=self.allow(OWN, screen_context(result.context)),
            transcript=self.allow(WORLD, result.transcript),
            decision=self.allow(WORLD, result.decision),
            unused=result.unused,
            changes=self.changes(result.changes),
            events=self.events(result.events),
        )

    def menu(self, result: MenuResult) -> KnownMenu:
        return KnownMenu(
            outcome=result.outcome,
            reason=result.reason,
            started=result.started,
            tick=result.tick,
            context=self.allow(OWN, screen_context(result.context)),
            transcript=self.allow(OWN, result.transcript),
            decision=self.allow(OWN, result.decision),
            unused=[answer_text(answer) for answer in result.unused],
            changes=self.changes(result.changes),
            events=self.events(result.events),
        )

    def battler_change(self, was: Battler | None, now: Battler | None) -> KnownBattlerChange | None:
        present = now if now is not None else was
        if present is None:
            return None
        tag, species, _ = shown_battler(present)
        kind: Literal["added", "removed", "changed"] = (
            "added" if was is None else "removed" if now is None else "changed"
        )
        fields: dict[str, Changed[Any]] = {}
        if was is not None and now is not None:
            _, _, before = shown_battler(was)
            _, _, after = shown_battler(now)
            fields = {
                key: Changed(before[key], after[key]) for key in before if before[key] != after[key]
            }
            if not fields:
                return None
        return KnownBattlerChange(
            index=present.index,
            side=present.side,
            change=kind,
            species=self.allow(OWN if present.side == "player" else OPPONENT_SPECIES, species),
            fields=self.allow(tag, fields),
        )

    def battle_changes(
        self, before: Battle | None, after: Battle | None, ended: bool
    ) -> KnownBattleChanges:
        if before is None or after is None:
            return KnownBattleChanges(None, None, None, (), ended)
        old = {battler.index: battler for battler in before.battlers}
        new = {battler.index: battler for battler in after.battlers}
        battlers = (
            self.battler_change(old.get(index), new.get(index))
            for index in sorted(old.keys() | new.keys())
        )
        return KnownBattleChanges(
            turn=changed(before.turn, after.turn),
            weather=self.allow(REVEALED, changed(before.weather, after.weather)),
            terrain=self.allow(REVEALED, changed(before.terrain, after.terrain)),
            battlers=tuple(change for change in battlers if change is not None),
            ended=ended,
        )

    def battle_result(self, result: BattleResult) -> KnownBattleResult:
        return KnownBattleResult(
            outcome=result.outcome,
            reason=result.reason,
            started=result.started,
            tick=result.tick,
            context=self.allow(OWN, screen_context(result.context)),
            transcript=self.allow(REVEALED, result.transcript),
            decision=self.allow(OWN, result.decision),
            battle_outcome=result.battle_outcome,
            battle_changes=self.battle_changes(
                result.battle_before, result.battle_after, result.battle_changes.ended
            ),
            changes=self.changes(result.changes),
            events=self.events(result.events),
        )

    def go(self, result: GoResult) -> KnownGo:
        return KnownGo(
            outcome=result.outcome,
            target=result.target,
            started=result.started,
            tick=result.tick,
            position=self.allow(OWN, result.position),
            reason=result.reason,
            context=self.allow(
                OWN, None if result.context is None else screen_context(result.context)
            ),
            steps=result.steps,
            warps=result.warps,
            replans=result.replans,
            flights=result.flights,
        )

    def state(self, state: GameState) -> KnownState:
        return KnownState(
            tick=state.tick,
            context=self.allow(OWN, screen_context(state.context)),
            trainer=self.allow(OWN, state.trainer),
            party=self.allow(OWN, tuple(state.party)),
            bag=self.allow(OWN, tuple(state.bag)),
            vial=self.allow(OWN, state.vial),
            boxes=self.allow(OWN, tuple(state.boxes)),
            position=self.allow(OWN, state.position),
            transfer=self.allow(OWN, state.transfer),
            battle=None if state.battle is None else self.battle(state.battle, state.reveals),
            command=self.allow(WORLD, state.command),
            switches=self.allow(WORLD, state.switches),
            variables=self.allow(WORLD, state.variables),
            self_switches=self.allow(WORLD, state.self_switches),
            reveals=self.reveals(state.reveals),
            challenge_encs=self.allow(OWN, state.challenge_encs),
            visited=self.allow(OWN, state.visited),
            events=self.events(state.events),
        )


LOOKUPS = {
    "species": KnowledgeView.species,
    "move": KnowledgeView.move,
    "ability": KnowledgeView.ability,
    "item": KnowledgeView.item,
    "type": KnowledgeView.game_type,
    "status": KnowledgeView.status,
    "trainer-type": KnowledgeView.trainer_type,
}
