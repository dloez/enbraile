import sqlite3
from dataclasses import dataclass
from typing import Any

from anil.bridge.protocol import ReadRequest
from anil.harness import gamedb
from anil.harness.gamedb import OPPONENT_HIDDEN, WORLD, LevelMove, Tag
from anil.harness.investigate import Session
from anil.harness.state import ID_SEPARATOR, entries, ivars

OWN: Tag = "own"
UNOWNED_RANDOM: Tag = "unowned_random"
OPPONENT_SPECIES: Tag = "opponent_species"
STARTER_VARIABLES = (803, 804, 805)
SPECIES_WITHOUT_RANDOM_ABILITIES = frozenset({"SHEDINJA", "MEWTWO_5"})
HIDDEN_ABILITY_INDEX = 2
STARTER_DEPTH = 4


class RandomError(Exception):
    pass


@dataclass(frozen=True)
class AbilityEntry:
    species: str
    abilities: tuple[str, ...]
    hidden_abilities: tuple[str, ...]
    tag: Tag


@dataclass(frozen=True)
class Learnset:
    species: str
    moves: tuple[LevelMove, ...]
    tag: Tag


@dataclass(frozen=True)
class Compatibility:
    species: str
    moves: dict[str, bool]
    tag: Tag


@dataclass(frozen=True)
class TmMove:
    item: str
    move: str
    tag: Tag


@dataclass(frozen=True)
class Starter:
    variable: int
    species: str
    species_tag: Tag
    level: int | None
    moves: tuple[str, ...]
    ability: str | None
    tag: Tag


@dataclass(frozen=True)
class WildSlot:
    species: str
    species_tag: Tag
    chance: int
    min_level: int
    max_level: int
    tag: Tag


@dataclass(frozen=True)
class OpponentPokemon:
    species: str
    species_tag: Tag
    level: int | None
    moves: tuple[str, ...]
    ability: str | None
    item: str | None
    nature: str | None
    ivs: dict[str, int]
    tag: Tag


@dataclass(frozen=True)
class TrainerTeam:
    trainer: str
    party: tuple[OpponentPokemon, ...]
    tag: Tag


@dataclass(frozen=True)
class MartTm:
    item: str
    move: str | None
    tag: Tag


@dataclass(frozen=True)
class TmMart:
    mart: int
    stock: tuple[MartTm, ...]
    tag: Tag


@dataclass(frozen=True)
class RunRandom:
    tick: int
    owned: frozenset[str]
    abilities: dict[str, AbilityEntry] | None
    learnsets: dict[str, Learnset] | None
    compatibility: dict[str, Compatibility] | None
    tm_moves: dict[str, TmMove] | None
    starters: tuple[Starter | None, ...]
    wild: dict[int, dict[str, tuple[WildSlot, ...]]] | None
    trainers: dict[str, TrainerTeam] | None
    tm_marts: dict[int, TmMart] | None


def random_request() -> ReadRequest:
    return ReadRequest(
        paths=[
            ("owned", "$player.pokedex@owned"),
            ("randomized", "$randomized_data"),
            ("learnsets", "$PokemonGlobal@random_moves"),
            ("compatibility", "$PokemonGlobal@tm_compatibility_random"),
            ("tm_moves", "$PokemonGlobal@tm_move_map"),
            ("wild", "$PokemonGlobal@random_encounter_table"),
            ("trainers", "$PokemonGlobal@random_trainer_teams"),
            ("tm_marts", "$PokemonGlobal@tm_mart"),
            *(
                (f"starter.{variable}", f"$game_variables[{variable}]", STARTER_DEPTH)
                for variable in STARTER_VARIABLES
            ),
        ]
    )


def read_random(session: Session, connection: sqlite3.Connection) -> RunRandom:
    answer = session.read(random_request())
    if answer.value.errors:
        raise RandomError(f"random read failed at tick {answer.tick}: {answer.value.errors}")
    values = answer.value.values
    bases = base_species(connection)
    owned = frozenset(str(species) for species, flag in hash_pairs(values["owned"]) if flag is True)

    def tag(species: str) -> Tag:
        return OWN if bases.get(species, species) in owned else UNOWNED_RANDOM

    abilities = ability_table(values["randomized"], tag)
    moves = tm_moves(values["tm_moves"])
    return RunRandom(
        tick=answer.tick,
        owned=owned,
        abilities=abilities,
        learnsets=learnsets(values["learnsets"], tag),
        compatibility=compatibility(values["compatibility"], tag),
        tm_moves=moves,
        starters=tuple(
            starter(variable, values[f"starter.{variable}"], abilities, connection, tag)
            for variable in STARTER_VARIABLES
        ),
        wild=wild_tables(values["wild"]),
        trainers=trainer_teams(values["trainers"], abilities, connection),
        tm_marts=tm_marts(values["tm_marts"], moves),
    )


def base_species(connection: sqlite3.Connection) -> dict[str, str]:
    return {found.id: found.raw["@species"] for found in gamedb.entries(connection, "species")}


def hash_pairs(raw: Any) -> list[tuple[Any, Any]]:
    return [] if raw is None else entries(raw)


def ability_table(raw: Any, tag: Any) -> dict[str, AbilityEntry] | None:
    table = dict(hash_pairs(raw)).get("abilities")
    if table is None:
        return None
    found = {}
    for species, value in entries(table):
        if value is None or species in SPECIES_WITHOUT_RANDOM_ABILITIES:
            continue
        fields = dict(entries(value))
        found[species] = AbilityEntry(
            species=species,
            abilities=tuple(fields.get("base") or ()),
            hidden_abilities=tuple(fields.get("hidden") or ()),
            tag=tag(species),
        )
    return found


def learnsets(raw: Any, tag: Any) -> dict[str, Learnset] | None:
    if raw is None:
        return None
    found = {}
    for species, forms in entries(raw):
        for form, moves in entries(forms):
            form_id = form_species(species, form)
            found[form_id] = Learnset(
                species=form_id,
                moves=tuple(LevelMove(level, move_id(move)) for level, move in moves),
                tag=tag(species),
            )
    return found


def form_species(species: str, form: int) -> str:
    return f"{species}_{form}" if form else species


def compatibility(raw: Any, tag: Any) -> dict[str, Compatibility] | None:
    if raw is None:
        return None
    return {
        species: Compatibility(
            species=species,
            moves={move_id(move): bool(ok) for move, ok in pairs},
            tag=tag(species),
        )
        for species, pairs in entries(raw)
    }


def tm_moves(raw: Any) -> dict[str, TmMove] | None:
    if raw is None:
        return None
    return {item: TmMove(item=item, move=move_id(move), tag=WORLD) for item, move in entries(raw)}


def wild_tables(raw: Any) -> dict[int, dict[str, tuple[WildSlot, ...]]] | None:
    if raw is None:
        return None
    return {
        map_id: {
            encounter_type: tuple(
                WildSlot(
                    species=species,
                    species_tag=OPPONENT_SPECIES,
                    chance=chance,
                    min_level=min_level,
                    max_level=max_level,
                    tag=WORLD,
                )
                for chance, species, min_level, max_level in slots or ()
            )
            for encounter_type, slots in entries(types)
        }
        for map_id, types in entries(raw)
    }


def trainer_teams(
    raw: Any, abilities: dict[str, AbilityEntry] | None, connection: sqlite3.Connection
) -> dict[str, TrainerTeam] | None:
    if raw is None:
        return None
    found = {}
    for key, trainer in entries(raw):
        trainer_id = ID_SEPARATOR.join(str(part) for part in key)
        found[trainer_id] = TrainerTeam(
            trainer=trainer_id,
            party=tuple(
                opponent(member, abilities, connection)
                for member in ivars(trainer).get("party") or ()
            ),
            tag=WORLD,
        )
    return found


def opponent(
    raw: Any, abilities: dict[str, AbilityEntry] | None, connection: sqlite3.Connection
) -> OpponentPokemon:
    fields = ivars(raw)
    return OpponentPokemon(
        species=species_form(connection, fields["species"], fields.get("form")),
        species_tag=OPPONENT_SPECIES,
        level=fields.get("level"),
        moves=tuple(move_id(move) for move in fields.get("moves") or ()),
        ability=pokemon_ability(fields, abilities, connection),
        item=fields.get("item"),
        nature=fields.get("nature"),
        ivs=dict(entries(fields["iv"])) if fields.get("iv") else {},
        tag=OPPONENT_HIDDEN,
    )


def tm_marts(raw: Any, moves: dict[str, TmMove] | None) -> dict[int, TmMart] | None:
    if raw is None:
        return None
    return {
        mart: TmMart(
            mart=mart,
            stock=tuple(mart_tm(item, moves) for item in items or ()),
            tag=WORLD,
        )
        for mart, items in entries(raw)
    }


def mart_tm(raw: Any, moves: dict[str, TmMove] | None) -> MartTm:
    fields = ivars(raw)
    rolled = (moves or {}).get(fields["id"])
    return MartTm(
        item=fields["id"],
        move=rolled.move if rolled else move_id(fields.get("move")),
        tag=WORLD,
    )


def starter(
    variable: int,
    raw: Any,
    abilities: dict[str, AbilityEntry] | None,
    connection: sqlite3.Connection,
    tag: Any,
) -> Starter | None:
    if not isinstance(raw, dict) or raw.get("class") != "Pokemon":
        return None
    fields = ivars(raw)
    species = fields["species"]
    return Starter(
        variable=variable,
        species=species,
        species_tag=WORLD,
        level=fields.get("level"),
        moves=tuple(move_id(move) for move in fields.get("moves") or ()),
        ability=pokemon_ability(fields, abilities, connection),
        tag=tag(species),
    )


def pokemon_ability(
    fields: dict[str, Any],
    abilities: dict[str, AbilityEntry] | None,
    connection: sqlite3.Connection,
) -> str | None:
    if fields.get("forced_ability"):
        return fields["forced_ability"]
    if fields.get("ability"):
        return fields["ability"]
    form_id = species_form(connection, fields["species"], fields.get("form"))
    if form_id in SPECIES_WITHOUT_RANDOM_ABILITIES:
        real = gamedb.species(connection, form_id)
        return worked_ability(fields, real.abilities, real.hidden_abilities)
    found = (abilities or {}).get(form_id)
    if found is None:
        return None
    return worked_ability(fields, found.abilities, found.hidden_abilities)


def move_id(raw: Any) -> str:
    return ivars(raw)["id"] if isinstance(raw, dict) else raw


def species_form(connection: sqlite3.Connection, species: str, form: int | None) -> str:
    if not form:
        return species
    form_id = f"{species}_{form}"
    try:
        return gamedb.entry(connection, "species", form_id).id
    except gamedb.GameDbError:
        return species


def worked_ability(
    fields: dict[str, Any], natural: tuple[str, ...], hidden: tuple[str, ...]
) -> str | None:
    index = fields.get("ability_index")
    if index is None:
        index = fields["personalID"] & 1
    if index >= HIDDEN_ABILITY_INDEX:
        position = index - HIDDEN_ABILITY_INDEX
        if position < len(hidden) and hidden[position]:
            return hidden[position]
        index = fields["personalID"] & 1
    if index < len(natural) and natural[index]:
        return natural[index]
    return natural[0] if natural else None
