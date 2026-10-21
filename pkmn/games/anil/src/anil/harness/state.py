from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ValidationError

from anil.bridge.protocol import Event, ReadRequest, ShownFact
from anil.harness.context import UNKNOWN, Context, classify, log_unknown
from anil.harness.investigate import Answer, Session

type Raw = Any

ID_SEPARATOR = ":"
NAMES_FILE = "names.json"
GAME_DATA = {
    "species": "Species",
    "moves": "Move",
    "items": "Item",
    "abilities": "Ability",
    "types": "Type",
    "natures": "Nature",
    "statuses": "Status",
}
NO_STATUS = "NONE"
STATE_DEPTH = 10
OPPONENT_DEPTH = 3
FACINGS = {2: "down", 4: "left", 6: "right", 8: "up"}
POKEMON_CALLS = [
    "name",
    "level",
    "nature_id",
    "ability_id",
    "gender",
    "form",
    "shiny?",
    "egg?",
    "types",
]
BATTLER_CALLS = ["name", "displaySpecies", "displayGender", "displayForm", "shiny?"]
STOP_CLASSES = ["Battle", "Battle::Scene"]
MAX_BATTLERS = 6
DATABOX_DEPTH = 2
DATABOX_PREFIX = "battle.databox."
INTERPRETER_RUNNING = ("interpreter.running", "$game_system.map_interpreter.running?")
REVEALS = ("reveals", "$PokemonGlobal@anil_reveals")
BADGES = ("trainer.badges", "$player@badges")
LEDGER = ("ledger", "$PokemonGlobal@anil_rules")
CHALLENGE_ENCS = ("challenge_encs", "$PokemonGlobal.challenge_encs")
CHALLENGE_QUEUED = ("challenge_queued", "$PokemonGlobal.challenge_qued")
VISITED = ("visited", "$PokemonGlobal.visitedMaps", 1)
ROCK_CLIMBING = ("rock_climbing", "$PokemonGlobal.rockclimb")
LIVE_BATTLE = "AnilBridge.battle"
LAST_BATTLE = "AnilBridge.last_battle"
STATE_CALLS = {
    "Pokemon": POKEMON_CALLS,
    "Pokemon::Move": ["total_pp"],
    "Battle::Move": ["total_pp"],
    "Battle::Battler": BATTLER_CALLS,
}


class StateError(Exception):
    pass


class Names(BaseModel):
    species: dict[str, str]
    moves: dict[str, str]
    items: dict[str, str]
    abilities: dict[str, str]
    types: dict[str, str]
    natures: dict[str, str]
    statuses: dict[str, str]
    pockets: list[str]


class Named(BaseModel):
    id: str
    name: str | None


class Stats(BaseModel):
    hp: int
    attack: int
    defense: int
    speed: int
    special_attack: int
    special_defense: int


class Move(BaseModel):
    move: Named
    pp: int
    total_pp: int
    pp_ups: int | None


class Pokemon(BaseModel):
    personal_id: int
    species: Named
    form: int
    nickname: str
    level: int
    exp: int
    gender: int
    shiny: bool
    egg: bool
    types: list[Named]
    hp: int
    stats: Stats
    ivs: Stats
    evs: Stats
    nature: Named
    ability: Named | None
    item: Named | None
    status: Named
    moves: list[Move]
    happiness: int
    exp_share: bool
    obtain_map: int | None = None


class Trainer(BaseModel):
    name: str
    id: int
    public_id: int
    money: int
    badges: list[bool]
    save_slot: str | None


class Vial(BaseModel):
    charges: int
    max_charges: int
    locked: bool


class Pocket(BaseModel):
    index: int
    name: str | None
    items: list[tuple[Named, int]]


class Stored(BaseModel):
    box: int
    box_name: str
    slot: int
    pokemon: Pokemon


class Position(BaseModel):
    map_id: int
    map_name: str | None
    x: int
    y: int
    facing: str
    moving: bool


class Transfer(BaseModel):
    map_id: int
    x: int
    y: int
    facing: str | None


BATTLER_EFFECTS = {
    "helping_hand": "HelpingHand",
    "me_first": "MeFirst",
    "charge": "Charge",
    "minimize": "Minimize",
    "glaive_rush": "GlaiveRush",
    "substitute": "Substitute",
    "two_turn_attack": "TwoTurnAttack",
    "sky_drop": "SkyDrop",
    "gastro_acid": "GastroAcid",
    "embargo": "Embargo",
    "magnet_rise": "MagnetRise",
    "telekinesis": "Telekinesis",
    "ingrain": "Ingrain",
    "smack_down": "SmackDown",
    "roost": "Roost",
    "burn_up": "BurnUp",
    "double_shock": "DoubleShock",
    "extra_type": "ExtraType",
    "weight_change": "WeightChange",
    "foresight": "Foresight",
    "miracle_eye": "MiracleEye",
    "tar_shot": "TarShot",
    "electrify": "Electrify",
    "laser_focus": "LaserFocus",
    "fury_cutter": "FuryCutter",
    "rollout": "Rollout",
    "defense_curl": "DefenseCurl",
    "stockpile": "Stockpile",
    "unburden": "Unburden",
    "slow_start": "SlowStart",
    "paradox_stat": "ParadoxStat",
    "transformed": "Transform",
    "focus_energy": "FocusEnergy",
    "confusion": "Confusion",
    "toxic": "Toxic",
    "heal_block": "HealBlock",
    "aqua_ring": "AquaRing",
    "leech_seed": "LeechSeed",
    "curse": "Curse",
    "nightmare": "Nightmare",
    "salt_cure": "SaltCure",
    "trapping": "Trapping",
}


class BattlerEffects(BaseModel):
    helping_hand: bool = False
    me_first: bool = False
    charge: int = 0
    minimize: bool = False
    glaive_rush: int = 0
    substitute: int = 0
    two_turn_attack: str | None = None
    sky_drop: int = -1
    gastro_acid: bool = False
    embargo: int = 0
    magnet_rise: int = 0
    telekinesis: int = 0
    ingrain: bool = False
    smack_down: bool = False
    roost: bool = False
    burn_up: bool = False
    double_shock: bool = False
    extra_type: str | None = None
    weight_change: int = 0
    foresight: bool = False
    miracle_eye: bool = False
    tar_shot: bool = False
    electrify: bool = False
    laser_focus: int = 0
    fury_cutter: int = 0
    rollout: int = 0
    defense_curl: bool = False
    stockpile: int = 0
    unburden: bool = False
    slow_start: int = 0
    paradox_stat: str | None = None
    transformed: bool = False
    focus_energy: int = 0
    confusion: int = 0
    toxic: int = 0
    heal_block: int = 0
    aqua_ring: bool = False
    leech_seed: int = -1
    curse: bool = False
    nightmare: bool = False
    salt_cure: bool = False
    trapping: int = 0
    status_count: int = 0
    last_round_move_failed: bool = False
    ally_fainted_last_round: bool = False
    echoed_voice: int = 0
    echoed_voice_used: bool = False
    times_hit: int = 0
    fainted_allies: int = 0
    turn_count: int = 0
    moves_used: list[str] = []


class Battler(BaseModel):
    index: int
    side: str
    pokemon_index: int
    species: Named
    form: int
    nickname: str
    display_name: str
    display_species: Named
    display_form: int
    display_gender: int
    shiny: bool
    display_types: list[Named] | None
    transform_species: Named | None
    illusion_index: int | None
    level: int
    hp: int
    total_hp: int
    status: Named
    fainted: bool
    types: list[Named]
    ability: Named | None
    item: Named | None
    stats: Stats
    stages: dict[str, int]
    moves: list[Move]
    effects: list[Any]
    battler_effects: BattlerEffects


class Battle(BaseModel):
    side_sizes: list[int]
    wild: bool
    balls: bool
    can_run: bool
    opponent: list[str]
    opponent_ids: list[str]
    party2_starts: list[int]
    turn: int
    decision: int
    weather: str
    weather_duration: int
    terrain: str
    terrain_duration: int
    battlers: list[Battler]
    player_party: list[Pokemon | None]
    opponent_party: list[Pokemon | None]
    side_effects: list[list[Any]]
    field_effects: list[Any]


class Command(BaseModel):
    event_id: int
    index: int
    code: int
    indent: int
    parameters: list[Any]


class ShownEffect(BaseModel):
    side: Literal["player", "opponent", "field"]
    effect: str
    turn: int
    layers: int | None = None


class Reveals(BaseModel):
    trainers: dict[str, dict[int, list[ShownFact]]]
    wild: dict[int, list[ShownFact]]
    held: dict[int, str | None]
    effects: list[ShownEffect] = []


class Ledger(BaseModel):
    bought: dict[str, int]
    shinies: list[int]
    sleep: dict[int, str]
    frozen: list[int]


class GameState(BaseModel):
    tick: int
    context: Context
    trainer: Trainer | None
    party: list[Pokemon]
    bag: list[Pocket]
    vial: Vial | None
    boxes: list[Stored]
    position: Position | None
    transfer: Transfer | None
    battle: Battle | None
    command: Command | None
    switches: dict[int, bool | None]
    variables: dict[int, Any]
    self_switches: dict[str, bool]
    reveals: Reveals
    ledger: Ledger
    challenge_encs: frozenset[int]
    challenge_queued: bool
    visited: frozenset[int]
    events: list[Event] = []


def ivars(raw: Raw) -> dict[str, Any]:
    if not isinstance(raw, dict) or "ivars" not in raw:
        raise StateError(f"expected an object, got {str(raw)[:200]}")
    return raw["ivars"]


def called(raw: Raw) -> dict[str, Any]:
    ivars(raw)
    results = raw.get("calls", {})
    for method, value in results.items():
        if isinstance(value, dict) and "error" in value and "class" not in value:
            raise StateError(f"{raw['class']}#{method} failed: {value['error']}")
    return results


def entries(raw: Raw) -> list[tuple[Any, Any]]:
    if not isinstance(raw, dict) or "entries" not in raw:
        raise StateError(f"expected a hash, got {str(raw)[:200]}")
    return [tuple(pair) for pair in raw["entries"]]


def named(table: dict[str, str], id: str) -> Named:
    return Named(id=id, name=table.get(id) or None)


def optional(table: dict[str, str], id: str | None) -> Named | None:
    return named(table, id) if id else None


def stats(values: dict[str, int]) -> Stats:
    return Stats(
        hp=values["HP"],
        attack=values["ATTACK"],
        defense=values["DEFENSE"],
        speed=values["SPEED"],
        special_attack=values["SPECIAL_ATTACK"],
        special_defense=values["SPECIAL_DEFENSE"],
    )


def stat_hash(raw: Raw) -> Stats:
    return stats(dict(entries(raw)))


def own_stats(fields: dict[str, Any]) -> Stats:
    return stats(
        {
            "HP": fields["totalhp"],
            "ATTACK": fields["attack"],
            "DEFENSE": fields["defense"],
            "SPEED": fields["speed"],
            "SPECIAL_ATTACK": fields["spatk"],
            "SPECIAL_DEFENSE": fields["spdef"],
        }
    )


def move(raw: Raw, names: Names) -> Move | None:
    if raw is None:
        return None
    fields = ivars(raw)
    if not fields.get("id"):
        return None
    real = fields.get("realMove")
    pp_ups = ivars(real).get("ppup") if isinstance(real, dict) else fields.get("ppup")
    return Move(
        move=named(names.moves, fields["id"]),
        pp=fields["pp"],
        total_pp=called(raw)["total_pp"],
        pp_ups=pp_ups,
    )


def moves(raw: list[Raw], names: Names) -> list[Move]:
    return [parsed for parsed in (move(entry, names) for entry in raw) if parsed is not None]


def types(table: dict[str, str], ids: list[str]) -> list[Named]:
    return [named(table, id) for id in dict.fromkeys(ids)]


def pokemon(raw: Raw, names: Names) -> Pokemon | None:
    if raw is None:
        return None
    fields = ivars(raw)
    results = called(raw)
    return Pokemon(
        personal_id=fields["personalID"],
        species=named(names.species, fields["species"]),
        form=results["form"],
        nickname=results["name"],
        level=results["level"],
        exp=fields["exp"],
        gender=results["gender"],
        shiny=results["shiny?"],
        egg=results["egg?"],
        types=types(names.types, results["types"]),
        hp=fields["hp"],
        stats=own_stats(fields),
        ivs=stat_hash(fields["iv"]),
        evs=stat_hash(fields["ev"]),
        nature=named(names.natures, results["nature_id"]),
        ability=optional(names.abilities, results["ability_id"]),
        item=optional(names.items, fields["item"]),
        status=named(names.statuses, fields["status"]),
        moves=moves(fields["moves"], names),
        happiness=fields["happiness"],
        exp_share=bool(fields.get("expshare")),
        obtain_map=fields.get("obtain_map"),
    )


def party(raw: list[Raw] | None, names: Names) -> list[Pokemon | None]:
    return [pokemon(entry, names) for entry in raw or []]


def trainer(values: dict[str, Any]) -> Trainer | None:
    if values["trainer.name"] is None:
        return None
    return Trainer(
        name=values["trainer.name"],
        id=values["trainer.id"],
        public_id=values["trainer.public_id"],
        money=values["trainer.money"],
        badges=[bool(badge) for badge in values["trainer.badges"] or []],
        save_slot=values["trainer.save_slot"],
    )


def vial(values: dict[str, Any]) -> Vial | None:
    if values["vial.charges"] is None:
        return None
    return Vial(
        charges=values["vial.charges"],
        max_charges=values["vial.max_charges"] or 0,
        locked=bool(values["vial.locked"]),
    )


def bag(raw: list[Raw] | None, names: Names) -> list[Pocket]:
    pockets = []
    for index, contents in enumerate(raw or []):
        if index == 0 or contents is None:
            continue
        pocket_name = names.pockets[index - 1] if index <= len(names.pockets) else None
        items = [(named(names.items, id), quantity) for id, quantity in contents]
        pockets.append(Pocket(index=index, name=pocket_name or None, items=items))
    return pockets


def boxes(raw: list[Raw] | None, names: Names) -> list[Stored]:
    stored = []
    for box_index, box in enumerate(raw or []):
        fields = ivars(box)
        for slot, entry in enumerate(fields["pokemon"]):
            parsed = pokemon(entry, names)
            if parsed is not None:
                stored.append(
                    Stored(box=box_index, box_name=fields["name"], slot=slot, pokemon=parsed)
                )
    return stored


def position(values: dict[str, Any]) -> Position | None:
    if values["map.id"] is None or values["player.x"] is None:
        return None
    return Position(
        map_id=values["map.id"],
        map_name=values["map.name"] or None,
        x=values["player.x"],
        y=values["player.y"],
        facing=FACINGS.get(values["player.direction"], str(values["player.direction"])),
        moving=bool(values["player.moving"]),
    )


def transfer(values: dict[str, Any]) -> Transfer | None:
    if not values["transfer.pending"]:
        return None
    direction = values["transfer.direction"]
    return Transfer(
        map_id=values["transfer.map"],
        x=values["transfer.x"],
        y=values["transfer.y"],
        facing=FACINGS.get(direction) if direction else None,
    )


def databox_types(raw: Raw, names: Names) -> list[Named] | None:
    if raw is None:
        return None
    return types(names.types, dict(entries(raw))["types"])


def transform_species(
    fields: dict[str, Any], effects: dict[str, int], names: Names
) -> Named | None:
    battler_effects = fields["effects"]
    if not battler_effects[effects["transform"]]:
        return None
    return optional(names.species, battler_effects[effects["transform_species"]])


def personal_id(raw: Raw) -> int | None:
    if not isinstance(raw, dict) or "ivars" not in raw:
        return None
    return raw["ivars"].get("personalID")


def illusion_index(fields: dict[str, Any], effects: dict[str, int], party: list[Raw]) -> int | None:
    disguise = personal_id(fields["effects"][effects["illusion"]])
    if disguise is None:
        return None
    matches = [index for index, entry in enumerate(party) if personal_id(entry) == disguise]
    return matches[-1] if matches else None


class Rounds(BaseModel):
    turn: int
    sides: list[list[Any]]
    rage_hits: list[list[int]]
    fainted: list[int]


def battler_effects(
    fields: dict[str, Any], effects: dict[str, int], rounds: Rounds
) -> BattlerEffects:
    raw = fields["effects"]
    values = {key: raw[effects[key]] for key in BATTLER_EFFECTS}
    for key, field in BattlerEffects.model_fields.items():
        if field.annotation is bool and key in values:
            values[key] = bool(values[key])
    side = fields["index"] % 2
    fainted = rounds.sides[side][effects["last_round_fainted"]]
    values["last_round_move_failed"] = bool(fields["lastRoundMoveFailed"])
    values["ally_fainted_last_round"] = fainted >= 0 and fainted == rounds.turn - 1
    values["echoed_voice"] = rounds.sides[side][effects["echoed_voice_counter"]]
    values["echoed_voice_used"] = bool(rounds.sides[side][effects["echoed_voice_used"]])
    values["times_hit"] = rounds.rage_hits[side][fields["pokemonIndex"]]
    values["fainted_allies"] = rounds.fainted[side]
    values["turn_count"] = fields["turnCount"]
    values["status_count"] = fields["statusCount"]
    values["moves_used"] = list(fields["movesUsed"] or [])
    return BattlerEffects.model_validate(values)


def battler(
    raw: Raw,
    names: Names,
    effects: dict[str, int],
    databoxes: dict[int, Raw],
    party: list[Raw],
    rounds: Rounds,
) -> Battler | None:
    if raw is None:
        return None
    fields = ivars(raw)
    if not fields.get("species"):
        return None
    shown = called(raw)
    index = fields["index"]
    return Battler(
        index=index,
        side="player" if index % 2 == 0 else "opponent",
        pokemon_index=fields["pokemonIndex"],
        species=named(names.species, fields["species"]),
        form=fields["form"],
        nickname=fields["name"],
        display_name=shown["name"],
        display_species=named(names.species, shown["displaySpecies"]),
        display_form=shown["displayForm"],
        display_gender=shown["displayGender"],
        shiny=bool(shown["shiny?"]),
        display_types=databox_types(databoxes.get(index), names),
        transform_species=transform_species(fields, effects, names),
        illusion_index=illusion_index(fields, effects, party) if index % 2 == 1 else None,
        level=fields["level"],
        hp=fields["hp"],
        total_hp=fields["totalhp"],
        status=named(names.statuses, fields["status"]),
        fainted=fields["fainted"],
        types=types(names.types, fields["types"]),
        ability=optional(names.abilities, fields["ability_id"]),
        item=optional(names.items, fields["item_id"]),
        stats=own_stats(fields),
        stages=dict(entries(fields["stages"])),
        moves=moves(fields["moves"], names),
        effects=fields["effects"],
        battler_effects=battler_effects(fields, effects, rounds),
    )


def opponent_trainers(raw: Raw) -> list[dict[str, Any]]:
    if raw is None:
        return []
    return [ivars(entry) for entry in (raw if isinstance(raw, list) else [raw])]


def trainer_id(fields: dict[str, Any]) -> str:
    key = fields.get("anil_trainer_id") or [
        fields["trainer_type"],
        fields["name"],
        fields.get("version", 0),
    ]
    return ID_SEPARATOR.join("" if part is None else str(part) for part in key)


def battle(values: dict[str, Any], names: Names) -> Battle | None:
    if values["battle.turn"] is None:
        return None
    effects = {
        "transform": values["battle.effect.transform"],
        "transform_species": values["battle.effect.transform_species"],
        "illusion": values["battle.effect.illusion"],
        "last_round_fainted": values["battle.effect.last_round_fainted"],
        "echoed_voice_counter": values["battle.effect.echoed_voice_counter"],
        "echoed_voice_used": values["battle.effect.echoed_voice_used"],
    } | {key: values[f"battle.effect.{key}"] for key in BATTLER_EFFECTS}
    databoxes = {index: values.get(f"{DATABOX_PREFIX}{index}") for index in range(MAX_BATTLERS)}
    party2 = values["battle.party2"] or []
    sides = [ivars(side)["effects"] for side in values["battle.sides"]]
    rounds = Rounds(
        turn=values["battle.turn"],
        sides=sides,
        rage_hits=values["battle.rage_hits"],
        fainted=values["battle.fainted_counts"],
    )
    battlers = [
        battler(entry, names, effects, databoxes, party2, rounds)
        for entry in values["battle.battlers"]
    ]
    field = ivars(values["battle.field"])
    trainers = opponent_trainers(values["battle.opponent"])
    return Battle(
        side_sizes=values["battle.side_sizes"],
        wild=values["battle.opponent"] is None,
        balls=not values["battle.disable_balls"],
        can_run=bool(values["battle.can_run"]),
        opponent=[fields["name"] for fields in trainers],
        opponent_ids=[trainer_id(fields) for fields in trainers],
        party2_starts=values["battle.party2_starts"] or [0],
        turn=values["battle.turn"],
        decision=values["battle.decision"],
        weather=field["weather"],
        weather_duration=field["weatherDuration"],
        terrain=field["terrain"],
        terrain_duration=field["terrainDuration"],
        battlers=[entry for entry in battlers if entry is not None],
        player_party=party(values["battle.party1"], names),
        opponent_party=party(values["battle.party2"], names),
        side_effects=sides,
        field_effects=field["effects"],
    )


def command(values: dict[str, Any]) -> Command | None:
    commands = values["interpreter.list"]
    index = values["interpreter.index"]
    if not values["interpreter.running"] or not commands or index is None:
        return None
    if not 0 <= index < len(commands):
        return None
    fields = ivars(commands[index])
    return Command(
        event_id=values["interpreter.event"],
        index=index,
        code=fields["code"],
        indent=fields["indent"],
        parameters=fields["parameters"],
    )


def facts(raw: Raw) -> list[ShownFact]:
    return [ShownFact.model_validate(dict(entries(fact))) for fact in raw]


def slots(raw: Raw) -> dict[int, list[ShownFact]]:
    return {slot: facts(listed) for slot, listed in entries(raw)}


EFFECT_PLACES: dict[str, Literal["player", "opponent", "field"]] = {
    "0": "player",
    "1": "opponent",
    "field": "field",
}


def shown_effects(raw: Raw) -> list[ShownEffect]:
    shown = []
    for place, listed in entries(raw):
        for name, entry in entries(listed):
            fields = dict(entries(entry))
            shown.append(
                ShownEffect(
                    side=EFFECT_PLACES[place],
                    effect=name,
                    turn=fields["turn"],
                    layers=fields.get("layers"),
                )
            )
    return shown


def reveals(raw: Raw) -> Reveals:
    if raw is None:
        return Reveals(trainers={}, wild={}, held={})
    store = dict(entries(raw))
    return Reveals(
        trainers={trainer: slots(held) for trainer, held in entries(store.get("trainers"))}
        if store.get("trainers") is not None
        else {},
        wild=slots(store["wild"]) if store.get("wild") is not None else {},
        held=dict(entries(store["held"])) if store.get("held") is not None else {},
        effects=shown_effects(store["effects"]) if store.get("effects") is not None else [],
    )


def ledger(raw: Raw) -> Ledger:
    if raw is None:
        return Ledger(bought={}, shinies=[], sleep={}, frozen=[])
    store = dict(entries(raw))
    return Ledger(
        bought=dict(entries(store["bought"])) if store.get("bought") is not None else {},
        shinies=list(store.get("shinies") or []),
        sleep=dict(entries(store["sleep"])) if store.get("sleep") is not None else {},
        frozen=list(store.get("frozen") or []),
    )


def challenge_encs(raw: Raw) -> frozenset[int]:
    if raw is None:
        return frozenset()
    return frozenset(map_id for map_id, used in entries(raw) if used is True)


def self_switches(raw: Raw) -> dict[str, bool]:
    if raw is None:
        return {}
    return {
        f"{map_id}:{event_id}:{letter}": bool(value)
        for (map_id, event_id, letter), value in entries(raw)
    }


def state_request(
    switches: list[int], variables: list[int], with_self_switches: bool
) -> ReadRequest:
    paths: list[tuple[str, str] | tuple[str, str, int]] = [
        ("trainer.name", "$player@name"),
        ("trainer.id", "$player@id"),
        ("trainer.public_id", "$player.public_ID"),
        ("trainer.money", "$player@money"),
        BADGES,
        ("trainer.save_slot", "$player.save_slot"),
        ("vial.charges", "$PokemonGlobal.vial_charges"),
        ("vial.max_charges", "$PokemonGlobal.max_vial_charges"),
        ("vial.locked", "$PokemonGlobal.vial_locked"),
        ("party", "$player@party"),
        ("bag", "$bag@pockets"),
        ("boxes", "$PokemonStorage@boxes"),
        ("map.id", "$game_map.map_id"),
        ("map.name", "$game_map.name"),
        ("player.x", "$game_player.x"),
        ("player.y", "$game_player.y"),
        ("player.direction", "$game_player.direction"),
        ("player.moving", "$game_player.moving?"),
        ("transfer.pending", "$game_temp.player_transferring"),
        ("transfer.map", "$game_temp.player_new_map_id"),
        ("transfer.x", "$game_temp.player_new_x"),
        ("transfer.y", "$game_temp.player_new_y"),
        ("transfer.direction", "$game_temp.player_new_direction"),
        *battle_paths(LIVE_BATTLE),
        INTERPRETER_RUNNING,
        ("interpreter.event", "$game_system.map_interpreter@event_id"),
        ("interpreter.index", "$game_system.map_interpreter@index"),
        ("interpreter.list", "$game_system.map_interpreter@list"),
        REVEALS,
        LEDGER,
        CHALLENGE_ENCS,
        CHALLENGE_QUEUED,
        VISITED,
    ]
    paths += [(f"switch.{id}", f"$game_switches[{id}]") for id in switches]
    paths += [(f"variable.{id}", f"$game_variables[{id}]") for id in variables]
    if with_self_switches:
        paths.append(("self_switches", "$game_self_switches@data"))
    return ReadRequest(paths=paths, depth=STATE_DEPTH, calls=STATE_CALLS, stop=STOP_CLASSES)


def battle_paths(root: str) -> list[tuple[str, str] | tuple[str, str, int]]:
    paths: list[tuple[str, str] | tuple[str, str, int]] = [
        ("battle.turn", f"{root}@turnCount"),
        ("battle.decision", f"{root}@decision"),
        ("battle.side_sizes", f"{root}@sideSizes"),
        ("battle.disable_balls", f"{root}@disablePokeBalls"),
        ("battle.can_run", f"{root}@canRun"),
        ("battle.opponent", f"{root}@opponent", OPPONENT_DEPTH),
        ("battle.battlers", f"{root}@battlers"),
        ("battle.party1", f"{root}@party1"),
        ("battle.party2", f"{root}@party2"),
        ("battle.party2_starts", f"{root}@party2starts"),
        ("battle.effect.transform", "PBEffects::Transform"),
        ("battle.effect.transform_species", "PBEffects::TransformSpecies"),
        ("battle.effect.illusion", "PBEffects::Illusion"),
        ("battle.effect.last_round_fainted", "PBEffects::LastRoundFainted"),
        ("battle.effect.echoed_voice_counter", "PBEffects::EchoedVoiceCounter"),
        ("battle.effect.echoed_voice_used", "PBEffects::EchoedVoiceUsed"),
        *((f"battle.effect.{key}", f"PBEffects::{name}") for key, name in BATTLER_EFFECTS.items()),
        ("battle.sides", f"{root}@sides"),
        ("battle.field", f"{root}@field"),
        ("battle.rage_hits", f"{root}@rage_hit_count"),
        ("battle.fainted_counts", f"{root}@fainted_count"),
    ]
    return paths + [
        (
            f"{DATABOX_PREFIX}{index}",
            f'{root}.scene.sprites["dataBox_{index}"].get_current_pokemon_state',
            DATABOX_DEPTH,
        )
        for index in range(MAX_BATTLERS)
    ]


def read_battle(session: Session, root: str = LIVE_BATTLE) -> Answer[Battle | None]:
    names = read_names(session)
    answer = session.read(
        ReadRequest(
            paths=battle_paths(root), depth=STATE_DEPTH, calls=STATE_CALLS, stop=STOP_CLASSES
        )
    )
    errors = {
        name: error
        for name, error in answer.value.errors.items()
        if not name.startswith(DATABOX_PREFIX)
    }
    if errors:
        raise StateError(f"battle read failed at tick {answer.tick}: {errors}")
    try:
        found = battle(answer.value.values, names)
    except (StateError, ValidationError, KeyError, TypeError, ValueError) as error:
        raise StateError(
            f"battle at tick {answer.tick} does not match its layout: {error}"
        ) from error
    return Answer(answer.tick, found, answer.caller, answer.payloads, answer.digest)


def read_names(session: Session) -> Names:
    cached = session.session_dir / NAMES_FILE
    if cached.exists():
        return Names.model_validate_json(cached.read_text())
    names = fetch_names(session)
    write_names(cached, names)
    return names


def write_names(path: Path, names: Names) -> None:
    partial = path.with_suffix(".part")
    partial.write_text(names.model_dump_json())
    partial.replace(path)


def name_read(session: Session, paths: list[tuple[str, str] | tuple[str, str, int]]) -> Any:
    result = session.read(ReadRequest(paths=paths)).value
    if result.errors:
        raise StateError(f"reading the game's names failed: {result.errors}")
    return result.values


def fetch_names(session: Session) -> Names:
    keys = name_read(
        session,
        [(table, f"GameData::{kind}.keys", 1) for table, kind in GAME_DATA.items()]
        + [("pockets", "PokemonBag.pocket_names", 1)],
    )
    values = name_read(
        session,
        [
            (f"{table}.{key}", f'GameData::{kind}.get("{key}").name')
            for table, kind in GAME_DATA.items()
            for key in keys[table]
        ],
    )
    tables = {table: {key: values[f"{table}.{key}"] for key in keys[table]} for table in GAME_DATA}
    return Names(**tables, pockets=keys["pockets"])


def read_state(
    session: Session,
    *,
    switches: list[int] | None = None,
    variables: list[int] | None = None,
    with_self_switches: bool = False,
    record_unknown: bool = True,
    take_events: bool = True,
) -> GameState:
    names = read_names(session)
    answer = session.read(state_request(switches or [], variables or [], with_self_switches))
    result = answer.value
    errors = {
        name: error for name, error in result.errors.items() if not name.startswith(DATABOX_PREFIX)
    }
    if errors:
        raise StateError(f"state read failed at tick {answer.tick}: {errors}")
    context = classify(answer.caller, answer.payloads, bool(result.values["interpreter.running"]))
    if context.name == UNKNOWN and record_unknown:
        log_unknown(session.session_dir, answer.tick, answer.caller)
    try:
        state = build_state(
            answer.tick, context, result.values, names, switches or [], variables or []
        )
        if take_events:
            state.events = session.take_events()
        return state
    except (StateError, ValidationError, KeyError, TypeError, ValueError) as error:
        raise StateError(
            f"state at tick {answer.tick} does not match its layout: {error}"
        ) from error


def read_reveals(session: Session) -> Answer[Reveals]:
    answer = session.read(ReadRequest(paths=[REVEALS], depth=STATE_DEPTH))
    if answer.value.errors:
        raise StateError(f"reveals read failed at tick {answer.tick}: {answer.value.errors}")
    try:
        found = reveals(answer.value.values[REVEALS[0]])
    except (StateError, ValidationError, KeyError, TypeError, ValueError) as error:
        raise StateError(
            f"reveals at tick {answer.tick} do not match their layout: {error}"
        ) from error
    return Answer(answer.tick, found, answer.caller, answer.payloads, answer.digest)


def read_badge_list(session: Session) -> Answer[list[bool]]:
    answer = session.read(ReadRequest(paths=[BADGES]))
    if answer.value.errors:
        raise StateError(f"badges read failed at tick {answer.tick}: {answer.value.errors}")
    found = [bool(badge) for badge in answer.value.values[BADGES[0]] or []]
    return Answer(answer.tick, found, answer.caller, answer.payloads, answer.digest)


def read_badges(session: Session) -> int:
    return sum(read_badge_list(session).value)


def read_context(session: Session) -> Answer[Context]:
    answer = session.read(ReadRequest(paths=[INTERPRETER_RUNNING]))
    if answer.value.errors:
        raise StateError(f"context read failed at tick {answer.tick}: {answer.value.errors}")
    running = bool(answer.value.values[INTERPRETER_RUNNING[0]])
    context = classify(answer.caller, answer.payloads, running)
    if context.name == UNKNOWN:
        log_unknown(session.session_dir, answer.tick, answer.caller)
    return Answer(answer.tick, context, answer.caller, answer.payloads, answer.digest)


def read_rock_climbing(session: Session) -> bool:
    answer = session.read(ReadRequest(paths=[ROCK_CLIMBING]))
    if answer.value.errors:
        raise StateError(f"rock climb read failed at tick {answer.tick}: {answer.value.errors}")
    return bool(answer.value.values[ROCK_CLIMBING[0]])


def build_state(
    tick: int,
    context: Context,
    values: dict[str, Any],
    names: Names,
    switches: list[int],
    variables: list[int],
) -> GameState:
    return GameState(
        tick=tick,
        context=context,
        trainer=trainer(values),
        party=[entry for entry in party(values["party"], names) if entry is not None],
        bag=bag(values["bag"], names),
        vial=vial(values),
        boxes=boxes(values["boxes"], names),
        position=position(values),
        transfer=transfer(values),
        battle=battle(values, names),
        command=command(values),
        switches={id: values[f"switch.{id}"] for id in switches},
        variables={id: values[f"variable.{id}"] for id in variables},
        self_switches=self_switches(values.get("self_switches")),
        reveals=reveals(values["reveals"]),
        ledger=ledger(values["ledger"]),
        challenge_encs=challenge_encs(values[CHALLENGE_ENCS[0]]),
        challenge_queued=values[CHALLENGE_QUEUED[0]] is True,
        visited=visited_maps(values[VISITED[0]]),
    )


WORLD_KEY_ITEMS = ("SURFITEM", "ROCKCLIMBITEM", "POKERIDER", "LENSOFTRUTH", "CUTITEM")
SECONDS_PER_DAY = 86400
WORLD_VALUE_DEPTH = 4


class LivePlayer(BaseModel):
    x: int
    y: int
    direction: int
    moving: bool
    through: bool
    character_name: str
    name: str


class Clock(BaseModel):
    unix: int
    utc_offset: int

    @property
    def seconds_since_midnight(self) -> int:
        return (self.unix + self.utc_offset) % SECONDS_PER_DAY


class LiveEvent(BaseModel):
    id: int
    x: int
    y: int
    width: int
    height: int
    through: bool
    character_name: str
    tile_id: int
    erased: bool
    page: int | None
    temp_switches: dict[str, bool]


class LiveWorld(BaseModel):
    tick: int
    map_id: int
    width: int
    height: int
    player: LivePlayer
    switches: list[Any]
    variables: list[Any]
    self_switches: dict[str, bool]
    event_vars: dict[str, Any]
    bridge: int
    surfing: bool
    bicycle: bool
    diving: bool
    rock_climbing: bool
    running_shoes: bool
    run_style: int
    item_animation: int
    lens: int
    key_items: dict[str, int]
    visited: frozenset[int]
    follower_allows_transfer: bool
    script_switches: dict[int, bool]
    clock: Clock
    events: dict[int, LiveEvent]


def world_request(script_switches: Sequence[int], items: Sequence[str]) -> ReadRequest:
    paths: list[tuple[str, str] | tuple[str, str, int]] = [
        ("map.id", "$game_map.map_id"),
        ("map.width", "$game_map.width"),
        ("map.height", "$game_map.height"),
        ("map.events", "$game_map.events.keys", 1),
        ("player.x", "$game_player.x"),
        ("player.y", "$game_player.y"),
        ("player.direction", "$game_player.direction"),
        ("player.moving", "$game_player.moving?"),
        ("player.through", "$game_player.through"),
        ("player.character_name", "$game_player.character_name"),
        ("player.name", "$player.name"),
        ("switches", "$game_switches@data", 1),
        ("variables", "$game_variables@data", WORLD_VALUE_DEPTH),
        ("self_switches", "$game_self_switches@data", WORLD_VALUE_DEPTH),
        ("event_vars", "$PokemonGlobal.eventvars", WORLD_VALUE_DEPTH),
        ("bridge", "$PokemonGlobal.bridge"),
        ("surfing", "$PokemonGlobal.surfing"),
        ("bicycle", "$PokemonGlobal.bicycle"),
        ("diving", "$PokemonGlobal.diving"),
        ROCK_CLIMBING,
        ("running_shoes", "$player.has_running_shoes"),
        ("run_style", "$PokemonSystem.runstyle"),
        ("item_animation", "$PokemonSystem.animation_item"),
        ("lens", "$scene@eye_of_truth_time"),
        VISITED,
        ("follower_allows_transfer", "$game_player.can_map_transfer_with_follower?"),
        ("clock.unix", "Kernel.pbGetTimeNow.to_i"),
        ("clock.utc_offset", "Kernel.pbGetTimeNow.utc_offset"),
    ]
    paths += [(f"item.{name}", f'$bag.quantity("{name}")') for name in items]
    paths += [
        (f"script_switch.{id}", f"Game_Event.allocate.switchIsOn?({id})") for id in script_switches
    ]
    return ReadRequest(paths=paths)


def event_path(event_id: int) -> str:
    return f"$game_map.events[{event_id}]"


def events_request(page_counts: dict[int, int]) -> ReadRequest:
    paths: list[tuple[str, str] | tuple[str, str, int]] = [("map.id", "$game_map.map_id")]
    for event_id, count in page_counts.items():
        event = event_path(event_id)
        paths.append((f"event.{event_id}", event, 1))
        paths.append((f"event.{event_id}.page", f"{event}@page.object_id"))
        paths.append((f"event.{event_id}.temp", f"{event}@tempSwitches", 2))
        paths += [
            (f"event.{event_id}.page.{number}", f"{event}@event@pages[{number - 1}].object_id")
            for number in range(1, count + 1)
        ]
    return ReadRequest(paths=paths)


def read_live_world(
    session: Session,
    page_counts: Callable[[int], dict[int, int]],
    script_switches: Sequence[int] = (),
    items: Sequence[str] = (),
) -> LiveWorld:
    held = list(dict.fromkeys((*WORLD_KEY_ITEMS, *items)))
    first = session.read(world_request(script_switches, held))
    if first.value.errors:
        raise StateError(f"live world read failed at tick {first.tick}: {first.value.errors}")
    values = first.value.values
    counts = page_counts(values["map.id"])
    live_ids = [event_id for event_id in values["map.events"] if isinstance(event_id, int)]
    second = session.read(events_request({id: counts.get(id, 0) for id in live_ids}))
    if second.value.errors:
        raise StateError(f"live events read failed at tick {second.tick}: {second.value.errors}")
    if second.tick != first.tick or second.value.values["map.id"] != values["map.id"]:
        raise StateError(
            f"the game moved between the two live reads (ticks {first.tick} and {second.tick}); "
            "read it as the driver"
        )
    try:
        return build_live_world(
            first.tick, values, second.value.values, live_ids, counts, script_switches, held
        )
    except (StateError, ValidationError, KeyError, TypeError, ValueError) as error:
        raise StateError(
            f"live world at tick {first.tick} does not match its layout: {error}"
        ) from error


def visited_maps(raw: Raw) -> frozenset[int]:
    if raw is None:
        return frozenset()
    if not isinstance(raw, list):
        raise StateError(f"expected the visited maps as an array, got {str(raw)[:200]}")
    return frozenset(map_id for map_id, seen in enumerate(raw) if seen is True)


def event_vars(raw: Raw) -> dict[str, Any]:
    if raw is None:
        return {}
    return {
        f"{key[0]}:{key[1]}": value
        for key, value in entries(raw)
        if isinstance(key, list) and len(key) == 2
    }


def temp_switches(raw: Raw) -> dict[str, bool]:
    if raw is None:
        return {}
    return {str(letter): value is True for letter, value in entries(raw)}


def live_event(event_id: int, values: dict[str, Any], page_count: int) -> LiveEvent | None:
    raw = values[f"event.{event_id}"]
    if raw is None:
        return None
    fields = ivars(raw)
    page_id = values[f"event.{event_id}.page"]
    page = None
    if page_id is not None and page_count > 0:
        numbers = [
            number
            for number in range(1, page_count + 1)
            if values[f"event.{event_id}.page.{number}"] == page_id
        ]
        if len(numbers) != 1:
            raise StateError(f"event {event_id}'s current page is not one of its pages")
        page = numbers[0]
    return LiveEvent(
        id=event_id,
        x=fields["x"],
        y=fields["y"],
        width=fields["width"],
        height=fields["height"],
        through=bool(fields["through"]),
        character_name=fields["character_name"],
        tile_id=fields["tile_id"],
        erased=bool(fields["erased"]),
        page=page,
        temp_switches=temp_switches(values[f"event.{event_id}.temp"]),
    )


def build_live_world(
    tick: int,
    values: dict[str, Any],
    event_values: dict[str, Any],
    live_ids: list[int],
    page_counts: dict[int, int],
    script_switches: Sequence[int],
    items: Sequence[str],
) -> LiveWorld:
    events = {
        event_id: event
        for event_id in live_ids
        if (event := live_event(event_id, event_values, page_counts.get(event_id, 0))) is not None
    }
    return LiveWorld(
        tick=tick,
        map_id=values["map.id"],
        width=values["map.width"],
        height=values["map.height"],
        player=LivePlayer(
            x=values["player.x"],
            y=values["player.y"],
            direction=values["player.direction"],
            moving=bool(values["player.moving"]),
            through=bool(values["player.through"]),
            character_name=values["player.character_name"],
            name=values["player.name"],
        ),
        switches=values["switches"] or [],
        variables=values["variables"] or [],
        self_switches=self_switches(values["self_switches"]),
        event_vars=event_vars(values["event_vars"]),
        bridge=values["bridge"] or 0,
        surfing=bool(values["surfing"]),
        bicycle=bool(values["bicycle"]),
        diving=bool(values["diving"]),
        rock_climbing=bool(values["rock_climbing"]),
        running_shoes=bool(values["running_shoes"]),
        run_style=values["run_style"] or 0,
        item_animation=values["item_animation"] or 0,
        lens=values["lens"] if isinstance(values["lens"], int) else 0,
        key_items={name: values[f"item.{name}"] for name in items},
        visited=visited_maps(values["visited"]),
        follower_allows_transfer=values["follower_allows_transfer"] is True,
        script_switches={
            id: values[f"script_switch.{id}"] not in (None, False) for id in script_switches
        },
        clock=Clock(unix=values["clock.unix"], utc_offset=values["clock.utc_offset"]),
        events=events,
    )


class Flags(BaseModel):
    tick: int
    switches: list[Any]
    variables: list[Any]
    self_switches: dict[str, bool]


def flags_request() -> ReadRequest:
    return ReadRequest(
        paths=[
            ("switches", "$game_switches@data", 1),
            ("variables", "$game_variables@data", WORLD_VALUE_DEPTH),
            ("self_switches", "$game_self_switches@data", WORLD_VALUE_DEPTH),
        ]
    )


def read_flags(session: Session) -> Flags:
    answer = session.read(flags_request())
    values = answer.value.values
    if answer.value.errors:
        raise StateError(f"flags read failed at tick {answer.tick}: {answer.value.errors}")
    try:
        return Flags(
            tick=answer.tick,
            switches=values["switches"] or [],
            variables=values["variables"] or [],
            self_switches=self_switches(values["self_switches"]),
        )
    except (StateError, ValidationError, TypeError, ValueError) as error:
        raise StateError(
            f"flags at tick {answer.tick} do not match their layout: {error}"
        ) from error
