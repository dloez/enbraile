import csv
import io
import re
import sys
import urllib.request
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from functools import cache
from importlib.resources import files
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PBS = PROJECT_ROOT / "game" / "base" / "es-v4.14" / "PBS"
DATA_DIR = Path(__file__).resolve().parent / "data"
POKEAPI_COMMIT = "bc92d3b6029ef1abe9e7ad424c400b338f3c11fe"
POKEAPI_CSV = (
    f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{POKEAPI_COMMIT}/data/v2/csv/{{name}}.csv"
)
GENERATIONS = range(1, 6)
ABILITY_GENERATIONS = range(3, 6)
ABILITY_COUNT = 164
LAST_ABILITY = "TERAVOLT"
FIRST_POKEAPI_SPECIAL_ID = 10000
GENDER_FORMS = frozenset({"male", "female"})
SPECIES_ALIASES = {"nidoran-f": "NIDORANfE", "nidoran-m": "NIDORANmA"}
MOVE_ALIASES = {"vice-grip": "VISEGRIP"}
MEGA_KEYS = ("MegaStone", "MegaMove")
UNOFFICIAL_FORMS = frozenset(
    {
        *(f"PIKACHU_{form}" for form in range(2, 17)),
        "EEVEE_1",
        "DIALGA_1",
        "PALKIA_1",
        "KYUREM_3",
        "KYUREM_4",
    }
)
LIST_NAMES = ("species", "moves", "abilities")
TYPES_NAME = "types"
TYPE_ALIASES = {"unknown": "QMARKS"}
SECTION = re.compile(r"^\[(.+)\]\s*$")
NOT_ALPHANUMERIC = re.compile(r"[^A-Z0-9]")

Reporter = Callable[[str], None]


class AllowListError(Exception):
    pass


@dataclass(frozen=True)
class AllowLists:
    species: list[str]
    moves: list[str]
    abilities: list[str]

    def by_name(self) -> dict[str, list[str]]:
        return {"species": self.species, "moves": self.moves, "abilities": self.abilities}


def parse_pbs(path: Path) -> list[tuple[str, dict[str, str]]]:
    sections: list[tuple[str, dict[str, str]]] = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        header = SECTION.match(line)
        if header:
            sections.append((header.group(1), {}))
        elif sections and "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            sections[-1][1][key.strip()] = value.strip()
    return sections


@cache
def fetch_csv(name: str) -> list[dict[str, str]]:
    with urllib.request.urlopen(POKEAPI_CSV.format(name=name), timeout=60) as response:
        return list(csv.DictReader(io.StringIO(response.read().decode("utf-8"))))


def pbs_symbol(identifier: str, aliases: dict[str, str]) -> str:
    return aliases.get(identifier) or NOT_ALPHANUMERIC.sub("", identifier.upper())


def resolve(
    identifiers: Iterable[str], known: Iterable[str], aliases: dict[str, str]
) -> dict[str, str | None]:
    known_set = set(known)
    resolved = {identifier: pbs_symbol(identifier, aliases) for identifier in identifiers}
    return {
        identifier: symbol if symbol in known_set else None
        for identifier, symbol in resolved.items()
    }


def is_extra_gender_form(row: dict[str, str]) -> bool:
    return row["form_identifier"] in GENDER_FORMS and row["is_default"] != "1"


def build_species(pbs: Path, report: Reporter) -> list[str]:
    version_generation = {
        row["id"]: int(row["generation_id"]) for row in fetch_csv("version_groups")
    }
    official = {
        row["id"]: row["identifier"]
        for row in fetch_csv("pokemon_species")
        if int(row["generation_id"]) in GENERATIONS
    }
    pokemon_species = {row["id"]: row["species_id"] for row in fetch_csv("pokemon")}
    official_forms: Counter[str] = Counter()
    for row in fetch_csv("pokemon_forms"):
        species_id = pokemon_species[row["pokemon_id"]]
        if species_id not in official or is_extra_gender_form(row):
            continue
        if version_generation[row["introduced_in_version_group_id"]] in GENERATIONS:
            official_forms[official[species_id]] += 1

    species = parse_pbs(pbs / "pokemon.txt")
    generation = {symbol: int(data.get("Generation", "0")) for symbol, data in species}
    resolved = resolve(official.values(), generation, SPECIES_ALIASES)
    missing = sorted(identifier for identifier, symbol in resolved.items() if symbol is None)
    if missing:
        raise AllowListError(f"official species not in pokemon.txt: {', '.join(missing)}")
    identifier_of = {symbol: identifier for identifier, symbol in resolved.items()}

    allowed: list[str] = []
    for symbol, _ in species:
        if symbol not in identifier_of:
            continue
        if generation[symbol] in GENERATIONS:
            allowed.append(symbol)
        else:
            report(
                f"species {symbol} left out: pokemon.txt marks it generation {generation[symbol]}"
            )
    for section, data in parse_pbs(pbs / "pokemon_forms.txt"):
        base, form = section.split(",")
        symbol = f"{base}_{form}"
        if base not in identifier_of or symbol in UNOFFICIAL_FORMS:
            continue
        if any(key in data for key in MEGA_KEYS):
            continue
        if int(data.get("Generation", generation[base])) in GENERATIONS:
            allowed.append(symbol)

    counted = Counter(identifier_of[symbol.split("_")[0]] for symbol in allowed)
    mismatched = sorted(
        f"{identifier} ({counted[identifier]} allowed, {official_forms[identifier]} official)"
        for identifier in official.values()
        if counted[identifier] != official_forms[identifier]
    )
    if mismatched:
        raise AllowListError(f"species forms differ from PokeAPI: {', '.join(mismatched)}")
    return allowed


def build_moves(pbs: Path, report: Reporter) -> list[str]:
    official = [
        row["identifier"]
        for row in fetch_csv("moves")
        if int(row["id"]) < FIRST_POKEAPI_SPECIAL_ID and int(row["generation_id"]) in GENERATIONS
    ]
    moves = [symbol for symbol, _ in parse_pbs(pbs / "moves.txt")]
    resolved = resolve(official, moves, MOVE_ALIASES)
    absent = sorted(identifier for identifier, symbol in resolved.items() if symbol is None)
    if absent:
        report(f"official moves not in moves.txt, left out: {', '.join(absent)}")
    allowed = {symbol for symbol in resolved.values() if symbol is not None}
    return [symbol for symbol in moves if symbol in allowed]


def build_abilities(pbs: Path) -> list[str]:
    abilities = [symbol for symbol, _ in parse_pbs(pbs / "abilities.txt")]
    allowed = abilities[:ABILITY_COUNT]
    if allowed[-1] != LAST_ABILITY:
        raise AllowListError(f"ability {ABILITY_COUNT} is {allowed[-1]}, not {LAST_ABILITY}")
    official = [
        row["identifier"]
        for row in fetch_csv("abilities")
        if row["is_main_series"] == "1" and int(row["generation_id"]) in ABILITY_GENERATIONS
    ]
    resolved = resolve(official, allowed, {})
    unmatched = sorted(identifier for identifier, symbol in resolved.items() if symbol is None)
    if unmatched or len(official) != len(allowed):
        raise AllowListError(
            f"the first {ABILITY_COUNT} abilities differ from PokeAPI's Gen 3-5 set: "
            f"{len(official)} official, unmatched {', '.join(unmatched) or 'none'}"
        )
    return allowed


def official_types() -> tuple[dict[str, list[str]], dict[str, list[list[str]]]]:
    version_generation = {
        row["id"]: int(row["generation_id"]) for row in fetch_csv("version_groups")
    }
    species_name = {row["id"]: row["identifier"] for row in fetch_csv("pokemon_species")}
    type_symbol = {
        row["id"]: pbs_symbol(row["identifier"], TYPE_ALIASES) for row in fetch_csv("types")
    }
    pokemon = {row["id"]: row for row in fetch_csv("pokemon")}

    def slotted(rows: list[dict[str, str]], key: str) -> dict[str, list[str]]:
        typed: dict[str, list[tuple[int, str]]] = {}
        for row in rows:
            typed.setdefault(row[key], []).append((int(row["slot"]), type_symbol[row["type_id"]]))
        return {owner: [symbol for _, symbol in sorted(slots)] for owner, slots in typed.items()}

    pokemon_types = slotted(list(fetch_csv("pokemon_types")), "pokemon_id")
    form_types = slotted(list(fetch_csv("pokemon_form_types")), "pokemon_form_id")
    defaults: dict[str, list[str]] = {}
    forms: dict[str, list[list[str]]] = {}
    for row in fetch_csv("pokemon_forms"):
        owner = pokemon[row["pokemon_id"]]
        name = species_name[owner["species_id"]]
        if is_extra_gender_form(row):
            continue
        if version_generation[row["introduced_in_version_group_id"]] not in GENERATIONS:
            continue
        types = form_types.get(row["id"]) or pokemon_types[row["pokemon_id"]]
        if owner["is_default"] == "1" and row["is_default"] == "1":
            defaults[name] = types
        forms.setdefault(name, []).append(types)
    return defaults, forms


def build_types(pbs: Path, species: list[str], report: Reporter) -> dict[str, list[str]]:
    defaults, forms = official_types()
    names = {pbs_symbol(identifier, SPECIES_ALIASES): identifier for identifier in defaults}
    base_types = {
        symbol: data.get("Types", "").split(",") for symbol, data in parse_pbs(pbs / "pokemon.txt")
    }
    pbs_types = dict(base_types)
    for section, data in parse_pbs(pbs / "pokemon_forms.txt"):
        base, form = section.split(",")
        pbs_types[f"{base}_{form}"] = (
            data["Types"].split(",") if "Types" in data else base_types[base]
        )

    official: dict[str, list[str]] = {}
    unmatched: list[str] = []
    for symbol in species:
        base = symbol.split("_")[0]
        name = names[base]
        if symbol == base:
            official[symbol] = defaults[name]
            continue
        matches = [types for types in forms[name] if set(types) == set(pbs_types[symbol])]
        if matches:
            official[symbol] = matches[0]
        else:
            unmatched.append(f"{symbol} ({'/'.join(pbs_types[symbol])})")
    if unmatched:
        raise AllowListError(f"forms with no official form of their types: {', '.join(unmatched)}")
    retyped = [
        f"{symbol} {'/'.join(pbs_types[symbol])} to {'/'.join(types)}"
        for symbol, types in official.items()
        if pbs_types[symbol] != types
    ]
    report(f"{len(retyped)} species whose pokemon.txt types differ: {', '.join(retyped)}")
    return official


def write_data(name: str, lines: list[str], report: Reporter) -> None:
    path = DATA_DIR / f"{name}.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
    report(f"{len(lines)} {name} written to {path}")


def build(pbs: Path, report: Reporter) -> AllowLists:
    lists = AllowLists(
        species=build_species(pbs, report),
        moves=build_moves(pbs, report),
        abilities=build_abilities(pbs),
    )
    types = build_types(pbs, lists.species, report)
    for name, symbols in lists.by_name().items():
        write_data(name, symbols, report)
    write_data(TYPES_NAME, [" ".join([symbol, *types[symbol]]) for symbol in types], report)
    return lists


def load() -> AllowLists:
    data = files("anil.mod") / "data"
    lists = {
        name: (data / f"{name}.txt").read_text(encoding="utf-8").split() for name in LIST_NAMES
    }
    return AllowLists(**lists)


def load_types() -> dict[str, list[str]]:
    text = (files("anil.mod") / "data" / f"{TYPES_NAME}.txt").read_text(encoding="utf-8")
    return {symbol: types for symbol, *types in (line.split() for line in text.splitlines())}


def main() -> None:
    pbs = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PBS
    try:
        build(pbs, print)
    except AllowListError as error:
        sys.exit(f"allow-list build failed: {error}")


if __name__ == "__main__":
    main()
