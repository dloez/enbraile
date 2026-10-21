import sys
import unicodedata
from collections.abc import Iterable
from importlib.resources import files
from pathlib import Path

from anil.mod.allowlists import (
    DATA_DIR,
    DEFAULT_PBS,
    MOVE_ALIASES,
    SPECIES_ALIASES,
    TYPE_ALIASES,
    AllowListError,
    Reporter,
    fetch_csv,
    load,
    parse_pbs,
    pbs_symbol,
)

ENGLISH = "9"
NAMES_FILE = "showdown.txt"
KINDS = ("species", "items", "abilities", "moves", "natures")
SPECIES_NAMES = {"nidoran-f": "Nidoran-F", "nidoran-m": "Nidoran-M"}
ITEM_ALIASES = {
    "stick": "LEEK",
    "pretty-wing": "PRETTYFEATHER",
    **{f"{stat}-wing": f"{stat.upper()}FEATHER" for stat in ("health", "muscle", "resist")},
    **{f"{stat}-wing": f"{stat.upper()}FEATHER" for stat in ("genius", "clever", "swift")},
}
UNOWN_LETTERS = "bcdefghijklmnopqrstuvwxyz"
FORMS = {
    "PICHU_2": "spiky-eared",
    **{f"UNOWN_{index}": letter for index, letter in enumerate(UNOWN_LETTERS, start=1)},
    "UNOWN_26": "question",
    "UNOWN_27": "exclamation",
    "CASTFORM_1": "sunny",
    "CASTFORM_2": "rainy",
    "CASTFORM_3": "snowy",
    "DEOXYS_1": "attack",
    "DEOXYS_2": "defense",
    "DEOXYS_3": "speed",
    "BURMY_1": "sandy",
    "BURMY_2": "trash",
    "WORMADAM_1": "sandy",
    "WORMADAM_2": "trash",
    "CHERRIM_1": "sunshine",
    "SHELLOS_1": "east",
    "GASTRODON_1": "east",
    "ROTOM_1": "heat",
    "ROTOM_2": "wash",
    "ROTOM_3": "frost",
    "ROTOM_4": "fan",
    "ROTOM_5": "mow",
    "GIRATINA_1": "origin",
    "SHAYMIN_1": "sky",
    "DARMANITAN_1": "zen",
    "DEERLING_1": "summer",
    "DEERLING_2": "autumn",
    "DEERLING_3": "winter",
    "SAWSBUCK_1": "summer",
    "SAWSBUCK_2": "autumn",
    "SAWSBUCK_3": "winter",
    "TORNADUS_1": "therian",
    "THUNDURUS_1": "therian",
    "LANDORUS_1": "therian",
    "KYUREM_1": "white",
    "KYUREM_2": "black",
    "KELDEO_1": "resolute",
    "MELOETTA_1": "pirouette",
    "GENESECT_1": "shock",
    "GENESECT_2": "burn",
    "GENESECT_3": "chill",
    "GENESECT_4": "douse",
    "BASCULIN_2": "",
    "BASCULIN_3": "blue-striped",
}
TYPED_FORMS = "ARCEUS"


def plain(name: str) -> str:
    decomposed = unicodedata.normalize("NFKD", name)
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def english(csv_name: str, key: str) -> dict[str, str]:
    return {
        row[key]: plain(row["name"])
        for row in fetch_csv(csv_name)
        if row["local_language_id"] == ENGLISH
    }


def named(
    kind: str,
    rows: Iterable[dict[str, str]],
    names: dict[str, str],
    known: list[str],
    aliases: dict[str, str],
    report: Reporter,
) -> dict[str, str]:
    by_symbol: dict[str, str] = {}
    for row in rows:
        if row["id"] in names:
            by_symbol.setdefault(pbs_symbol(row["identifier"], aliases), names[row["id"]])
    mapped = {symbol: by_symbol[symbol] for symbol in known if by_symbol.get(symbol)}
    unmapped = [symbol for symbol in known if symbol not in mapped]
    report(
        f"{len(mapped)} {kind} named; {len(unmapped)} with no Showdown name: "
        f"{', '.join(unmapped) or 'none'}"
    )
    return mapped


def form_suffix(form: str) -> str:
    return "-".join(part.capitalize() for part in form.split("-"))


def species_names(pbs: Path, report: Reporter) -> dict[str, str]:
    names = english("pokemon_species_names", "pokemon_species_id")
    rows = fetch_csv("pokemon_species")
    for row in rows:
        if row["identifier"] in SPECIES_NAMES:
            names[row["id"]] = SPECIES_NAMES[row["identifier"]]
    known = [symbol for symbol, _ in parse_pbs(pbs / "pokemon.txt")]
    base = named("species", rows, names, known, SPECIES_ALIASES, report)
    identifiers = {
        pbs_symbol(row["identifier"], SPECIES_ALIASES): row["identifier"] for row in rows
    }
    official_forms = {
        (row["identifier"].removesuffix(f"-{row['form_identifier']}"), row["form_identifier"])
        for row in fetch_csv("pokemon_forms")
    }
    forms = dict(FORMS)
    for section, data in parse_pbs(pbs / "pokemon_forms.txt"):
        species, form = section.split(",")
        if species == TYPED_FORMS and data.get("Types") not in TYPE_ALIASES.values():
            forms[f"{species}_{form}"] = data["Types"].lower()
    for symbol, form in forms.items():
        species = symbol.split("_")[0]
        if form and (identifiers[species], form) not in official_forms:
            raise AllowListError(f"form {symbol} maps to {form}, which PokeAPI lacks")
        base[symbol] = f"{base[species]}-{form_suffix(form)}" if form else base[species]
    allowed = load().species
    missing = [symbol for symbol in allowed if symbol not in base]
    report(f"allowed species-forms with no Showdown name: {', '.join(missing) or 'none'}")
    return base


def build(pbs: Path, report: Reporter) -> dict[str, dict[str, str]]:
    natures = fetch_csv("natures")
    tables = {
        "species": species_names(pbs, report),
        "items": named(
            "items",
            fetch_csv("items"),
            english("item_names", "item_id"),
            [symbol for symbol, _ in parse_pbs(pbs / "items.txt")],
            ITEM_ALIASES,
            report,
        ),
        "abilities": named(
            "abilities",
            fetch_csv("abilities"),
            english("ability_names", "ability_id"),
            [symbol for symbol, _ in parse_pbs(pbs / "abilities.txt")],
            {},
            report,
        ),
        "moves": named(
            "moves",
            fetch_csv("moves"),
            english("move_names", "move_id"),
            [symbol for symbol, _ in parse_pbs(pbs / "moves.txt")],
            MOVE_ALIASES,
            report,
        ),
        "natures": named(
            "natures",
            natures,
            english("nature_names", "nature_id"),
            [pbs_symbol(row["identifier"], {}) for row in natures],
            {},
            report,
        ),
    }
    lines = [
        f"{kind} {symbol} {name}"
        for kind, table in tables.items()
        for symbol, name in table.items()
    ]
    path = DATA_DIR / NAMES_FILE
    path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
    report(f"{len(lines)} Showdown names written to {path}")
    return tables


def load_names() -> dict[str, dict[str, str]]:
    text = (files("anil.mod") / "data" / NAMES_FILE).read_text(encoding="utf-8")
    tables: dict[str, dict[str, str]] = {kind: {} for kind in KINDS}
    for line in text.splitlines():
        kind, symbol, name = line.split(" ", 2)
        tables[kind][symbol] = name
    return tables


def main() -> None:
    pbs = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PBS
    try:
        build(pbs, print)
    except AllowListError as error:
        sys.exit(f"Showdown name build failed: {error}")


if __name__ == "__main__":
    main()
