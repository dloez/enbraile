import hashlib
import json
import re
import sqlite3
from collections.abc import Iterator
from contextlib import closing
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path
from typing import Any, Literal

from rubymarshal.classes import RubyObject, RubyString, Symbol

from anil.harness.state import ID_SEPARATOR
from anil.harness.world import READER_VERSION as WORLD_READER_VERSION
from anil.harness.world import SCRIPT_MORE, WorldError, attrs, load, mapping, open_world
from anil.install.builds import Build
from anil.install.game_files import GamePaths
from anil.mod.allowlists import load as load_allow_lists
from anil.mod.allowlists import load_types
from anil.mod.showdown import load_names
from anil.mod.sources import VERSION as RANDOMLOCKE_VERSION
from anil.settings import Settings

READER_VERSION = 3
RANDOMLOCKE_DATA_FILES = ("species", "moves", "abilities", "types", "showdown")

type Tag = Literal[
    "world", "opponent_species", "opponent_hidden", "revealed", "own", "unowned_random"
]
type Kind = Literal[
    "species", "moves", "abilities", "items", "types", "statuses", "trainer_types", "trainers"
]
WORLD: Tag = "world"
OPPONENT_HIDDEN: Tag = "opponent_hidden"
REVEALED: Tag = "revealed"
DAT_KINDS: tuple[Kind, ...] = ("species", "moves", "abilities", "items", "types")
TRAINER_KINDS: tuple[Kind, ...] = ("trainer_types", "trainers")
KINDS: tuple[Kind, ...] = (*DAT_KINDS, "statuses", *TRAINER_KINDS)
PREVOLUTION_FLAG = 3
ALLOW_LISTED: frozenset[Kind] = frozenset({"species", "moves", "abilities"})
SHOWDOWN_KINDS: dict[Kind, str] = {
    "species": "species",
    "moves": "moves",
    "abilities": "abilities",
    "items": "items",
}
GAME_CLASSES: dict[Kind, str] = {
    "species": "GameData::Species",
    "moves": "GameData::Move",
    "abilities": "GameData::Ability",
    "items": "GameData::Item",
    "types": "GameData::Type",
    "statuses": "GameData::Status",
    "trainer_types": "GameData::TrainerType",
    "trainers": "GameData::Trainer",
}

STATUS_SECTION = "_Status.rb"
STATUS_REGISTER = re.compile(r"GameData::Status\.register\(\{(.*?)\}\)", re.DOTALL)
STATUS_FIELD = re.compile(r":(\w+)\s*=>\s*(.+?),?\s*$", re.MULTILINE)
STATUS_FIELDS = {"id": "@id", "name": "@real_name", "animation": "@animation"}
STATUS_ICON = "@icon_position"
STATUS_DEFAULTS: dict[str, Any] = {
    "@real_name": "Sin nombre",
    "@animation": None,
    STATUS_ICON: 0,
}
FROSTBITE = "FROSTBITE"
FROZEN = "FROZEN"
SYMBOL_VALUE = re.compile(r":(\w+)")
STRING_VALUE = re.compile(r'(?:_INTL\()?"((?:[^"\\]|\\.)*)"\)?')
INTEGER_VALUE = re.compile(r"-?\d+")

type LocationKind = Literal[
    "item_ball", "hidden_item", "item_gift", "gift_pokemon", "mart", "tm_mart"
]
ITEM_KINDS: frozenset[LocationKind] = frozenset({"item_ball", "hidden_item"})
type Randomness = Literal["none", "item", "tm_move", "species", "stock", "run_time"]
RANDOMIZER_CONFIG = Path("Random Pokemon & Moves + Randomizer EX (Abilities)", "000_Config.rb")
UNRANDOMIZABLE_ITEMS = "UNRANDOMIZABLE_ITEMS"
UNRANDOMIZABLE_POKEMON = "UNRANDOMIZABLE_POKEMON"
CONFIG_SYMBOLS = re.compile(r"^\s*(\w+)\s*=\s*\[([^\]]*)\]", re.MULTILINE)
ITEM_CALLS = ("pbItemBall", "pbReceiveItem")
POKEMON_CALLS = ("pbAddPokemon", "pbAddPokemonSilent", "pbAddToParty", "pbAddForeignPokemon")
RANDOM_POKEMON_CALLS = frozenset({"pbAddPokemon", "pbAddPokemonSilent"})
BAG_ADD = "$bag.add"
MART_CALL = "pbPokemonMart"
TM_MART_CALL = "RandomizedChallenge.tm_mart"
CALL = re.compile(
    r"(?<![\w.])("
    + "|".join(re.escape(name) for name in (*ITEM_CALLS, *POKEMON_CALLS))
    + r"|\$bag\.add|pbPokemonMart|RandomizedChallenge\.tm_mart)\("
)
SYMBOL_ARGUMENT = re.compile(r":(\w+)")
SAMPLED_SYMBOLS = re.compile(r"\[((?:\s*:\w+\s*,?)+)\]\.sample")
NEW_POKEMON = re.compile(r"(\w+)\s*=\s*Pokemon\.new\(:(\w+)\s*,\s*(\d+)")
ITEM_BALL_GRAPHICS = frozenset({"objeto", "megapiedra"})
ACTION_TRIGGER = 0
KEY_ITEM_FLAG = "KeyItem"
MEGA_STONE_FLAG = "MegaStone"
FIELD_USE_TM = 3
FIELD_USE_HM = 4
FIELD_USE_TR = 5
OPEN_BRACKETS = "([{"
CLOSE_BRACKETS = ")]}"

NORMAL_EFFECTIVE = 2
SUPER_EFFECTIVE = 4
NOT_VERY_EFFECTIVE = 1
INEFFECTIVE = 0
MOVE_CATEGORIES = ("physical", "special", "status")
STATS = ("HP", "ATTACK", "DEFENSE", "SPECIAL_ATTACK", "SPECIAL_DEFENSE", "SPEED")

SCHEMA = """
create table meta (key text primary key, value text not null);
create table entries (
    kind text not null, id text not null, position integer not null, name text not null,
    allowed integer, showdown text, raw text not null, primary key (kind, id)
);
create table retyped (id text primary key, file_types text not null);
create table locations (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, call integer not null, map_name text not null,
    x integer not null, y integer not null, kind text not null, items text not null,
    quantity integer, species text, level integer, random text not null, script text not null,
    primary key (map_id, event_id, page, command, call)
);
"""

Raw = dict[str, Any]


class GameDbError(Exception):
    pass


@dataclass(frozen=True)
class GameDbCounts:
    stamp: str
    entries: dict[str, int]
    allowed: dict[str, int]
    retyped: int
    locations: dict[str, int]


def plain(value: object) -> Any:
    if isinstance(value, Symbol):
        return value.name
    if isinstance(value, RubyString):
        return value.text
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    if isinstance(value, list | tuple):
        return [plain(item) for item in value]
    if isinstance(value, dict):
        return {str(plain(key)): plain(item) for key, item in value.items()}
    if isinstance(value, RubyObject):
        raise GameDbError(f"unexpected Ruby object {value.ruby_class_name} in game data")
    return value


def entry_id(key: Any) -> str:
    if isinstance(key, list):
        return ID_SEPARATOR.join(str(part) for part in key)
    return key


def randomlocke_data_hash() -> str:
    data = files("anil.mod") / "data"
    digest = hashlib.sha256()
    for name in RANDOMLOCKE_DATA_FILES:
        digest.update((data / f"{name}.txt").read_bytes())
    return digest.hexdigest()[:16]


def stamp(build: Build) -> str:
    return (
        f"{READER_VERSION}:{build.name}:{build.scripts_sha256}:world{WORLD_READER_VERSION}:"
        f"randomlocke{RANDOMLOCKE_VERSION}:{randomlocke_data_hash()}"
    )


def gamedb_path(build: Build, settings: Settings) -> Path:
    return settings.gamedb / f"{build.name}.sqlite"


def stamp_of(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        with closing(sqlite3.connect(path)) as connection:
            row = connection.execute("select value from meta where key = 'stamp'").fetchone()
    except sqlite3.DatabaseError:
        return None
    return row[0] if row else None


def open_gamedb(build: Build, settings: Settings, *, rebuild: bool = False) -> sqlite3.Connection:
    path = gamedb_path(build, settings)
    if not rebuild and stamp_of(path) == stamp(build):
        return sqlite3.connect(path)
    build_gamedb(build, settings, path)
    return sqlite3.connect(path)


def build_gamedb(build: Build, settings: Settings, path: Path) -> None:
    paths = GamePaths.for_build(build)
    data = paths.base / "Data"
    if not data.is_dir():
        raise GameDbError(f"no game data at {data}; run `anil install`")
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.with_name(f".{path.name}.building")
    staging.unlink(missing_ok=True)
    connection = sqlite3.connect(staging)
    try:
        connection.executescript(SCHEMA)
        write_entries(connection, data, paths.extracted / "scripts")
        try:
            world = open_world(build, settings)
        except WorldError as error:
            raise GameDbError(str(error)) from error
        with closing(world):
            write_locations(connection, world, read_unrandomizable(paths.extracted / "plugins"))
        connection.execute("insert into meta values ('stamp', ?)", (stamp(build),))
        connection.commit()
    finally:
        connection.close()
    staging.replace(path)


def read_dat(data: Path, kind: Kind) -> list[tuple[str, Raw]]:
    try:
        loaded = mapping(load(data / f"{kind}.dat"))
    except WorldError as error:
        raise GameDbError(str(error)) from error
    return [(entry_id(plain(key)), plain(attrs(value))) for key, value in loaded.items()]


def status_value(source: str) -> Any:
    if match := SYMBOL_VALUE.fullmatch(source):
        return match.group(1)
    if match := STRING_VALUE.fullmatch(source):
        return match.group(1)
    if INTEGER_VALUE.fullmatch(source):
        return int(source)
    raise GameDbError(f"unreadable status field value {source!r}")


def read_statuses(scripts: Path) -> list[tuple[str, Raw]]:
    sections = sorted(scripts.glob(f"*{STATUS_SECTION}")) if scripts.is_dir() else []
    if len(sections) != 1:
        raise GameDbError(
            f"expected one *{STATUS_SECTION} script section in {scripts}, found {len(sections)}; "
            "run `anil install`"
        )
    statuses: list[tuple[str, Raw]] = []
    for block in STATUS_REGISTER.finditer(sections[0].read_text(encoding="utf-8")):
        fields = {key: status_value(value) for key, value in STATUS_FIELD.findall(block.group(1))}
        raw: Raw = dict(STATUS_DEFAULTS)
        raw.update({STATUS_FIELDS[key]: fields[key] for key in STATUS_FIELDS if key in fields})
        if "icon_position" in fields:
            raw[STATUS_ICON] = fields["icon_position"]
        statuses.append((raw["@id"], raw))
    return freeze_overlay(statuses)


def freeze_overlay(statuses: list[tuple[str, Raw]]) -> list[tuple[str, Raw]]:
    ids = [status_id for status_id, _ in statuses]
    if FROSTBITE not in ids:
        return statuses
    restored: list[tuple[str, Raw]] = []
    for status_id, raw in statuses:
        if status_id == FROZEN:
            continue
        if status_id == FROSTBITE:
            raw = {**raw, "@id": FROZEN}
            status_id = FROZEN
        restored.append((status_id, raw))
    return restored


def write_entries(connection: sqlite3.Connection, data: Path, scripts: Path) -> None:
    lists = load_allow_lists().by_name()
    allowed = {kind: frozenset(lists[kind]) for kind in ALLOW_LISTED}
    official = load_types()
    names = load_names()
    for kind in KINDS:
        loaded = read_statuses(scripts) if kind == "statuses" else read_dat(data, kind)
        showdown = names.get(SHOWDOWN_KINDS[kind], {}) if kind in SHOWDOWN_KINDS else {}
        for position, (entry_id, raw) in enumerate(loaded):
            if kind == "species" and entry_id in official:
                file_types = raw["@types"]
                if file_types != official[entry_id]:
                    raw["@types"] = official[entry_id]
                    connection.execute(
                        "insert into retyped values (?, ?)", (entry_id, json.dumps(file_types))
                    )
            connection.execute(
                "insert into entries values (?, ?, ?, ?, ?, ?, ?)",
                (
                    kind,
                    entry_id,
                    position,
                    raw.get("@real_name") or "",
                    (entry_id in allowed[kind]) if kind in allowed else None,
                    showdown.get(entry_id),
                    json.dumps(raw, ensure_ascii=False),
                ),
            )


def read_unrandomizable(plugins: Path) -> dict[str, frozenset[str]]:
    config = plugins / RANDOMIZER_CONFIG
    if not config.is_file():
        raise GameDbError(f"no randomizer config at {config}; run `anil install`")
    found = {
        name: frozenset(SYMBOL_ARGUMENT.findall(body))
        for name, body in CONFIG_SYMBOLS.findall(config.read_text(encoding="utf-8"))
    }
    for name in (UNRANDOMIZABLE_ITEMS, UNRANDOMIZABLE_POKEMON):
        if name not in found:
            raise GameDbError(f"no {name} list in {config}")
    return found


@dataclass(frozen=True)
class ScriptBlock:
    command: int
    text: str


@dataclass(frozen=True)
class EventPage:
    map_id: int
    event_id: int
    page: int
    map_name: str
    x: int
    y: int
    character_name: str
    tile_id: int
    trigger: int
    blocks: tuple[ScriptBlock, ...]

    @property
    def text(self) -> str:
        return "\n".join(block.text for block in self.blocks)


@dataclass(frozen=True)
class Call:
    block: ScriptBlock
    index: int
    name: str
    arguments: tuple[str, ...]
    source: str


@dataclass(frozen=True)
class FoundLocation:
    kind: LocationKind
    items: tuple[str, ...]
    quantity: int | None
    species: str | None
    level: int | None
    random: Randomness


def uncommented(lines: list[str]) -> str:
    return "\n".join(line for line in lines if not line.lstrip().startswith("#"))


def event_pages(world: sqlite3.Connection) -> Iterator[EventPage]:
    blocks: dict[tuple[int, int, int], list[ScriptBlock]] = {}
    lines: list[str] = []
    key: tuple[int, int, int] | None = None
    start = last = -1
    for map_id, event_id, page, command, code, text in world.execute(
        "select map_id, event_id, page, command, code, text from scripts "
        "order by map_id, event_id, page, command"
    ):
        row_key = (map_id, event_id, page)
        if code == SCRIPT_MORE and row_key == key and command == last + 1 and lines:
            lines.append(text)
            last = command
            continue
        if key is not None and lines:
            blocks.setdefault(key, []).append(ScriptBlock(start, uncommented(lines)))
        key, start, last, lines = row_key, command, command, [text]
    if key is not None and lines:
        blocks.setdefault(key, []).append(ScriptBlock(start, uncommented(lines)))
    for row in world.execute(
        "select pages.map_id, pages.event_id, pages.page, maps.name, events.x, events.y, "
        "pages.character_name, pages.tile_id, pages.trigger from pages "
        "join events using (map_id, event_id) join maps on maps.id = pages.map_id "
        "order by pages.map_id, pages.event_id, pages.page"
    ):
        found = blocks.get((row[0], row[1], row[2]))
        if found:
            yield EventPage(*row, blocks=tuple(found))


def call_arguments(text: str, start: int) -> tuple[tuple[str, ...], int] | None:
    arguments: list[str] = []
    current: list[str] = []
    depth = 0
    quote: str | None = None
    index = start
    while index < len(text):
        char = text[index]
        if quote is not None:
            current.append(char)
            if char == "\\" and index + 1 < len(text):
                index += 1
                current.append(text[index])
            elif char == quote:
                quote = None
        elif char in "\"'":
            quote = char
            current.append(char)
        elif char in OPEN_BRACKETS:
            depth += 1
            current.append(char)
        elif char in CLOSE_BRACKETS and depth == 0:
            arguments.append("".join(current).strip())
            return tuple(arguments) if arguments != [""] else (), index + 1
        elif char in CLOSE_BRACKETS:
            depth -= 1
            current.append(char)
        elif char == "," and depth == 0:
            arguments.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        index += 1
    return None


def page_calls(page: EventPage) -> Iterator[Call]:
    for block in page.blocks:
        for index, match in enumerate(CALL.finditer(block.text)):
            parsed = call_arguments(block.text, match.end())
            if parsed is None:
                raise GameDbError(
                    f"unclosed {match.group(1)} call on map {page.map_id} event {page.event_id} "
                    f"page {page.page}"
                )
            arguments, end = parsed
            yield Call(block, index, match.group(1), arguments, block.text[match.start() : end])


def integer_argument(arguments: tuple[str, ...], position: int, default: int) -> int | None:
    if len(arguments) <= position:
        return default
    argument = arguments[position]
    return int(argument) if INTEGER_VALUE.fullmatch(argument) else None


def item_choices(argument: str) -> tuple[str, ...]:
    if match := SYMBOL_VALUE.fullmatch(argument):
        return (match.group(1),)
    if match := SAMPLED_SYMBOLS.fullmatch(argument):
        return tuple(SYMBOL_ARGUMENT.findall(match.group(1)))
    return ()


def item_randomness(item_data: Raw, item_id: str, unrandomizable: frozenset[str]) -> Randomness:
    flags = item_data["@flags"]
    field_use = item_data["@field_use"]
    if (
        item_id in unrandomizable
        or KEY_ITEM_FLAG in flags
        or MEGA_STONE_FLAG in flags
        or field_use == FIELD_USE_HM
    ):
        return "none"
    if field_use in (FIELD_USE_TM, FIELD_USE_TR):
        return "tm_move"
    return "item"


def one_randomness(found: set[Randomness]) -> Randomness:
    return found.pop() if len(found) == 1 else "run_time"


def item_kind(page: EventPage) -> LocationKind:
    if page.character_name in ITEM_BALL_GRAPHICS or (not page.character_name and page.tile_id):
        return "item_ball"
    if not page.character_name and page.trigger == ACTION_TRIGGER:
        return "hidden_item"
    return "item_gift"


class LocationMiner:
    def __init__(self, items: dict[str, Raw], unrandomizable: dict[str, frozenset[str]]) -> None:
        self.items = items
        self.unrandomizable_items = unrandomizable[UNRANDOMIZABLE_ITEMS]
        self.unrandomizable_pokemon = unrandomizable[UNRANDOMIZABLE_POKEMON]

    def known_items(self, choices: tuple[str, ...], page: EventPage) -> tuple[str, ...]:
        missing = [item_id for item_id in choices if item_id not in self.items]
        if missing:
            raise GameDbError(
                f"map {page.map_id} event {page.event_id} names items the item data lacks: "
                f"{', '.join(missing)}"
            )
        return choices

    def item(self, page: EventPage, call: Call) -> FoundLocation:
        choices = self.known_items(item_choices(call.arguments[0]) if call.arguments else (), page)
        if call.name == BAG_ADD or (len(call.arguments) > 3 and call.arguments[3] == "false"):
            random: Randomness = "none" if choices else "run_time"
        else:
            random = one_randomness(
                {
                    item_randomness(self.items[item_id], item_id, self.unrandomizable_items)
                    for item_id in choices
                }
            )
        return FoundLocation(
            item_kind(page), choices, integer_argument(call.arguments, 1, 1), None, None, random
        )

    def pokemon(self, page: EventPage, call: Call) -> FoundLocation:
        first = call.arguments[0] if call.arguments else ""
        if match := SYMBOL_VALUE.fullmatch(first):
            species = match.group(1)
            random: Randomness = (
                "run_time"
                if call.name not in RANDOM_POKEMON_CALLS
                else "none"
                if species in self.unrandomizable_pokemon
                else "species"
            )
            return FoundLocation(
                "gift_pokemon", (), None, species, integer_argument(call.arguments, 1, 1), random
            )
        made = {
            name: (species, int(level)) for name, species, level in NEW_POKEMON.findall(page.text)
        }
        species, level = made.get(first, (None, None))
        return FoundLocation("gift_pokemon", (), None, species, level, "run_time")

    def page(self, page: EventPage) -> Iterator[tuple[Call, FoundLocation]]:
        calls = list(page_calls(page))
        tm_marts = [call for call in calls if call.name == TM_MART_CALL]
        fixed_lists = tuple(
            item_id
            for call in calls
            if call.name == MART_CALL and call.arguments and call.arguments[0].startswith("[")
            for item_id in SYMBOL_ARGUMENT.findall(call.arguments[0])
        )
        for call in calls:
            if call.name in ITEM_CALLS or call.name == BAG_ADD:
                yield call, self.item(page, call)
            elif call.name in POKEMON_CALLS:
                yield call, self.pokemon(page, call)
            elif call.name == TM_MART_CALL:
                yield (
                    call,
                    FoundLocation(
                        "tm_mart",
                        self.known_items(fixed_lists, page),
                        integer_argument(call.arguments, 1, 0),
                        None,
                        None,
                        "stock",
                    ),
                )
            elif call.name == MART_CALL and not tm_marts:
                listed = call.arguments[0] if call.arguments else ""
                stock = tuple(SYMBOL_ARGUMENT.findall(listed)) if listed.startswith("[") else ()
                yield (
                    call,
                    FoundLocation(
                        "mart",
                        self.known_items(stock, page),
                        None,
                        None,
                        None,
                        "none" if stock else "run_time",
                    ),
                )


def write_locations(
    connection: sqlite3.Connection,
    world: sqlite3.Connection,
    unrandomizable: dict[str, frozenset[str]],
) -> None:
    items = {
        item_id: json.loads(raw)
        for item_id, raw in connection.execute("select id, raw from entries where kind = 'items'")
    }
    miner = LocationMiner(items, unrandomizable)
    for page in event_pages(world):
        for call, found in miner.page(page):
            connection.execute(
                "insert into locations values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    page.map_id,
                    page.event_id,
                    page.page,
                    call.block.command,
                    call.index,
                    page.map_name,
                    page.x,
                    page.y,
                    found.kind,
                    json.dumps(found.items),
                    found.quantity,
                    found.species,
                    found.level,
                    found.random,
                    call.source,
                ),
            )


def counts(connection: sqlite3.Connection) -> GameDbCounts:
    entries = dict(connection.execute("select kind, count(*) from entries group by kind"))
    allowed = dict(
        connection.execute("select kind, count(*) from entries where allowed group by kind")
    )
    return GameDbCounts(
        stamp=connection.execute("select value from meta where key = 'stamp'").fetchone()[0],
        entries={kind: entries.get(kind, 0) for kind in KINDS},
        allowed={kind: allowed.get(kind, 0) for kind in ALLOW_LISTED},
        retyped=connection.execute("select count(*) from retyped").fetchone()[0],
        locations=dict(
            connection.execute("select kind, count(*) from locations group by kind order by kind")
        ),
    )


@dataclass(frozen=True)
class Entry:
    id: str
    position: int
    name: str
    allowed: bool | None
    showdown: str | None
    raw: Raw


def entry(connection: sqlite3.Connection, kind: Kind, entry_id: str) -> Entry:
    row = connection.execute(
        "select id, position, name, allowed, showdown, raw from entries "
        "where kind = ? and upper(id) = upper(?) order by id = ? desc limit 1",
        (kind, entry_id, entry_id),
    ).fetchone()
    if row is None:
        raise GameDbError(f"no {kind} entry {entry_id} in the game database")
    found_id, position, name, allowed, showdown, raw = row
    return Entry(
        found_id,
        position,
        name,
        None if allowed is None else bool(allowed),
        showdown,
        json.loads(raw),
    )


def entries(connection: sqlite3.Connection, kind: Kind) -> Iterator[Entry]:
    for entry_id, position, name, allowed, showdown, raw in connection.execute(
        "select id, position, name, allowed, showdown, raw from entries where kind = ? "
        "order by position",
        (kind,),
    ):
        yield Entry(
            entry_id,
            position,
            name,
            None if allowed is None else bool(allowed),
            showdown,
            json.loads(raw),
        )


@dataclass(frozen=True)
class LevelMove:
    level: int
    move: str


@dataclass(frozen=True)
class Evolution:
    species: str
    method: str
    parameter: Any


@dataclass(frozen=True)
class Species:
    id: str
    species: str
    form: int
    name: str
    form_name: str | None
    category: str
    allowed: bool
    showdown: str | None
    types: tuple[str, ...]
    file_types: tuple[str, ...]
    base_stats: dict[str, int]
    evs: dict[str, int]
    abilities: tuple[str, ...]
    hidden_abilities: tuple[str, ...]
    growth_rate: str
    gender_ratio: str
    base_exp: int
    catch_rate: int
    happiness: int
    level_moves: tuple[LevelMove, ...]
    tutor_moves: tuple[str, ...]
    egg_moves: tuple[str, ...]
    evolutions: tuple[Evolution, ...]
    prevolutions: tuple[Evolution, ...]
    egg_groups: tuple[str, ...]
    hatch_steps: int
    wild_items: dict[str, tuple[str, ...]]
    height: int
    weight: int
    generation: int
    flags: tuple[str, ...]
    tag: Tag = WORLD


@dataclass(frozen=True)
class Move:
    id: str
    name: str
    allowed: bool
    showdown: str | None
    type: str
    category: str
    power: int
    accuracy: int
    pp: int
    priority: int
    target: str
    effect_chance: int
    function_code: str
    flags: tuple[str, ...]
    description: str
    tag: Tag = WORLD


@dataclass(frozen=True)
class Ability:
    id: str
    name: str
    allowed: bool
    showdown: str | None
    description: str
    flags: tuple[str, ...]
    tag: Tag = WORLD


@dataclass(frozen=True)
class Item:
    id: str
    name: str
    name_plural: str
    showdown: str | None
    pocket: int
    price: int
    sell_price: int
    bp_price: int
    field_use: int
    battle_use: int
    consumable: bool
    move: str | None
    flags: tuple[str, ...]
    description: str
    tag: Tag = WORLD


@dataclass(frozen=True)
class Type:
    id: str
    name: str
    special: bool
    pseudo: bool
    weaknesses: tuple[str, ...]
    resistances: tuple[str, ...]
    immunities: tuple[str, ...]
    flags: tuple[str, ...]
    tag: Tag = WORLD


@dataclass(frozen=True)
class Status:
    id: str
    name: str
    animation: str | None
    icon_position: int
    tag: Tag = WORLD


@dataclass(frozen=True)
class TrainerType:
    id: str
    name: str
    gender: int
    base_money: int
    skill_level: int
    flags: tuple[str, ...]
    intro_bgm: str | None
    battle_bgm: str | None
    victory_bgm: str | None
    tag: Tag = WORLD


@dataclass(frozen=True)
class TrainerPokemon:
    species: str
    form: int
    level: int
    item: str | None
    moves: tuple[str, ...]
    ability_index: int | None
    nature: str | None
    ivs: dict[str, int]
    happiness: int | None
    tag: Tag = OPPONENT_HIDDEN


@dataclass(frozen=True)
class Trainer:
    id: str
    trainer_type: TrainerType
    name: str
    version: int
    lose_text: str
    lose_text_female: str
    items: tuple[str, ...]
    pokemon: tuple[TrainerPokemon, ...]
    items_tag: Tag = OPPONENT_HIDDEN
    tag: Tag = WORLD


@dataclass(frozen=True)
class Matchup:
    attack: str
    defend: tuple[str, ...]
    multiplier: float
    tag: Tag = WORLD


def evolution(raw: list[Any]) -> Evolution:
    species, method, parameter = raw[:3]
    return Evolution(species, method, parameter)


def prevolution(raw: list[Any]) -> bool:
    return len(raw) > PREVOLUTION_FLAG and bool(raw[PREVOLUTION_FLAG])


def species(connection: sqlite3.Connection, species_id: str) -> Species:
    found = entry(connection, "species", species_id)
    raw = found.raw
    row = connection.execute("select file_types from retyped where id = ?", (species_id,))
    retyped = row.fetchone()
    return Species(
        id=found.id,
        species=raw["@species"],
        form=raw["@form"],
        name=found.name,
        form_name=raw["@real_form_name"] or None,
        category=raw["@real_category"],
        allowed=bool(found.allowed),
        showdown=found.showdown,
        types=tuple(raw["@types"]),
        file_types=tuple(json.loads(retyped[0]) if retyped else raw["@types"]),
        base_stats={stat: raw["@base_stats"][stat] for stat in STATS},
        evs={stat: raw["@evs"][stat] for stat in STATS},
        abilities=tuple(raw["@abilities"]),
        hidden_abilities=tuple(raw["@hidden_abilities"]),
        growth_rate=raw["@growth_rate"],
        gender_ratio=raw["@gender_ratio"],
        base_exp=raw["@base_exp"],
        catch_rate=raw["@catch_rate"],
        happiness=raw["@happiness"],
        level_moves=tuple(LevelMove(level, move) for level, move in raw["@moves"]),
        tutor_moves=tuple(raw["@tutor_moves"]),
        egg_moves=tuple(raw["@egg_moves"]),
        evolutions=tuple(evolution(each) for each in raw["@evolutions"] if not prevolution(each)),
        prevolutions=tuple(evolution(each) for each in raw["@evolutions"] if prevolution(each)),
        egg_groups=tuple(raw["@egg_groups"]),
        hatch_steps=raw["@hatch_steps"],
        wild_items={
            rarity: tuple(raw[f"@wild_item_{rarity}"]) for rarity in ("common", "uncommon", "rare")
        },
        height=raw["@height"],
        weight=raw["@weight"],
        generation=raw["@generation"],
        flags=tuple(raw["@flags"]),
    )


def family(connection: sqlite3.Connection, species_id: str) -> frozenset[str]:
    root = species(connection, species(connection, species_id).species)
    walked = {root.id}
    while root.prevolutions and root.prevolutions[0].species not in walked:
        root = species(connection, root.prevolutions[0].species)
        walked.add(root.id)
    found = {root.id}
    pending = [root.id]
    while pending:
        for each in species(connection, pending.pop()).evolutions:
            if each.species not in found:
                found.add(each.species)
                pending.append(each.species)
    return frozenset(found)


def move(connection: sqlite3.Connection, move_id: str) -> Move:
    found = entry(connection, "moves", move_id)
    raw = found.raw
    return Move(
        id=found.id,
        name=found.name,
        allowed=bool(found.allowed),
        showdown=found.showdown,
        type=raw["@type"],
        category=MOVE_CATEGORIES[raw["@category"]],
        power=raw["@power"],
        accuracy=raw["@accuracy"],
        pp=raw["@total_pp"],
        priority=raw["@priority"],
        target=raw["@target"],
        effect_chance=raw["@effect_chance"],
        function_code=raw["@function_code"],
        flags=tuple(raw["@flags"]),
        description=raw["@real_description"],
    )


def ability(connection: sqlite3.Connection, ability_id: str) -> Ability:
    found = entry(connection, "abilities", ability_id)
    raw = found.raw
    return Ability(
        id=found.id,
        name=found.name,
        allowed=bool(found.allowed),
        showdown=found.showdown,
        description=raw["@real_description"],
        flags=tuple(raw["@flags"]),
    )


def item(connection: sqlite3.Connection, item_id: str) -> Item:
    found = entry(connection, "items", item_id)
    raw = found.raw
    return Item(
        id=found.id,
        name=found.name,
        name_plural=raw["@real_name_plural"],
        showdown=found.showdown,
        pocket=raw["@pocket"],
        price=raw["@price"],
        sell_price=raw["@sell_price"],
        bp_price=raw["@bp_price"],
        field_use=raw["@field_use"],
        battle_use=raw["@battle_use"],
        consumable=raw["@consumable"],
        move=raw["@move"],
        flags=tuple(raw["@flags"]),
        description=raw["@real_description"],
    )


def game_type(connection: sqlite3.Connection, type_id: str) -> Type:
    found = entry(connection, "types", type_id)
    raw = found.raw
    return Type(
        id=found.id,
        name=found.name,
        special=raw["@special_type"],
        pseudo=raw["@pseudo_type"],
        weaknesses=tuple(raw["@weaknesses"]),
        resistances=tuple(raw["@resistances"]),
        immunities=tuple(raw["@immunities"]),
        flags=tuple(raw["@flags"]),
    )


def status(connection: sqlite3.Connection, status_id: str) -> Status:
    found = entry(connection, "statuses", status_id)
    raw = found.raw
    return Status(
        id=found.id,
        name=found.name,
        animation=raw["@animation"],
        icon_position=raw[STATUS_ICON],
    )


def trainer_type(connection: sqlite3.Connection, type_id: str) -> TrainerType:
    found = entry(connection, "trainer_types", type_id)
    raw = found.raw
    return TrainerType(
        id=found.id,
        name=found.name,
        gender=raw["@gender"],
        base_money=raw["@base_money"],
        skill_level=raw["@skill_level"],
        flags=tuple(raw["@flags"]),
        intro_bgm=raw["@intro_BGM"],
        battle_bgm=raw["@battle_BGM"],
        victory_bgm=raw["@victory_BGM"],
    )


def trainer_pokemon(raw: dict[str, Any]) -> TrainerPokemon:
    return TrainerPokemon(
        species=raw["species"],
        form=raw.get("form", 0),
        level=raw["level"],
        item=raw.get("item"),
        moves=tuple(raw.get("moves", ())),
        ability_index=raw.get("ability_index"),
        nature=raw.get("nature"),
        ivs=raw.get("iv", {}),
        happiness=raw.get("happiness"),
    )


def trainer(connection: sqlite3.Connection, trainer_id: str) -> Trainer:
    found = entry(connection, "trainers", trainer_id)
    raw = found.raw
    return Trainer(
        id=found.id,
        trainer_type=trainer_type(connection, raw["@trainer_type"]),
        name=found.name,
        version=raw["@version"],
        lose_text=raw["@real_lose_text"],
        lose_text_female=raw["@real_lose_text_f"],
        items=tuple(raw["@items"]),
        pokemon=tuple(trainer_pokemon(each) for each in raw["@pokemon"]),
    )


def trainer_ids(connection: sqlite3.Connection, type_id: str, name: str | None = None) -> list[str]:
    return [
        found.id
        for found in entries(connection, "trainers")
        if found.raw["@trainer_type"].upper() == type_id.upper()
        and (name is None or found.name.casefold() == name.casefold())
    ]


@dataclass(frozen=True)
class Location:
    map_id: int
    map_name: str
    event_id: int
    page: int
    command: int
    x: int
    y: int
    kind: LocationKind
    items: tuple[str, ...]
    quantity: int | None
    species: str | None
    level: int | None
    random: Randomness
    script: str
    tag: Tag = WORLD


def locations(connection: sqlite3.Connection, map_id: int | None = None) -> list[Location]:
    rows = connection.execute(
        "select map_id, map_name, event_id, page, command, x, y, kind, items, quantity, species, "
        "level, random, script from locations where ? is null or map_id = ? "
        "order by map_id, event_id, page, command, call",
        (map_id, map_id),
    )
    return [
        Location(
            map_id=found_map,
            map_name=map_name,
            event_id=event_id,
            page=page,
            command=command,
            x=x,
            y=y,
            kind=kind,
            items=tuple(json.loads(items)),
            quantity=quantity,
            species=species,
            level=level,
            random=random,
            script=script,
        )
        for (
            found_map,
            map_name,
            event_id,
            page,
            command,
            x,
            y,
            kind,
            items,
            quantity,
            species,
            level,
            random,
            script,
        ) in rows
    ]


def type_effectiveness(defend: Type, attack: str) -> int:
    if attack in defend.weaknesses:
        return SUPER_EFFECTIVE
    if attack in defend.resistances:
        return NOT_VERY_EFFECTIVE
    if attack in defend.immunities:
        return INEFFECTIVE
    return NORMAL_EFFECTIVE


def matchup(connection: sqlite3.Connection, attack: str, *defend: str) -> Matchup:
    game_type(connection, attack)
    multiplier = 1.0
    for defend_id in defend:
        multiplier *= (
            type_effectiveness(game_type(connection, defend_id), attack) / NORMAL_EFFECTIVE
        )
    return Matchup(attack, tuple(defend), multiplier)


def type_ids(connection: sqlite3.Connection) -> list[str]:
    return [found.id for found in entries(connection, "types")]


LOOKUPS = {
    "species": species,
    "move": move,
    "ability": ability,
    "item": item,
    "type": game_type,
    "status": status,
    "trainer-type": trainer_type,
}
