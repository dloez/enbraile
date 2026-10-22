import logging
import sqlite3
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from typing import Literal

from anil.bridge.protocol import ReadRequest
from anil.harness import gamedb
from anil.harness.gamedb import GameDbError
from anil.harness.investigate import Session
from anil.harness.showdown import export_party
from anil.harness.state import GameState, Ledger, Pokemon, read_state
from anil.harness.steps import note
from anil.harness.storage import Deposit, PcOp, Withdraw, op_text

VITAMINS = ("HPUP", "PROTEIN", "IRON", "CALCIUM", "ZINC", "CARBOS")
FEATHERS = tuple(
    f"{name}FEATHER" for name in ("HEALTH", "MUSCLE", "RESIST", "GENIUS", "CLEVER", "SWIFT")
)
CHAPAS = ("SCapsula", "ACapsula", "DCapsula", "AECapsula", "DECapsula", "VCapsula")
MOCHIS = tuple(
    f"{name}MOCHI" for name in ("HEALTH", "MUSCLE", "RESIST", "GENIUS", "CLEVER", "SWIFT")
)
RESET_MOCHI = "FRESHSTARTMOCHI"
EV_BERRIES = (
    "POMEGBERRY",
    "KELPSYBERRY",
    "QUALOTBERRY",
    "HONDEWBERRY",
    "GREPABERRY",
    "TAMATOBERRY",
)
POWER_ITEMS = (
    "POWERWEIGHT",
    "POWERBRACER",
    "POWERBELT",
    "POWERLENS",
    "POWERBAND",
    "POWERANKLET",
)
MACHO_BRACE = "MACHOBRACE"
EV_IV_USE_ITEMS = frozenset(
    item.upper() for item in (*VITAMINS, *FEATHERS, *CHAPAS, *MOCHIS, RESET_MOCHI, *EV_BERRIES)
)
EV_HELD_ITEMS = frozenset((*POWER_ITEMS, MACHO_BRACE))

SHOP_HELD_ITEMS = (
    "FOCUSSASH",
    "REDCARD",
    "WHITEHERB",
    "POWERHERB",
    "EJECTBUTTON",
    "KINGSROCK",
    "SCOPELENS",
    "ZOOMLENS",
    "WIDELENS",
    "BRIGHTPOWDER",
)
SHOP_GEMS = tuple(
    f"{kind}GEM"
    for kind in (
        "NORMAL",
        "FIRE",
        "WATER",
        "ELECTRIC",
        "GRASS",
        "ICE",
        "FIGHTING",
        "POISON",
        "GROUND",
        "FLYING",
        "PSYCHIC",
        "BUG",
        "ROCK",
        "GHOST",
        "DRAGON",
        "DARK",
        "STEEL",
        "FAIRY",
    )
)
SHOP_INCENSES = tuple(
    f"{kind}INCENSE"
    for kind in ("LAX", "FULL", "LUCK", "PURE", "SEA", "ROSE", "WAVE", "ODD", "ROCK")
)
SHOP_PINCH_BERRIES = tuple(
    f"{kind}BERRY"
    for kind in (
        "FIGY",
        "WIKI",
        "MAGO",
        "AGUAV",
        "IAPAPA",
        "LIECHI",
        "GANLON",
        "SALAC",
        "PETAYA",
        "APICOT",
        "LANSAT",
        "STARF",
        "ENIGMA",
        "MICLE",
        "CUSTAP",
        "JABOCA",
        "ROWAP",
        "KEE",
        "MARANGA",
    )
)
SHOP_RESIST_BERRIES = tuple(
    f"{kind}BERRY"
    for kind in (
        "OCCA",
        "PASSHO",
        "WACAN",
        "RINDO",
        "YACHE",
        "SHUCA",
        "CHARTI",
        "COBA",
        "CHOPLE",
        "PAYAPA",
        "KEBIA",
        "TANGA",
        "KASIB",
        "HABAN",
        "COLBUR",
        "BABIRI",
        "ROSELI",
    )
)
SHOP_LEGENDARY_HELD_ITEMS = (
    "SOULDEW",
    "ADAMANTCRYSTAL",
    "LUSTROUSGLOBE",
    "GRISEOUSCORE",
    "REDORB",
    "BLUEORB",
    "WELLSPRINGMASK",
    "HEARTHFLAMEMASK",
    "CORNERSTONEMASK",
    "BOOSTERENERGY",
    "BURNDRIVE",
    "DOUSEDRIVE",
    "SHOCKDRIVE",
    "CHILLDRIVE",
    *(
        f"{kind}MEMORY"
        for kind in (
            "FIRE",
            "WATER",
            "ELECTRIC",
            "GRASS",
            "ICE",
            "FIGHTING",
            "POISON",
            "GROUND",
            "FLYING",
            "PSYCHIC",
            "BUG",
            "ROCK",
            "GHOST",
            "DRAGON",
            "DARK",
            "STEEL",
            "FAIRY",
        )
    ),
)
COMPETITIVE_ITEMS = frozenset(
    (
        *SHOP_HELD_ITEMS,
        *SHOP_GEMS,
        *SHOP_INCENSES,
        *SHOP_PINCH_BERRIES,
        *SHOP_RESIST_BERRIES,
        *SHOP_LEGENDARY_HELD_ITEMS,
    )
)

DAY_CARE_DEPOSIT = (49, 4)
PUNCH_BAG_EVENTS = frozenset({(117, 19), (117, 20)})
SHINY_LIMIT = 6
LEGENDARY_FLAGS = frozenset({"Legendary", "Mythical"})
BALL_FLAG = "PokeBall"
HEALING_FLAG = "Healing"
SLEEP_FUNCTION_CODES = frozenset({"SleepTarget", "SleepTargetIfUserDarkrai", "SleepTargetNextTurn"})
STATUS_CATEGORY = 2
OHKO_FUNCTION_PREFIX = "OHKO"
EVASION_MOVES = frozenset({"DOUBLETEAM", "MINIMIZE"})
SLEEP_STATUS = "SLEEP"
STORE_PAYLOAD = "store"
RULES_KIND = "rules"
FREEZE_CALL = "AnilBridge.rules_freeze"
LEVELLING_ITEMS = frozenset(
    {"RARECANDY", "EXPCANDYXS", "EXPCANDYS", "EXPCANDYM", "EXPCANDYL", "EXPCANDYXL"}
)
GIFT_KIND = "gift_pokemon"
GYMS = 8

SHOP_RULE = "At most one of each competitive item bought"
HEALING_RULE = "Marts don't sell healing items"
EV_RULE = "No changing EVs or IVs"
BREEDING_RULE = "No breeding"
LEGENDARY_RULE = "Legendaries and mythicals are never used"
SHINY_LIMIT_RULE = "At most 6 shinies"
SHINY_PARTY_RULE = "A living shiny always in the party"
SLEEP_RULE = "Sleep Clause"
OHKO_RULE = "OHKO Clause"
EVASION_RULE = "Evasion Moves Clause"
PASTE_RULE = "A pokepaste made right after each gym"
SPECIES_RULE = "Species Clause"

type Blocked = Literal["walk", "interact", "freeze"]
BATTLE_STARTERS: tuple[Blocked, ...] = ("walk", "interact")


@dataclass(frozen=True)
class Buy:
    orders: tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class UseItem:
    item: str
    slot: int


@dataclass(frozen=True)
class GiveItem:
    item: str
    slot: int


@dataclass(frozen=True)
class TakeItem:
    slot: int


@dataclass(frozen=True)
class Swap:
    a: int
    b: int


@dataclass(frozen=True)
class Vial:
    pass


@dataclass(frozen=True)
class Pc:
    ops: tuple[PcOp, ...]


@dataclass(frozen=True)
class Interact:
    map_id: int
    event_id: int


@dataclass(frozen=True)
class Walk:
    map_id: int | None


@dataclass(frozen=True)
class ContinueDialog:
    pass


@dataclass(frozen=True)
class ContinueMenu:
    pass


@dataclass(frozen=True)
class Save:
    pass


@dataclass(frozen=True)
class Sell:
    orders: tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class SetExpShare:
    slot: int
    on: bool


@dataclass(frozen=True)
class Fly:
    town: str


@dataclass(frozen=True)
class ContinueBattle:
    pass


@dataclass(frozen=True)
class Run:
    pass


@dataclass(frozen=True)
class Switch:
    slot: int


@dataclass(frozen=True)
class BattleItem:
    item: str


@dataclass(frozen=True)
class Fight:
    move: str


@dataclass(frozen=True)
class Store:
    slot: int | None


@dataclass(frozen=True)
class Choose:
    slot: int | None
    storing: bool


@dataclass(frozen=True)
class Relearn:
    moves: tuple[str, ...]


type Action = (
    Buy
    | UseItem
    | GiveItem
    | TakeItem
    | Swap
    | Vial
    | Pc
    | Interact
    | Walk
    | ContinueDialog
    | ContinueMenu
    | Save
    | Sell
    | SetExpShare
    | Fly
    | ContinueBattle
    | Run
    | Switch
    | BattleItem
    | Fight
    | Store
    | Choose
    | Relearn
)


@dataclass(frozen=True)
class Verdict:
    allowed: bool
    rule: str | None = None
    reason: str | None = None


ALLOWED = Verdict(True)


@dataclass(frozen=True)
class Obligation:
    duty: str
    rule: str
    reason: str
    blocks: tuple[Blocked, ...]

    @property
    def blocking(self) -> bool:
        return bool(self.blocks)


@dataclass(frozen=True)
class Facts:
    state: GameState
    legendary: frozenset[str]
    balls: frozenset[str]
    healing: frozenset[str]
    sleep_moves: frozenset[str]
    ohko_moves: frozenset[str]
    gifts: frozenset[tuple[int, int]]
    fleeable: bool

    @property
    def ledger(self) -> Ledger:
        return self.state.ledger

    @property
    def frozen(self) -> int:
        return len(set(self.ledger.frozen))


class RulesError(Exception):
    pass


@dataclass(frozen=True)
class Audit:
    tick: int
    obligations: list[Obligation]
    shinies: list[int]
    excess: list[int]
    competitive: dict[str, int]
    badges: int
    frozen: int
    pending: int | None


@dataclass(frozen=True)
class Freeze:
    verdict: Verdict
    gym: int | None
    paste: str | None


log = logging.getLogger("harness.rules")


def owned(state: GameState) -> list[Pokemon]:
    return [*state.party, *(stored.pokemon for stored in state.boxes)]


def shinies(facts: Facts) -> list[int]:
    found = list(facts.ledger.shinies)
    for pokemon in owned(facts.state):
        if pokemon.shiny and not pokemon.egg and pokemon.personal_id not in found:
            found.append(pokemon.personal_id)
    return found


def counted_shinies(facts: Facts) -> list[int]:
    return shinies(facts)[:SHINY_LIMIT]


def excess_shinies(facts: Facts) -> frozenset[int]:
    return frozenset(shinies(facts)[SHINY_LIMIT:])


def living(pokemon: Pokemon) -> bool:
    return not pokemon.egg and pokemon.hp > 0


def name_of(pokemon: Pokemon) -> str:
    return pokemon.nickname or pokemon.species.name or pokemon.species.id


def unusable(facts: Facts, pokemon: Pokemon) -> str | None:
    if pokemon.egg:
        return None
    if pokemon.species.id in facts.legendary:
        return f"{name_of(pokemon)} is a legendary or mythical"
    if pokemon.personal_id in excess_shinies(facts):
        return f"{name_of(pokemon)} is a shiny past the 6th"
    return None


def usable_shiny(facts: Facts, pokemon: Pokemon) -> bool:
    return pokemon.shiny and living(pokemon) and unusable(facts, pokemon) is None


def lead(party: Sequence[Pokemon]) -> Pokemon | None:
    return next((pokemon for pokemon in party if living(pokemon)), None)


def lead_refusal(facts: Facts, party: Sequence[Pokemon]) -> Verdict | None:
    first = lead(party)
    reason = None if first is None else unusable(facts, first)
    if reason is None:
        return None
    return Verdict(False, LEGENDARY_RULE, f"{reason} and would lead the party")


def shiny_refusal(
    facts: Facts, before: Sequence[Pokemon], after: Sequence[Pokemon]
) -> Verdict | None:
    if not any(usable_shiny(facts, pokemon) for pokemon in before):
        return None
    if any(usable_shiny(facts, pokemon) for pokemon in after):
        return None
    return Verdict(False, SHINY_PARTY_RULE, "it would leave no living shiny in the party")


def badges(state: GameState) -> int:
    return 0 if state.trainer is None else sum(state.trainer.badges)


def pending_gym(facts: Facts) -> int | None:
    if badges(facts.state) > facts.frozen and facts.frozen < GYMS:
        return facts.frozen + 1
    return None


def freeze_refusal(facts: Facts, what: str) -> Verdict | None:
    gym = pending_gym(facts)
    if gym is None:
        return None
    return Verdict(False, PASTE_RULE, f"no {what} until gym {gym}'s paste is frozen")


def audit(facts: Facts) -> list[Obligation]:
    state = facts.state
    found: list[Obligation] = []
    gym = pending_gym(facts)
    if gym is not None:
        found.append(
            Obligation(
                "freeze the paste",
                PASTE_RULE,
                f"{badges(state)} badges and {facts.frozen} pastes frozen: gym {gym}'s is due",
                (),
            )
        )
    for slot, pokemon in enumerate(state.party):
        if pokemon.item is not None and pokemon.item.id in EV_HELD_ITEMS:
            found.append(
                Obligation(
                    "take the item",
                    EV_RULE,
                    f"{name_of(pokemon)} in party slot {slot} holds "
                    f"{pokemon.item.name or pokemon.item.id}",
                    BATTLE_STARTERS,
                )
            )
    for slot, pokemon in enumerate(state.party):
        reason = unusable(facts, pokemon)
        if reason is not None:
            found.append(
                Obligation(
                    "deposit at the next PC",
                    LEGENDARY_RULE,
                    f"{reason}, in party slot {slot}",
                    ("freeze",),
                )
            )
    first = lead(state.party)
    reason = None if first is None else unusable(facts, first)
    if reason is not None:
        found.append(
            Obligation(
                "move it off the lead",
                LEGENDARY_RULE,
                f"{reason} and leads the party",
                BATTLE_STARTERS,
            )
        )
    excess = excess_shinies(facts)
    for pokemon in owned(state):
        if pokemon.personal_id in excess:
            found.append(
                Obligation(
                    "release at the next PC",
                    SHINY_LIMIT_RULE,
                    f"{name_of(pokemon)} is a shiny past the 6th",
                    (),
                )
            )
    if not any(usable_shiny(facts, pokemon) for pokemon in state.party):
        stored = next((entry for entry in state.boxes if usable_shiny(facts, entry.pokemon)), None)
        if stored is not None:
            found.append(
                Obligation(
                    "withdraw at the next PC",
                    SHINY_PARTY_RULE,
                    f"{name_of(stored.pokemon)} in box {stored.box} slot {stored.slot} is the "
                    "living shiny the party lacks",
                    ("freeze",),
                )
            )
    return found


def blocked(facts: Facts, kind: Blocked) -> Verdict | None:
    for obligation in audit(facts):
        if kind in obligation.blocks:
            return Verdict(
                False,
                obligation.rule,
                f"{obligation.duty} first: {obligation.reason}",
            )
    return None


def check_buy(facts: Facts, action: Buy) -> Verdict:
    ordered: dict[str, int] = {}
    for item, count in action.orders:
        ordered[item.upper()] = ordered.get(item.upper(), 0) + count
    if facts.state.challenge_queued and ordered.keys() & facts.balls:
        healing = sorted(ordered.keys() & facts.healing)
        if healing:
            return Verdict(
                False,
                HEALING_RULE,
                f"{', '.join(healing)} would be bought on the visit whose Poké Balls start the "
                "challenge; buy the Poké Balls alone",
            )
    for item, count in ordered.items():
        if item not in COMPETITIVE_ITEMS:
            continue
        bought = facts.ledger.bought.get(item, 0)
        if bought + count > 1:
            return Verdict(
                False,
                SHOP_RULE,
                f"{item} is a competitive item: {bought} bought already, {count} in this buy would "
                "pass one",
            )
    return ALLOWED


def check_pc(facts: Facts, action: Pc) -> Verdict:
    state = facts.state
    party = list(state.party)
    stored = {(entry.box, entry.slot): entry.pokemon for entry in state.boxes}
    for op in action.ops:
        if isinstance(op, Withdraw):
            pokemon = stored.pop((op.box, op.slot), None)
            if pokemon is None:
                continue
            if pokemon.egg:
                frozen = freeze_refusal(facts, "withdrawing an egg")
                if frozen is not None:
                    return Verdict(False, frozen.rule, f"{op_text(op)}: {frozen.reason}")
            reason = unusable(facts, pokemon)
            if reason is not None:
                return Verdict(False, LEGENDARY_RULE, f"{op_text(op)}: {reason}")
            party.append(pokemon)
        elif isinstance(op, Deposit):
            if 0 <= op.pokemon < len(party):
                party.pop(op.pokemon)
        else:
            pokemon = stored.pop(op.source, None)
            if pokemon is None:
                continue
            stored[op.target] = pokemon
    return lead_refusal(facts, party) or shiny_refusal(facts, state.party, party) or ALLOWED


def check_swap(facts: Facts, action: Swap) -> Verdict:
    party = list(facts.state.party)
    if not (0 <= action.a < len(party) and 0 <= action.b < len(party)):
        return ALLOWED
    party[action.a], party[action.b] = party[action.b], party[action.a]
    return lead_refusal(facts, party) or ALLOWED


def check_interact(facts: Facts, action: Interact) -> Verdict:
    event = (action.map_id, action.event_id)
    if event == DAY_CARE_DEPOSIT:
        return Verdict(False, BREEDING_RULE, "no Pokémon is left at the Day Care")
    if event in PUNCH_BAG_EVENTS:
        return Verdict(False, EV_RULE, "the punch-bag training changes EVs")
    if event in facts.gifts:
        verdict = freeze_refusal(facts, "Pokémon gift")
        if verdict is not None:
            return verdict
    return blocked(facts, "interact") or ALLOWED


def check_dialog(facts: Facts) -> Verdict:
    state = facts.state
    event = (
        None
        if state.command is None or state.position is None
        else (state.position.map_id, state.command.event_id)
    )
    if event in facts.gifts:
        verdict = freeze_refusal(facts, "Pokémon gift")
        if verdict is not None:
            return verdict
    return ALLOWED


def check_walk(facts: Facts, action: Walk) -> Verdict:
    return blocked(facts, "walk") or ALLOWED


def battle_party(state: GameState) -> list[Pokemon]:
    if state.battle is None:
        return list(state.party)
    return [pokemon for pokemon in state.battle.player_party if pokemon is not None]


def check_switch(facts: Facts, action: Switch) -> Verdict:
    party = battle_party(facts.state)
    if not 0 <= action.slot < len(party):
        return ALLOWED
    reason = unusable(facts, party[action.slot])
    if reason is None:
        return ALLOWED
    return Verdict(False, LEGENDARY_RULE, f"{reason} and never battles")


def check_battle_item(facts: Facts, action: BattleItem) -> Verdict:
    battle = facts.state.battle
    if action.item.upper() not in facts.balls or battle is None or not battle.wild:
        return ALLOWED
    frozen = freeze_refusal(facts, "catching")
    if frozen is not None:
        return frozen
    shiny_foe = any(
        battler.side == "opponent" and battler.shiny and not battler.fainted
        for battler in battle.battlers
    )
    count = len(counted_shinies(facts))
    if shiny_foe and count >= SHINY_LIMIT:
        return Verdict(
            False,
            SHINY_LIMIT_RULE,
            f"{count} shinies already; a seventh is not caught",
        )
    return ALLOWED


def check_fight(facts: Facts, action: Fight) -> Verdict:
    move = action.move.upper()
    if move in facts.ohko_moves:
        return Verdict(False, OHKO_RULE, f"{move} is a one-hit KO move")
    if move in EVASION_MOVES:
        return Verdict(False, EVASION_RULE, f"{move} raises evasion")
    battle = facts.state.battle
    if battle is not None and battle.wild and facts.fleeable:
        frozen = freeze_refusal(facts, "fighting a wild battle that can be fled")
        if frozen is not None:
            return frozen
    if move not in facts.sleep_moves or battle is None:
        return ALLOWED
    asleep = [
        facts.ledger.sleep[pokemon.personal_id]
        for pokemon in battle.opponent_party
        if pokemon is not None
        and living(pokemon)
        and pokemon.status.id == SLEEP_STATUS
        and pokemon.personal_id in facts.ledger.sleep
    ]
    if not asleep:
        return ALLOWED
    return Verdict(
        False,
        SLEEP_RULE,
        f"an opposing Pokémon is still asleep from our {asleep[0]}",
    )


@dataclass(frozen=True)
class Caught:
    species: str
    shiny: bool
    personal_id: int | None


def caught(state: GameState) -> Caught | None:
    payload = next(
        (entry for entry in reversed(state.context.payloads) if entry.get("kind") == STORE_PAYLOAD),
        None,
    )
    if payload is None or payload.get("species") is None:
        return None
    personal_id = payload.get("personal_id")
    return Caught(
        str(payload["species"]),
        bool(payload.get("shiny")),
        personal_id if isinstance(personal_id, int) else None,
    )


def caught_unusable(facts: Facts, catch: Caught) -> bool:
    if catch.species in facts.legendary:
        return True
    if not catch.shiny:
        return False
    found = shinies(facts)
    if catch.personal_id in found:
        return catch.personal_id in excess_shinies(facts)
    return len(found) >= SHINY_LIMIT


def check_store(facts: Facts, action: Store) -> Verdict:
    catch = caught(facts.state)
    if catch is None:
        return ALLOWED
    party = list(facts.state.party)
    if action.slot is not None and not 0 <= action.slot < len(party):
        return ALLOWED
    kept = party if action.slot is None else party[: action.slot] + party[action.slot + 1 :]
    joins = action.slot is not None
    usable_catch = not caught_unusable(facts, catch)
    if joins and lead(kept) is None and not usable_catch:
        return Verdict(
            False,
            LEGENDARY_RULE,
            f"the catch {catch.species} would lead the party and is never used",
        )
    if joins:
        verdict = lead_refusal(facts, kept)
        if verdict is not None:
            return verdict
    after = any(usable_shiny(facts, pokemon) for pokemon in kept) or (
        joins and catch.shiny and usable_catch
    )
    if after:
        return ALLOWED
    if any(usable_shiny(facts, pokemon) for pokemon in party):
        return Verdict(False, SHINY_PARTY_RULE, "it would leave no living shiny in the party")
    if catch.shiny and usable_catch:
        return Verdict(
            False,
            SHINY_PARTY_RULE,
            "the shiny catch must join the party; send a party member to a box instead",
        )
    return ALLOWED


def check_choose(facts: Facts, action: Choose) -> Verdict:
    party = list(facts.state.party)
    if not action.storing or action.slot is None or not 0 <= action.slot < len(party):
        return ALLOWED
    kept = party[: action.slot] + party[action.slot + 1 :]
    if any(usable_shiny(facts, pokemon) for pokemon in party) and not any(
        usable_shiny(facts, pokemon) for pokemon in kept
    ):
        return Verdict(False, SHINY_PARTY_RULE, "it would leave no living shiny in the party")
    return ALLOWED


def check(action: Action, facts: Facts) -> Verdict:
    match action:
        case Buy():
            return check_buy(facts, action)
        case UseItem(item=item):
            if item.upper() in EV_IV_USE_ITEMS:
                return Verdict(False, EV_RULE, f"{item} changes EVs or IVs")
            if item.upper() in LEVELLING_ITEMS:
                frozen = freeze_refusal(facts, "levelling")
                if frozen is not None:
                    return frozen
            return ALLOWED
        case GiveItem(item=item):
            if item.upper() in EV_HELD_ITEMS:
                return Verdict(False, EV_RULE, f"{item} changes the EVs a battle gives")
            return ALLOWED
        case Swap():
            return check_swap(facts, action)
        case Pc():
            return check_pc(facts, action)
        case Interact():
            return check_interact(facts, action)
        case Walk():
            return check_walk(facts, action)
        case ContinueDialog():
            return check_dialog(facts)
        case (
            TakeItem()
            | Vial()
            | ContinueMenu()
            | Save()
            | Sell()
            | SetExpShare()
            | ContinueBattle()
            | Run()
            | Relearn()
        ):
            return ALLOWED
        case Fly():
            return blocked(facts, "walk") or ALLOWED
        case Switch():
            return check_switch(facts, action)
        case BattleItem():
            return check_battle_item(facts, action)
        case Fight():
            return check_fight(facts, action)
        case Store():
            return check_store(facts, action)
        case Choose():
            return check_choose(facts, action)


def legendary_species(connection: sqlite3.Connection, species: Iterable[str]) -> frozenset[str]:
    found = set()
    for species_id in set(species):
        try:
            flags = gamedb.species(connection, species_id).flags
        except GameDbError as error:
            raise RulesError(f"species {species_id} is not in the game database") from error
        if LEGENDARY_FLAGS & set(flags):
            found.add(species_id)
    return frozenset(found)


def flagged_items(connection: sqlite3.Connection, flag: str) -> frozenset[str]:
    return frozenset(
        entry.id.upper()
        for entry in gamedb.entries(connection, "items")
        if flag in entry.raw["@flags"]
    )


def battle_moves(connection: sqlite3.Connection) -> tuple[frozenset[str], frozenset[str]]:
    sleep = set()
    ohko = set()
    for entry in gamedb.entries(connection, "moves"):
        code = entry.raw["@function_code"]
        if code in SLEEP_FUNCTION_CODES and entry.raw["@category"] == STATUS_CATEGORY:
            sleep.add(entry.id.upper())
        if code.startswith(OHKO_FUNCTION_PREFIX):
            ohko.add(entry.id.upper())
    return frozenset(sleep), frozenset(ohko)


def gift_events(connection: sqlite3.Connection) -> frozenset[tuple[int, int]]:
    return frozenset(
        (found.map_id, found.event_id)
        for found in gamedb.locations(connection)
        if found.kind == GIFT_KIND
    )


def facts(state: GameState, connection: sqlite3.Connection, fleeable: bool = False) -> Facts:
    seen = [pokemon.species.id for pokemon in owned(state)]
    if state.battle is not None:
        seen += [pokemon.species.id for pokemon in battle_party(state)]
    catch = caught(state)
    if catch is not None:
        seen.append(catch.species)
    sleep, ohko = battle_moves(connection)
    return Facts(
        state,
        legendary_species(connection, seen),
        flagged_items(connection, BALL_FLAG),
        flagged_items(connection, HEALING_FLAG),
        sleep,
        ohko,
        gift_events(connection),
        fleeable,
    )


def fleeable(session: Session, state: GameState) -> bool:
    battle = state.battle
    if battle is None or not battle.wild:
        return False
    index = next(
        (
            battler.index
            for battler in battle.battlers
            if battler.side == "player" and not battler.fainted
        ),
        None,
    )
    if index is None:
        return False
    path = ("refusal", f"AnilBridge.run_refusal({index})")
    read = session.read(ReadRequest(paths=[path], depth=1)).value
    if read.errors:
        raise RulesError(f"reading {path[1]} failed: {read.errors}")
    return read.values.get("refusal") is None


def live_facts(session: Session, connection: sqlite3.Connection) -> Facts:
    state = read_state(session)
    return facts(state, connection, fleeable(session, state))


def action_text(action: Action) -> str:
    match action:
        case Buy(orders=orders):
            return "buy " + " ".join(f"{item}:{count}" for item, count in orders)
        case UseItem(item=item, slot=slot):
            return f"use {item} on {slot}"
        case GiveItem(item=item, slot=slot):
            return f"give {item} to {slot}"
        case TakeItem(slot=slot):
            return f"take from {slot}"
        case Swap(a=a, b=b):
            return f"swap {a} {b}"
        case Vial():
            return "vial"
        case Pc(ops=ops):
            return "pc " + " ".join(op_text(op) for op in ops)
        case Interact(map_id=map_id, event_id=event_id):
            return f"interact {map_id} {event_id}"
        case Walk(map_id=map_id):
            return "walk" if map_id is None else f"walk to map {map_id}"
        case ContinueDialog():
            return "dialog"
        case ContinueMenu():
            return "menu"
        case Save():
            return "save"
        case Sell(orders=orders):
            return "sell " + " ".join(f"{item}:{count}" for item, count in orders)
        case SetExpShare(slot=slot, on=on):
            return f"exp share {'on' if on else 'off'} for {slot}"
        case Fly(town=town):
            return f"fly to {town}"
        case ContinueBattle():
            return "battle"
        case Run():
            return "run"
        case Switch(slot=slot):
            return f"switch {slot}"
        case BattleItem(item=item):
            return f"battle item {item}"
        case Fight(move=move):
            return f"fight {move}"
        case Store(slot=slot):
            return "store to a box" if slot is None else f"store sending {slot} to a box"
        case Choose(slot=slot, storing=storing):
            chosen = "none" if slot is None else str(slot)
            return f"choose {chosen}" + (" to send to a box" if storing else "")
        case Relearn(moves=moves):
            return "relearn " + " ".join(moves) if moves else "leave the relearner"


def obligation_fields(obligation: Obligation) -> dict[str, object]:
    return {**asdict(obligation), "blocks": list(obligation.blocks)}


def log_forced(session: Session, known: Facts, action: Action) -> None:
    battle = known.state.battle
    gym = pending_gym(known)
    if gym is None or battle is None or not isinstance(action, Fight):
        return
    note(
        session,
        RULES_KIND,
        "forced",
        action=action_text(action),
        gym=gym,
        opponent=battle.opponent if not battle.wild else "wild",
        party=[
            {"species": pokemon.species.id, "level": pokemon.level, "exp": pokemon.exp}
            for pokemon in known.state.party
        ],
        state_tick=known.state.tick,
    )


def guard(session: Session, connection: sqlite3.Connection, action: Action) -> Verdict:
    known = live_facts(session, connection)
    verdict = check(action, known)
    note(
        session,
        RULES_KIND,
        "check",
        action=action_text(action),
        allowed=verdict.allowed,
        rule=verdict.rule,
        reason=verdict.reason,
        state_tick=known.state.tick,
    )
    if verdict.allowed:
        log.info("%s allowed", action_text(action))
        log_forced(session, known, action)
    else:
        log.info("%s refused by %s: %s", action_text(action), verdict.rule, verdict.reason)
    return verdict


def summary(known: Facts) -> Audit:
    state = known.state
    return Audit(
        state.tick,
        audit(known),
        counted_shinies(known),
        sorted(excess_shinies(known)),
        {
            item: count
            for item, count in sorted(state.ledger.bought.items())
            if item in COMPETITIVE_ITEMS
        },
        badges(state),
        known.frozen,
        pending_gym(known),
    )


def run_audit(session: Session, connection: sqlite3.Connection) -> Audit:
    state = read_state(session)
    found = summary(facts(state, connection))
    note(
        session,
        RULES_KIND,
        "audit",
        obligations=[obligation_fields(obligation) for obligation in found.obligations],
        shinies=found.shinies,
        excess=found.excess,
        competitive=found.competitive,
        badges=found.badges,
        frozen=found.frozen,
        pending=found.pending,
        state_tick=state.tick,
    )
    return found


def frozen_team(state: GameState) -> list[Pokemon]:
    return [pokemon for pokemon in state.party if living(pokemon)]


def species_refusal(team: Sequence[Pokemon]) -> Verdict | None:
    seen: dict[str, str] = {}
    for pokemon in team:
        if pokemon.species.id in seen:
            return Verdict(
                False,
                SPECIES_RULE,
                f"{seen[pokemon.species.id]} and {name_of(pokemon)} are both "
                f"{pokemon.species.name or pokemon.species.id}",
            )
        seen[pokemon.species.id] = name_of(pokemon)
    return None


def freeze_check(facts: Facts) -> Verdict:
    state = facts.state
    if pending_gym(facts) is None:
        return Verdict(
            False,
            PASTE_RULE,
            f"no freeze is pending: {badges(state)} badges and {facts.frozen} pastes frozen",
        )
    if state.battle is not None:
        return Verdict(False, PASTE_RULE, "the paste is not frozen in a battle")
    team = frozen_team(state)
    if not team:
        return Verdict(False, PASTE_RULE, "the party has no living Pokémon to freeze")
    standing = blocked(facts, "freeze")
    if standing is not None:
        return standing
    return species_refusal(team) or ALLOWED


def run_freeze(session: Session, connection: sqlite3.Connection) -> Freeze:
    state = read_state(session)
    known = facts(state, connection)
    verdict = freeze_check(known)
    gym = pending_gym(known)
    paste = None
    if verdict.allowed and gym is not None:
        paste = export_party(session)
        result = session.eval(f"{FREEZE_CALL}({gym})").value
        if result.class_name != "Integer":
            raise RulesError(f"recording gym {gym}'s freeze in the save failed: {result.inspect}")
        log.info("gym %s's paste frozen at tick %s", gym, state.tick)
    else:
        log.info("freeze refused by %s: %s", verdict.rule, verdict.reason)
    note(
        session,
        RULES_KIND,
        "freeze",
        allowed=verdict.allowed,
        rule=verdict.rule,
        reason=verdict.reason,
        gym=gym,
        state_tick=state.tick,
    )
    return Freeze(verdict, gym if verdict.allowed else None, paste)
