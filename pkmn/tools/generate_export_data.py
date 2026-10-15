# /// script
# requires-python = ">=3.11"
# dependencies = ["rubymarshal==1.2.10"]
# ///

import json
import re
import sys
from pathlib import Path

from rubymarshal.reader import load

EXPORT = Path(__file__).with_name("export_data.py")
DEFAULT_WONDER = Path.home() / "workspace" / "wonder"
RANDOMLOCKE = Path("packages/randomlocke/src/randomlocke")
GAME_DATA = Path("game/base/es-v4.14/Data")
RANDOMIZER_CONFIG = Path(
    "game/extracted/es-v4.14/plugins/Random Pokemon & Moves + Randomizer EX (Abilities)/000_Config.rb"
)
SHOWDOWN_KINDS = ("species", "abilities", "items", "moves", "natures")
SHOWDOWN_TYPES = {
    "NORMAL", "FIGHTING", "FLYING", "POISON", "GROUND", "ROCK", "BUG", "GHOST", "STEEL",
    "FIRE", "WATER", "GRASS", "ELECTRIC", "PSYCHIC", "ICE", "DRAGON", "DARK", "FAIRY",
}
LEVEL_METHODS = {
    "Level", "LevelMale", "LevelFemale", "LevelDay", "LevelNight", "LevelMorning",
    "LevelAfternoon", "LevelEvening", "LevelNoWeather", "LevelSun", "LevelRain", "LevelSnow",
    "LevelSandstorm", "LevelCycling", "LevelSurfing", "LevelDiving", "LevelDarkness",
    "LevelDarkInParty", "AttackGreater", "AtkDefEqual", "DefenseGreater", "Silcoon",
    "Cascoon", "Ninjask",
}
BLOCK = re.compile(r"^DATA = \{\n.*?^\}\n", re.MULTILINE | re.DOTALL)


def showdown_id(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def symbol(value) -> str:
    return value.name


def attribute(game_object, name: str):
    return game_object.attributes[f"@{name}"]


def read_lines(path: Path) -> list[list[str]]:
    return [line.split() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def showdown_ids(wonder: Path) -> dict[str, dict[str, str]]:
    tables: dict[str, dict[str, str]] = {kind: {} for kind in SHOWDOWN_KINDS}
    text = (wonder / RANDOMLOCKE / "data" / "showdown.txt").read_text(encoding="utf-8")
    for line in text.splitlines():
        kind, game_id, name = line.split(" ", 2)
        tables[kind][game_id] = showdown_id(name)
    return tables


def randomlocke_version(wonder: Path) -> int:
    source = (wonder / RANDOMLOCKE / "sources.py").read_text(encoding="utf-8")
    match = re.search(r"^VERSION = (\d+)$", source, re.MULTILINE)
    if not match:
        sys.exit("no VERSION in Wonder's randomlocke sources.py")
    return int(match.group(1))


def read_marshal(path: Path) -> dict:
    with path.open("rb") as handle:
        return {symbol(key): value for key, value in load(handle).items()}


def fixed_abilities(wonder: Path, species: dict, named: dict[str, str]) -> dict[str, dict[str, list[str]]]:
    config = (wonder / RANDOMIZER_CONFIG).read_text(encoding="utf-8")
    match = re.search(r"SPECIES_WITHOUT_RANDOM_ABS\s*=\s*\[([^\]]*)\]", config)
    if not match:
        sys.exit(f"no SPECIES_WITHOUT_RANDOM_ABS in {RANDOMIZER_CONFIG}")
    return {
        game_id: {
            "base": [symbol(ability) for ability in attribute(species[game_id], "abilities")],
            "hidden": [symbol(ability) for ability in attribute(species[game_id], "hidden_abilities")],
        }
        for game_id in re.findall(r":(\w+)", match.group(1))
        if game_id in named and game_id in species
    }


def species_types(species: dict, mod_types: dict[str, list[str]], named: dict[str, str]) -> dict[str, list[str]]:
    types = {}
    for game_id in named:
        listed = mod_types.get(game_id) or [symbol(kind) for kind in attribute(species[game_id], "types")]
        unknown = [kind for kind in listed if kind not in SHOWDOWN_TYPES]
        if unknown:
            sys.exit(f"{game_id} has types with no Showdown ID: {', '.join(unknown)}")
        types[game_id] = [kind.lower() for kind in listed]
    return types


def level_evolutions(species: dict, allowed: set[str]) -> dict[str, list[list]]:
    evolutions = {}
    for game_id, data in species.items():
        entries = [
            [symbol(entry[0]), symbol(entry[1]), entry[2]]
            for entry in attribute(data, "evolutions")
            if len(entry) == 4
            and entry[3] is False
            and symbol(entry[1]) in LEVEL_METHODS
            and symbol(entry[0]) in allowed
        ]
        if entries:
            evolutions[game_id] = entries
    return evolutions


def build(wonder: Path) -> dict:
    showdown = showdown_ids(wonder)
    data_dir = wonder / RANDOMLOCKE / "data"
    mod_types = {line[0]: line[1:] for line in read_lines(data_dir / "types.txt")}
    allowed = {line[0] for line in read_lines(data_dir / "species.txt")}
    species = read_marshal(wonder / GAME_DATA / "species.dat")
    items = read_marshal(wonder / GAME_DATA / "items.dat")
    return {
        "randomlocke_version": randomlocke_version(wonder),
        "showdown": showdown,
        "types": species_types(species, mod_types, showdown["species"]),
        "fixed_abilities": fixed_abilities(wonder, species, showdown["species"]),
        "pockets": {game_id: attribute(item, "pocket") for game_id, item in items.items()},
        "tm_moves": {
            game_id: symbol(attribute(item, "move"))
            for game_id, item in items.items()
            if game_id.startswith("TM") and attribute(item, "move") is not None
        },
        "level_evolutions": level_evolutions(species, allowed),
    }


def literal(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def render(data: dict) -> str:
    lines = ["DATA = {"]
    for key, value in data.items():
        if isinstance(value, dict) and value and all(isinstance(inner, dict) for inner in value.values()):
            lines.append(f"    {literal(key)}: {{")
            for kind, table in value.items():
                lines.append(f"        {literal(kind)}: {{")
                lines.extend(f"            {literal(k)}: {literal(v)}," for k, v in table.items())
                lines.append("        },")
            lines.append("    },")
        elif isinstance(value, dict):
            lines.append(f"    {literal(key)}: {{")
            lines.extend(f"        {literal(k)}: {literal(v)}," for k, v in value.items())
            lines.append("    },")
        else:
            lines.append(f"    {literal(key)}: {literal(value)},")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> None:
    wonder = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_WONDER
    data = build(wonder)
    script = EXPORT.read_text(encoding="utf-8")
    if not BLOCK.search(script):
        sys.exit(f"no DATA block in {EXPORT}")
    updated = BLOCK.sub(lambda _: render(data), script, count=1)
    if updated != script:
        EXPORT.write_text(updated, encoding="utf-8")
    counts = ", ".join(f"{len(table)} {kind}" for kind, table in data["showdown"].items())
    print(
        f"Randomlocke version {data['randomlocke_version']}; Showdown IDs: {counts}; "
        f"{len(data['types'])} species-form types, {len(data['fixed_abilities'])} with fixed abilities, {len(data['pockets'])} item pockets, "
        f"{len(data['tm_moves'])} TM moves, {len(data['level_evolutions'])} species with "
        f"level-up evolutions; written to {EXPORT}"
    )


if __name__ == "__main__":
    main()
