import json
import re
import sqlite3
import struct
from array import array
from collections.abc import Callable, Iterator
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from rubymarshal.classes import RubyObject, RubyString, Symbol, UserDef
from rubymarshal.reader import loads

from anil.install.builds import Build
from anil.install.game_files import GamePaths
from anil.settings import Settings

READER_VERSION = 12
MAP_REDIRECTS = {19: (216, 331)}
MAP_FILE = re.compile(r"Map(\d{3})\.rxdata")
TABLE_HEADER = struct.Struct("<5i")
TRANSFER_PLAYER = 201
DIALOG_CODES = frozenset({101, 102, 103})
SHOW_TEXT = 101
SHOW_TEXT_MORE = 401
SHOW_CHOICES = 102
WHEN_CHOICE = 402
WHEN_CANCEL = 403
CHOICES_END = 404
SET_MOVE_ROUTE = 209
MOVE_ROUTE_MORE = 509
END_OF_LIST = 0
SCRIPT = 355
SCRIPT_MORE = 655
CONDITIONAL_BRANCH = 111
BRANCH_ON_SCRIPT = 12
BRANCH_ON_FACING = 6
PLAYER_CHARACTER = -1
BRANCH_ELSE = 411
BRANCH_END = 412
COMMENT = 108
COMMENT_MORE = 408
CALL_COMMON_EVENT = 117
CANDY_CUP_EVENT = 6
ASSISTANT_EVENT = 4
TEMP_SWITCH_SET = re.compile(r'setTempSwitchOn\("(\w)"\)')
BAG_CHECK = re.compile(r"script \$bag\.quantity\(:(\w+)\)\s*>\s*0")
CHOICE_GUARD = re.compile(r"choice (\d+) (\d+)")
SCENE_BATTLE = re.compile(r"(TrainerBattle|WildBattle)\.start\(")

SCHEMA = """
create table meta (key text primary key, value text not null);
create table maps (
    id integer primary key, name text not null, parent_id integer not null,
    map_order integer not null, tileset_id integer not null,
    width integer not null, height integer not null, layers integer not null,
    encounter_step integer not null, tiles blob not null
);
create table tilesets (
    id integer primary key, name text not null, tileset_name text not null,
    autotile_names text not null, passages blob not null, priorities blob not null,
    terrain_tags blob not null
);
create table events (
    map_id integer not null, event_id integer not null, name text not null,
    x integer not null, y integer not null, primary key (map_id, event_id)
);
create table pages (
    map_id integer not null, event_id integer not null, page integer not null,
    trigger integer not null, through integer not null, always_on_top integer not null,
    direction_fix integer not null, walk_anime integer not null, step_anime integer not null,
    move_type integer not null, move_speed integer not null, move_frequency integer not null,
    character_name text not null, tile_id integer not null, direction integer not null,
    pattern integer not null, switch1 integer, switch2 integer,
    variable_id integer, variable_value integer, self_switch text,
    primary key (map_id, event_id, page)
);
create table transfers (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, designation integer not null, dest_map integer not null,
    dest_x integer not null, dest_y integer not null, direction integer not null,
    fade integer not null, facing integer, guards text not null,
    primary key (map_id, event_id, page, command)
);
create table routes (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, character integer not null, steps text not null,
    sole integer not null, primary key (map_id, event_id, page, command)
);
create table scripts (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, code integer not null, indent integer not null,
    text text not null, primary key (map_id, event_id, page, command)
);
create table comments (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, code integer not null, text text not null,
    primary key (map_id, event_id, page, command)
);
create table calls (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, common_event integer not null,
    primary key (map_id, event_id, page, command)
);
create table town_map (
    region integer not null, point integer not null, x integer not null, y integer not null,
    name text not null, poi text not null, heal_map integer, heal_x integer, heal_y integer,
    switch integer, primary key (region, point)
);
create table encounters (
    map_id integer not null, version integer not null, type text not null,
    step_chance integer not null, primary key (map_id, version, type)
);
create table switches (id integer primary key, name text not null);
create table map_metadata (
    id integer primary key, always_bicycle integer not null, outdoor integer not null,
    town_region integer, town_x integer, town_y integer
);
create table dialogs (
    map_id integer not null, event_id integer not null, page integer not null,
    command integer not null, code integer not null, text text not null,
    guards text not null, primary key (map_id, event_id, page, command)
);
create table encounter_slots (
    map_id integer not null, version integer not null, type text not null,
    slot integer not null, chance integer not null, species text not null,
    min_level integer not null, max_level integer not null,
    primary key (map_id, version, type, slot)
);
"""

Row = tuple[object, ...]


class WorldError(Exception):
    pass


@dataclass(frozen=True)
class Table:
    xsize: int
    ysize: int
    zsize: int
    values: array

    @classmethod
    def decode(cls, raw: bytes) -> "Table":
        _, xsize, ysize, zsize, size = TABLE_HEADER.unpack_from(raw)
        values = array("h")
        values.frombytes(raw[TABLE_HEADER.size : TABLE_HEADER.size + 2 * size])
        if len(values) != size or size != xsize * ysize * zsize:
            raise WorldError(f"table of {xsize}x{ysize}x{zsize} holds {len(values)} values")
        return cls(xsize, ysize, zsize, values)

    @classmethod
    def from_blob(cls, xsize: int, ysize: int, zsize: int, blob: bytes) -> "Table":
        values = array("h")
        values.frombytes(blob)
        return cls(xsize, ysize, zsize, values)

    def at(self, x: int, y: int = 0, z: int = 0) -> int:
        return self.values[x + self.xsize * (y + self.ysize * z)]

    def get(self, index: int) -> int | None:
        return self.values[index] if 0 <= index < len(self.values) else None


@dataclass(frozen=True)
class WorldCounts:
    maps: int
    tilesets: int
    events: int
    pages: int
    transfers: int
    transfer_maps: int
    scripts: int
    town_points: int
    encounter_maps: int


def stamp(build: Build) -> str:
    return f"{READER_VERSION}:{build.name}:{build.scripts_sha256}"


def world_path(build: Build, settings: Settings) -> Path:
    return settings.world / f"{build.name}.sqlite"


def open_world(build: Build, settings: Settings, *, rebuild: bool = False) -> sqlite3.Connection:
    path = world_path(build, settings)
    if not rebuild and stamp_of(path) == stamp(build):
        return sqlite3.connect(path)
    build_world(build, GamePaths.for_build(build).base / "Data", path)
    return sqlite3.connect(path)


def stamp_of(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        with closing(sqlite3.connect(path)) as connection:
            row = connection.execute("select value from meta where key = 'stamp'").fetchone()
    except sqlite3.DatabaseError:
        return None
    return row[0] if row else None


def build_world(build: Build, data: Path, path: Path) -> None:
    if not data.is_dir():
        raise WorldError(f"no game data at {data}; run `anil install`")
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.with_name(f".{path.name}.building")
    staging.unlink(missing_ok=True)
    connection = sqlite3.connect(staging)
    try:
        connection.executescript(SCHEMA)
        write_maps(connection, data)
        write_tilesets(connection, data)
        write_town_map(connection, data)
        write_encounters(connection, data)
        write_switches(connection, data)
        write_map_metadata(connection, data)
        connection.execute("insert into meta values ('stamp', ?)", (stamp(build),))
        connection.commit()
    finally:
        connection.close()
    staging.replace(path)


def load(path: Path) -> object:
    try:
        return loads(path.read_bytes())
    except FileNotFoundError as error:
        raise WorldError(f"missing game data file {path}") from error


def text(value: object) -> str:
    if isinstance(value, RubyString):
        return value.text
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    if value is None:
        return ""
    raise WorldError(f"expected a string, got {type(value).__name__}")


def symbol(value: object) -> str:
    if isinstance(value, Symbol):
        return value.name
    raise WorldError(f"expected a symbol, got {type(value).__name__}")


def mapping(value: object) -> dict[object, object]:
    if isinstance(value, dict):
        return value
    raise WorldError(f"expected a hash, got {type(value).__name__}")


def attrs(value: object) -> dict[str, object]:
    if isinstance(value, RubyObject):
        return value.attributes
    raise WorldError(f"expected a Ruby object, got {type(value).__name__}")


def table(value: object) -> Table:
    if isinstance(value, UserDef) and value.ruby_class_name == "Table" and value._private_data:
        return Table.decode(value._private_data)
    raise WorldError(f"expected an RGSS Table, got {type(value).__name__}")


def integer(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise WorldError(f"expected an integer, got {value!r}")
    return value


def optional_integer(value: object) -> int | None:
    return None if value is None else integer(value)


def items(value: object) -> list[object]:
    if isinstance(value, list):
        return value
    raise WorldError(f"expected an array, got {type(value).__name__}")


def write_maps(connection: sqlite3.Connection, data: Path) -> None:
    infos = load(data / "MapInfos.rxdata")
    if not isinstance(infos, dict):
        raise WorldError("MapInfos.rxdata is not a hash")
    for file in sorted(data.iterdir()):
        match = MAP_FILE.fullmatch(file.name)
        if match is None:
            continue
        map_id = int(match.group(1))
        info = attrs(infos.get(map_id))
        game_map = attrs(load(file))
        tiles = table(game_map["@data"])
        connection.execute(
            "insert into maps values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                map_id,
                text(info["@name"]),
                integer(info["@parent_id"]),
                integer(info["@order"]),
                integer(game_map["@tileset_id"]),
                tiles.xsize,
                tiles.ysize,
                tiles.zsize,
                integer(game_map["@encounter_step"]),
                tiles.values.tobytes(),
            ),
        )
        events = game_map["@events"]
        if not isinstance(events, dict):
            raise WorldError(f"map {map_id} events are not a hash")
        for event_id, event in sorted(events.items()):
            write_event(connection, map_id, integer(event_id), attrs(event))


def write_event(
    connection: sqlite3.Connection, map_id: int, event_id: int, event: dict[str, object]
) -> None:
    connection.execute(
        "insert into events values (?, ?, ?, ?, ?)",
        (map_id, event_id, text(event["@name"]), integer(event["@x"]), integer(event["@y"])),
    )
    for page_index, page in enumerate(items(event["@pages"]), start=1):
        fields = attrs(page)
        key = (map_id, event_id, page_index)
        connection.execute(
            "insert into pages values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (*key, *page_row(fields)),
        )
        listed = list(commands(fields["@list"]))
        facings = required_facings(listed)
        guards = command_guards(listed)
        codes = [code for _, code, _, _ in listed]
        sole = codes.count(SET_MOVE_ROUTE) == 1 and set(codes) <= {
            SET_MOVE_ROUTE,
            MOVE_ROUTE_MORE,
            END_OF_LIST,
        }
        for command_index, code, indent, parameters in listed:
            guarded = json.dumps(guards[command_index], ensure_ascii=False)
            if code == TRANSFER_PLAYER:
                connection.execute(
                    "insert into transfers values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        *key,
                        command_index,
                        *(integer(value) for value in parameters[:6]),
                        facings.get(command_index),
                        guarded,
                    ),
                )
            if code in DIALOG_CODES:
                connection.execute(
                    "insert into dialogs values (?, ?, ?, ?, ?, ?, ?)",
                    (*key, command_index, code, dialog_text(listed, command_index), guarded),
                )
            if code == SET_MOVE_ROUTE:
                connection.execute(
                    "insert into routes values (?, ?, ?, ?, ?, ?, ?)",
                    (
                        *key,
                        command_index,
                        integer(parameters[0]),
                        json.dumps(route_steps(parameters[1])),
                        sole,
                    ),
                )
            if code in (COMMENT, COMMENT_MORE):
                connection.execute(
                    "insert into comments values (?, ?, ?, ?, ?, ?)",
                    (*key, command_index, code, text(parameters[0])),
                )
            if code == CALL_COMMON_EVENT:
                connection.execute(
                    "insert into calls values (?, ?, ?, ?, ?)",
                    (*key, command_index, integer(parameters[0])),
                )
            script = script_text(code, parameters)
            if script is not None:
                connection.execute(
                    "insert into scripts values (?, ?, ?, ?, ?, ?, ?)",
                    (*key, command_index, code, indent, script),
                )


def page_row(page: dict[str, object]) -> Row:
    condition = attrs(page["@condition"])
    graphic = attrs(page["@graphic"])
    return (
        integer(page["@trigger"]),
        bool(page["@through"]),
        bool(page["@always_on_top"]),
        bool(page["@direction_fix"]),
        bool(page["@walk_anime"]),
        bool(page["@step_anime"]),
        integer(page["@move_type"]),
        integer(page["@move_speed"]),
        integer(page["@move_frequency"]),
        text(graphic["@character_name"]),
        integer(graphic["@tile_id"]),
        integer(graphic["@direction"]),
        integer(graphic["@pattern"]),
        integer(condition["@switch1_id"]) if condition["@switch1_valid"] else None,
        integer(condition["@switch2_id"]) if condition["@switch2_valid"] else None,
        integer(condition["@variable_id"]) if condition["@variable_valid"] else None,
        integer(condition["@variable_value"]) if condition["@variable_valid"] else None,
        text(condition["@self_switch_ch"]) if condition["@self_switch_valid"] else None,
    )


def commands(value: object) -> Iterator[tuple[int, int, int, list[object]]]:
    for index, command in enumerate(items(value)):
        fields = attrs(command)
        yield (
            index,
            integer(fields["@code"]),
            integer(fields["@indent"]),
            items(fields["@parameters"]),
        )


def required_facings(listed: list[tuple[int, int, int, list[object]]]) -> dict[int, int]:
    branches: list[int | None] = []
    found: dict[int, int] = {}
    for index, code, _, parameters in listed:
        if code == CONDITIONAL_BRANCH:
            on_player = (
                parameters[0] == BRANCH_ON_FACING and integer(parameters[1]) == PLAYER_CHARACTER
            )
            branches.append(integer(parameters[2]) if on_player else None)
        elif code == BRANCH_ELSE and branches:
            branches[-1] = None
        elif code == BRANCH_END and branches:
            branches.pop()
        else:
            facing = next((branch for branch in reversed(branches) if branch is not None), None)
            if facing is not None:
                found[index] = facing
    return found


def command_guards(listed: list[tuple[int, int, int, list[object]]]) -> list[list[str]]:
    open_guards: dict[int, str] = {}
    choices: dict[int, int] = {}
    found: list[list[str]] = []
    for index, code, indent, parameters in listed:
        open_guards = {level: guard for level, guard in open_guards.items() if level <= indent}
        found.append([guard for level, guard in sorted(open_guards.items()) if level < indent])
        if code == SHOW_CHOICES:
            choices[indent] = index
        guard = structure_guard(code, parameters, open_guards.get(indent), choices.get(indent))
        if guard is not None:
            open_guards[indent] = guard
        elif code in (BRANCH_END, CHOICES_END):
            open_guards.pop(indent, None)
    return found


def structure_guard(
    code: int, parameters: list[object], current: str | None, choice: int | None
) -> str | None:
    if code == CONDITIONAL_BRANCH:
        if parameters[0] == BRANCH_ON_SCRIPT:
            return f"script {text(parameters[1])}"
        if parameters[0] == BRANCH_ON_FACING and parameters[1] == PLAYER_CHARACTER:
            return f"facing {integer(parameters[2])}"
        return f"branch {integer(parameters[0])}"
    if code == BRANCH_ELSE:
        return f"else {current}"
    if code == WHEN_CHOICE:
        return f"choice {choice} {integer(parameters[0])}"
    if code == WHEN_CANCEL:
        return f"cancel {choice}"
    return None


def route_steps(value: object) -> list[int]:
    return [integer(attrs(command)["@code"]) for command in items(attrs(value)["@list"])]


def dialog_text(listed: list[tuple[int, int, int, list[object]]], index: int) -> str:
    _, code, _, parameters = listed[index]
    if code == SHOW_CHOICES:
        return json.dumps([text(option) for option in items(parameters[0])], ensure_ascii=False)
    if code != SHOW_TEXT:
        return json.dumps([])
    lines = [text(parameters[0])]
    for _, more, _, following in listed[index + 1 :]:
        if more != SHOW_TEXT_MORE:
            break
        lines.append(text(following[0]))
    return json.dumps(lines, ensure_ascii=False)


def script_text(code: int, parameters: list[object]) -> str | None:
    if code in (SCRIPT, SCRIPT_MORE):
        return text(parameters[0])
    if code == CONDITIONAL_BRANCH and parameters[0] == BRANCH_ON_SCRIPT:
        return text(parameters[1])
    return None


def write_tilesets(connection: sqlite3.Connection, data: Path) -> None:
    for tileset in items(load(data / "Tilesets.rxdata")):
        if tileset is None:
            continue
        fields = attrs(tileset)
        connection.execute(
            "insert into tilesets values (?, ?, ?, ?, ?, ?, ?)",
            (
                integer(fields["@id"]),
                text(fields["@name"]),
                text(fields["@tileset_name"]),
                json.dumps([text(name) for name in items(fields["@autotile_names"])]),
                table(fields["@passages"]).values.tobytes(),
                table(fields["@priorities"]).values.tobytes(),
                table(fields["@terrain_tags"]).values.tobytes(),
            ),
        )


def write_town_map(connection: sqlite3.Connection, data: Path) -> None:
    for region, town_map in sorted(mapping(load(data / "town_map.dat")).items()):
        for index, point in enumerate(items(attrs(town_map)["@point"])):
            x, y, name, poi, heal_map, heal_x, heal_y, switch = items(point)
            connection.execute(
                "insert into town_map values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    integer(region),
                    index,
                    integer(x),
                    integer(y),
                    text(name),
                    text(poi),
                    optional_integer(heal_map),
                    optional_integer(heal_x),
                    optional_integer(heal_y),
                    optional_integer(switch),
                ),
            )


def write_encounters(connection: sqlite3.Connection, data: Path) -> None:
    for encounter in mapping(load(data / "encounters.dat")).values():
        fields = attrs(encounter)
        key = (integer(fields["@map"]), integer(fields["@version"]))
        chances = mapping(fields["@step_chances"])
        for kind, slots in mapping(fields["@types"]).items():
            connection.execute(
                "insert into encounters values (?, ?, ?, ?)",
                (*key, symbol(kind), integer(chances.get(kind, 0))),
            )
            for slot, entry in enumerate(items(slots)):
                chance, species, low, high = items(entry)
                connection.execute(
                    "insert into encounter_slots values (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        *key,
                        symbol(kind),
                        slot,
                        integer(chance),
                        symbol(species),
                        integer(low),
                        integer(high),
                    ),
                )


def write_switches(connection: sqlite3.Connection, data: Path) -> None:
    system = attrs(load(data / "System.rxdata"))
    for switch_id, name in enumerate(items(system["@switches"])):
        if name is not None:
            connection.execute("insert into switches values (?, ?)", (switch_id, text(name)))


def write_map_metadata(connection: sqlite3.Connection, data: Path) -> None:
    for map_id, metadata in mapping(load(data / "map_metadata.dat")).items():
        fields = attrs(metadata)
        position = fields.get("@town_map_position")
        region, x, y = items(position) if position is not None else (None, None, None)
        connection.execute(
            "insert into map_metadata values (?, ?, ?, ?, ?, ?)",
            (
                integer(map_id),
                bool(fields["@always_bicycle"]),
                bool(fields["@outdoor_map"]),
                optional_integer(region),
                optional_integer(x),
                optional_integer(y),
            ),
        )


def counts(connection: sqlite3.Connection) -> WorldCounts:
    def one(query: str) -> int:
        return connection.execute(query).fetchone()[0]

    return WorldCounts(
        maps=one("select count(*) from maps"),
        tilesets=one("select count(*) from tilesets"),
        events=one("select count(*) from events"),
        pages=one("select count(*) from pages"),
        transfers=one("select count(*) from transfers"),
        transfer_maps=one("select count(distinct map_id) from transfers"),
        scripts=one("select count(*) from scripts"),
        town_points=one("select count(*) from town_map"),
        encounter_maps=one("select count(distinct map_id) from encounters"),
    )


def map_tiles(connection: sqlite3.Connection, map_id: int) -> Table:
    row = connection.execute(
        "select width, height, layers, tiles from maps where id = ?", (map_id,)
    ).fetchone()
    if row is None:
        raise WorldError(f"no map {map_id} in the world cache")
    return Table.from_blob(*row)


@dataclass(frozen=True)
class Tileset:
    passages: Table
    priorities: Table
    terrain_tags: Table

    def passage(self, tile_id: int) -> int | None:
        return self.passages.get(tile_id)

    def priority(self, tile_id: int) -> int | None:
        return self.priorities.get(tile_id)

    def terrain_tag(self, tile_id: int) -> int:
        return self.terrain_tags.get(tile_id) or 0


@dataclass(frozen=True)
class MapData:
    id: int
    name: str
    width: int
    height: int
    tiles: Table
    tileset: Tileset


@dataclass(frozen=True)
class Page:
    number: int
    trigger: int
    through: bool
    character_name: str
    tile_id: int
    switch1: int | None
    switch2: int | None
    variable_id: int | None
    variable_value: int | None
    self_switch: str | None
    direction: int
    move_type: int


@dataclass(frozen=True)
class MapEvent:
    id: int
    name: str
    x: int
    y: int
    pages: tuple[Page, ...]


def tileset_table(blob: bytes) -> Table:
    return Table.from_blob(len(blob) // 2, 1, 1, blob)


def map_data(connection: sqlite3.Connection, map_id: int) -> MapData:
    row = connection.execute(
        "select maps.name, maps.width, maps.height, maps.layers, maps.tiles, "
        "tilesets.passages, tilesets.priorities, tilesets.terrain_tags "
        "from maps join tilesets on tilesets.id = maps.tileset_id where maps.id = ?",
        (map_id,),
    ).fetchone()
    if row is None:
        raise WorldError(f"no map {map_id} in the world cache")
    name, width, height, layers, tiles, passages, priorities, terrain_tags = row
    return MapData(
        id=map_id,
        name=name,
        width=width,
        height=height,
        tiles=Table.from_blob(width, height, layers, tiles),
        tileset=Tileset(
            passages=tileset_table(passages),
            priorities=tileset_table(priorities),
            terrain_tags=tileset_table(terrain_tags),
        ),
    )


def map_events(connection: sqlite3.Connection, map_id: int) -> dict[int, MapEvent]:
    pages: dict[int, list[Page]] = {}
    for row in connection.execute(
        "select event_id, page, trigger, through, character_name, tile_id, switch1, switch2, "
        "variable_id, variable_value, self_switch, direction, move_type from pages "
        "where map_id = ? "
        "order by event_id, page",
        (map_id,),
    ):
        event_id, number, trigger, through, *rest = row
        pages.setdefault(event_id, []).append(Page(number, trigger, bool(through), *rest))
    return {
        event_id: MapEvent(event_id, name, x, y, tuple(pages.get(event_id, [])))
        for event_id, name, x, y in connection.execute(
            "select event_id, name, x, y from events where map_id = ? order by event_id",
            (map_id,),
        )
    }


def switch_names(connection: sqlite3.Connection) -> dict[int, str]:
    return dict(connection.execute("select id, name from switches"))


@dataclass(frozen=True)
class Place:
    map_id: int
    x: int
    y: int


def quiet_transfers(
    connection: sqlite3.Connection, map_id: int
) -> dict[tuple[int, int], tuple[Place, ...]]:
    transfers: dict[tuple[int, int], list[Place]] = {}
    for event_id, page, dest_map, dest_x, dest_y in connection.execute(
        "select event_id, page, dest_map, dest_x, dest_y from transfers where map_id = ? "
        "and not exists (select 1 from dialogs where dialogs.map_id = transfers.map_id "
        "and dialogs.event_id = transfers.event_id and dialogs.page = transfers.page) "
        "order by event_id, page, command",
        (map_id,),
    ):
        transfers.setdefault((event_id, page), []).append(Place(dest_map, dest_x, dest_y))
    return {key: tuple(places) for key, places in transfers.items()}


def transfer_facings(connection: sqlite3.Connection, map_id: int) -> dict[tuple[int, int], int]:
    rows = connection.execute(
        "select event_id, page, min(facing) from transfers where map_id = ? group by event_id, "
        "page having count(facing) = count(*) and min(facing) = max(facing)",
        (map_id,),
    )
    return {(event_id, page): facing for event_id, page, facing in rows}


def temp_switches_set(
    connection: sqlite3.Connection, map_id: int
) -> dict[tuple[int, int], frozenset[str]]:
    found: dict[tuple[int, int], set[str]] = {}
    for event_id, page, text in connection.execute(
        "select event_id, page, text from scripts where map_id = ? and code = ? and indent = 0 "
        "order by event_id, page, command",
        (map_id, SCRIPT),
    ):
        if match := TEMP_SWITCH_SET.fullmatch(text):
            found.setdefault((event_id, page), set()).add(match.group(1))
    return {key: frozenset(letters) for key, letters in found.items()}


def scene_pages(connection: sqlite3.Connection, map_id: int) -> frozenset[tuple[int, int]]:
    talking = connection.execute(
        "select distinct event_id, page from dialogs where map_id = ?", (map_id,)
    )
    found = {(event_id, page) for event_id, page in talking}
    for event_id, page, text in connection.execute(
        "select event_id, page, text from scripts where map_id = ?", (map_id,)
    ):
        if SCENE_BATTLE.search(text):
            found.add((event_id, page))
    return frozenset(found)


def map_ids(connection: sqlite3.Connection) -> list[int]:
    return [row[0] for row in connection.execute("select id from maps order by id")]


def always_bicycle_maps(connection: sqlite3.Connection) -> frozenset[int]:
    rows = connection.execute("select id from map_metadata where always_bicycle")
    return frozenset(row[0] for row in rows)


def outdoor_maps(connection: sqlite3.Connection) -> frozenset[int]:
    rows = connection.execute("select id from map_metadata where outdoor")
    return frozenset(row[0] for row in rows)


def town_map_positions(connection: sqlite3.Connection) -> dict[int, tuple[int, int, int]]:
    rows = connection.execute(
        "select id, town_region, town_x, town_y from map_metadata where town_region is not null"
    )
    return {map_id: (region, x, y) for map_id, region, x, y in rows}


@dataclass(frozen=True)
class Landing:
    region: int
    point: int
    name: str
    x: int
    y: int
    place: Place
    switch: int | None


def landing_target(landing: Landing, switch: Callable[[int], bool]) -> Place:
    redirect = MAP_REDIRECTS.get(landing.place.map_id)
    if redirect is None or not switch(redirect[1]):
        return landing.place
    return Place(redirect[0], landing.place.x, landing.place.y)


def redirected_transfer(places: set[Place], switch: Callable[[int], bool]) -> Place | None:
    by_map = {place.map_id: place for place in places}
    if len(by_map) != len(places) or len(places) != 2:
        return None
    for map_id, (target, switch_id) in MAP_REDIRECTS.items():
        if by_map.keys() == {map_id, target}:
            return by_map[target] if switch(switch_id) else by_map[map_id]
    return None


def landings(connection: sqlite3.Connection) -> list[Landing]:
    rows = connection.execute(
        "select region, point, name, x, y, heal_map, heal_x, heal_y, switch from town_map "
        "where heal_map is not null and heal_x is not null and heal_y is not null "
        "order by region, point"
    )
    return [
        Landing(region, point, name, x, y, Place(heal_map, heal_x, heal_y), switch)
        for region, point, name, x, y, heal_map, heal_x, heal_y, switch in rows
    ]


NURSE_NAME = "Joy"
NURSE_CHARACTER = "enfermera"


def nurses(connection: sqlite3.Connection) -> list[tuple[int, int]]:
    rows = connection.execute(
        "select distinct events.map_id, events.event_id from events join pages "
        "using (map_id, event_id) where events.name = ? and lower(pages.character_name) = ? "
        "order by events.map_id, events.event_id",
        (NURSE_NAME, NURSE_CHARACTER),
    )
    return [(map_id, event_id) for map_id, event_id in rows]


PC_COMMON_EVENT = 14
PC_SCRIPT = "pbPokeCenterPC"


def pcs(connection: sqlite3.Connection) -> list[tuple[int, int, int]]:
    rows = connection.execute(
        "select map_id, event_id, page from calls where common_event = ? "
        "union select map_id, event_id, page from scripts where text = ? "
        "order by map_id, event_id, page",
        (PC_COMMON_EVENT, PC_SCRIPT),
    )
    return [(map_id, event_id, page) for map_id, event_id, page in rows]


def common_event_callers(
    connection: sqlite3.Connection, common_event: int
) -> list[tuple[int, int, int]]:
    rows = connection.execute(
        "select distinct map_id, event_id, page from calls where common_event = ? "
        "order by map_id, event_id, page",
        (common_event,),
    )
    return [(map_id, event_id, page) for map_id, event_id, page in rows]


def candy_cups(connection: sqlite3.Connection) -> list[tuple[int, int, int]]:
    return common_event_callers(connection, CANDY_CUP_EVENT)


def assistants(connection: sqlite3.Connection) -> list[tuple[int, int, int]]:
    return common_event_callers(connection, ASSISTANT_EVENT)


LAND_ENCOUNTERS = frozenset({"Land", "LandClassic"})
EVENT_ENCOUNTERS = {"Water": "water", "Cave": "cave"}
ENCOUNTER_SCRIPT = re.compile(r"pbEncounter\(:(\w+)\)")


@dataclass(frozen=True)
class EncounterEvent:
    map_id: int
    event_id: int
    page: int
    kind: str


def encounter_events(connection: sqlite3.Connection) -> dict[int, dict[int, EncounterEvent]]:
    tables = set(connection.execute("select distinct map_id, type from encounters"))
    found: dict[int, dict[int, EncounterEvent]] = {}
    for map_id, event_id, page, script in connection.execute(
        "select map_id, event_id, page, text from scripts where text like 'pbEncounter(:%' "
        "order by map_id, event_id, page"
    ):
        match = ENCOUNTER_SCRIPT.fullmatch(script)
        if match is None:
            continue
        kind = EVENT_ENCOUNTERS.get(match.group(1))
        if kind is None or (map_id, match.group(1)) not in tables:
            continue
        found.setdefault(map_id, {})[event_id] = EncounterEvent(map_id, event_id, page, kind)
    return found


def wild_maps(connection: sqlite3.Connection) -> dict[int, frozenset[str]]:
    found: dict[int, set[str]] = {}
    for map_id, kind in connection.execute("select distinct map_id, type from encounters"):
        if kind in LAND_ENCOUNTERS:
            found.setdefault(map_id, set()).add("land")
    for map_id, events in encounter_events(connection).items():
        found.setdefault(map_id, set()).update(event.kind for event in events.values())
    return {map_id: frozenset(kinds) for map_id, kinds in found.items()}


@dataclass(frozen=True)
class PageCommands:
    comments: tuple[str, ...] = ()
    route: tuple[int, ...] | None = None


def page_commands(
    connection: sqlite3.Connection, map_id: int
) -> dict[tuple[int, int], PageCommands]:
    comments: dict[tuple[int, int], list[str]] = {}
    for event_id, page, comment in connection.execute(
        "select event_id, page, text from comments where map_id = ? and code = ? "
        "order by event_id, page, command",
        (map_id, COMMENT),
    ):
        comments.setdefault((event_id, page), []).append(comment)
    routes = {
        (event_id, page): tuple(json.loads(steps))
        for event_id, page, steps in connection.execute(
            "select event_id, page, steps from routes where map_id = ? and sole and character = ?",
            (map_id, PLAYER_CHARACTER),
        )
    }
    return {
        key: PageCommands(tuple(comments.get(key, ())), routes.get(key))
        for key in comments.keys() | routes.keys()
    }


@dataclass(frozen=True)
class ChoiceTransfer:
    place: Place
    before: tuple[str, ...]
    question: str
    options: tuple[str, ...]
    answer: int
    after: tuple[str, ...]
    items: tuple[str, ...]


def choice_transfers(
    connection: sqlite3.Connection, map_id: int
) -> dict[tuple[int, int], tuple[ChoiceTransfer, ...]]:
    dialogs: dict[tuple[int, int], list[tuple[int, int, list[str], list[str]]]] = {}
    for event_id, page, command, code, shown, guards in connection.execute(
        "select event_id, page, command, code, text, guards from dialogs where map_id = ? "
        "order by event_id, page, command",
        (map_id,),
    ):
        dialogs.setdefault((event_id, page), []).append(
            (command, code, json.loads(shown), json.loads(guards))
        )
    found: dict[tuple[int, int], list[ChoiceTransfer]] = {}
    for event_id, page, command, dest_map, dest_x, dest_y, guards in connection.execute(
        "select event_id, page, command, dest_map, dest_x, dest_y, guards from transfers "
        "where map_id = ? order by event_id, page, command",
        (map_id,),
    ):
        listed = dialogs.get((event_id, page), [])
        place = Place(dest_map, dest_x, dest_y)
        transfer = choice_transfer(place, command, json.loads(guards), listed)
        if transfer is not None:
            found.setdefault((event_id, page), []).append(transfer)
    return {key: tuple(transfers) for key, transfers in found.items()}


def choice_transfer(
    place: Place,
    command: int,
    guards: list[str],
    dialogs: list[tuple[int, int, list[str], list[str]]],
) -> ChoiceTransfer | None:
    if not guards or (chosen := CHOICE_GUARD.fullmatch(guards[-1])) is None:
        return None
    needed = [BAG_CHECK.fullmatch(guard) for guard in guards[:-1]]
    if not all(needed):
        return None
    choice, answer = int(chosen.group(1)), int(chosen.group(2))
    earlier = [(at, code, lines, around) for at, code, lines, around in dialogs if at < command]
    on_path = [
        (at, code, lines) for at, code, lines, around in earlier if around == guards[: len(around)]
    ]
    if not all(
        skipped_branch(guards, around)
        for _, _, _, around in earlier
        if around != guards[: len(around)]
    ):
        return None
    shown = {at: (code, lines) for at, code, lines in on_path}
    if shown.get(choice, (None,))[0] != SHOW_CHOICES or shown.get(choice - 1, (None,))[0] != (
        SHOW_TEXT
    ):
        return None
    if any(code != SHOW_TEXT for at, code, _ in on_path if at != choice):
        return None
    return ChoiceTransfer(
        place,
        tuple(" ".join(lines) for at, _, lines in on_path if at < choice - 1),
        " ".join(shown[choice - 1][1]),
        tuple(shown[choice][1]),
        answer,
        tuple(" ".join(lines) for at, _, lines in on_path if at > choice),
        tuple(match.group(1) for match in needed if match is not None),
    )


def skipped_branch(guards: list[str], around: list[str]) -> bool:
    for taken, other in zip(guards, around, strict=False):
        if taken == other:
            continue
        if other == f"else {taken}":
            return True
        taken_choice = CHOICE_GUARD.fullmatch(taken)
        if taken_choice is None:
            return False
        return other.startswith(f"choice {taken_choice.group(1)} ") or other == (
            f"cancel {taken_choice.group(1)}"
        )
    return False


def quiet_touch_pages(connection: sqlite3.Connection, map_id: int) -> frozenset[tuple[int, int]]:
    rows = connection.execute(
        "select event_id, page from pages where map_id = ? and trigger in (1, 2) "
        "and not exists (select 1 from dialogs d where d.map_id = pages.map_id "
        "and d.event_id = pages.event_id and d.page = pages.page) "
        "and not exists (select 1 from transfers t where t.map_id = pages.map_id "
        "and t.event_id = pages.event_id and t.page = pages.page) "
        "and not exists (select 1 from routes r where r.map_id = pages.map_id "
        "and r.event_id = pages.event_id and r.page = pages.page) "
        "and not exists (select 1 from scripts s where s.map_id = pages.map_id "
        "and s.event_id = pages.event_id and s.page = pages.page)",
        (map_id,),
    )
    return frozenset((event_id, page) for event_id, page in rows)


def guard_items(connection: sqlite3.Connection) -> list[str]:
    found = {
        match.group(1)
        for (guards,) in connection.execute(
            "select guards from transfers where guards like '%$bag.quantity%'"
        )
        for guard in json.loads(guards)
        if (match := BAG_CHECK.fullmatch(guard)) is not None
    }
    return sorted(found)
