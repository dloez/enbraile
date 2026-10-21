import heapq
import logging
import math
import re
import sqlite3
from collections import deque
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field, replace
from functools import cached_property
from itertools import count
from typing import Any, Literal

from anil.bridge.protocol import AdvanceResult, NoteResult, StopCondition
from anil.harness.context import EVENT, OVERWORLD, Context
from anil.harness.drive import Driver, buttons
from anil.harness.investigate import Session
from anil.harness.menu import fly, use_lens
from anil.harness.progression import GATES, Flag, Gate, Opener
from anil.harness.state import (
    SECONDS_PER_DAY,
    LiveWorld,
    read_context,
    read_live_world,
    read_rock_climbing,
)
from anil.harness.steps import Filler, same_text
from anil.harness.world import (
    ChoiceTransfer,
    Landing,
    MapData,
    MapEvent,
    Page,
    PageCommands,
    Place,
    always_bicycle_maps,
    choice_transfers,
    guard_items,
    landing_target,
    landings,
    map_data,
    map_events,
    map_ids,
    outdoor_maps,
    page_commands,
    quiet_touch_pages,
    quiet_transfers,
    redirected_transfer,
    scene_pages,
    switch_names,
    temp_switches_set,
    town_map_positions,
    transfer_facings,
)

log = logging.getLogger("harness.navigate")

DIRECTIONS = {2: "down", 4: "left", 6: "right", 8: "up"}
STEPS = {2: (0, 1), 4: (-1, 0), 6: (1, 0), 8: (0, -1)}
LAND = 0
OFFSETS = {LAND: (0, 0), **STEPS}
BLOCKED_EVERY_WAY = 0x0F
COUNTER = 0x80
LEDGE = 1
WATERFALL = 8
TALL_GRASS = 10
ICE = 12
NEUTRAL = 13
BRIDGE = 15
ROCK_CLIMB = 18
TERRAIN_TAGS = range(ROCK_CLIMB + 1)
PASSABLE_WATER = frozenset({5, 6, 7, 9})
SURF_START = frozenset({5, 6, 7})
SURFABLE = PASSABLE_WATER | {WATERFALL}
EVENT_SIZE = re.compile(r"size\((\d+),(\d+)\)", re.IGNORECASE)
SCRIPT_SWITCH = "s:"
HIDDEN_ITEM = re.compile(r"objetooculto", re.IGNORECASE)
STAIR_EVENT = "Slope"
COUNTER_EVENT = re.compile(r"counter\((\d+)\)", re.IGNORECASE)
STAIR_SLOPE = re.compile(r"Slope: (-?\d+)x(-?\d+)")
STAIR_WIDTH = re.compile(r"Width: (\d+)/(\d+)")
STAIR_OFFSET = re.compile(r"Offset: (\d+)px")
STAIR_DEFAULT_OFFSET = 16
TILE_PIXELS = 32
ROUTE_END = 0
ROUTE_DIRECTIONS = {1: 2, 2: 4, 3: 6, 4: 8}
ROUTE_COSMETIC = frozenset({31, 32, 33, 34, 42, 43, 44})
TEMP_SWITCH = re.compile(r'(tsOn|tsOff)\?\("(\w)"\)')
COOLED_DOWN = re.compile(r"(cooledDown|cooledDownDays)\?\((\d+)\)")
MAX_GAME_ID = 5000
TRUE_BIT = "1"
NAV_KIND = "nav"

type Tile = tuple[int, int]


class NavigateError(Exception):
    pass


@dataclass(frozen=True)
class Obstacle:
    id: int
    x: int
    y: int
    width: int
    height: int
    through: bool
    character_name: str
    tile_id: int

    def covers(self, x: int, y: int) -> bool:
        return self.x <= x < self.x + self.width and self.y - self.height < y <= self.y

    @property
    def footprint(self) -> frozenset[Tile]:
        return footprint(self.x, self.y, self.width, self.height)


@dataclass(frozen=True)
class Mover:
    x: int
    y: int
    through: bool
    character_name: str
    bridge: int
    surfing: bool
    bicycle: bool
    rock_climbing: bool


@dataclass(frozen=True)
class Grid:
    map: MapData
    obstacles: tuple[Obstacle, ...]
    player: Mover

    def valid(self, x: int, y: int) -> bool:
        return 0 <= x < self.map.width and 0 <= y < self.map.height

    @cached_property
    def tiled(self) -> dict[Tile, tuple[Obstacle, ...]]:
        found: dict[Tile, list[Obstacle]] = {}
        for event in self.obstacles:
            if event.tile_id > 0 and not event.through and self.terrain(event.tile_id) != NEUTRAL:
                for tile in event.footprint:
                    found.setdefault(tile, []).append(event)
        return {tile: tuple(events) for tile, events in found.items()}

    @cached_property
    def walls(self) -> frozenset[Tile]:
        return frozenset(
            tile
            for event in self.obstacles
            if not event.through and event.character_name
            for tile in event.footprint
        )

    def terrain_tag(self, x: int, y: int) -> int:
        for layer in (2, 1, 0):
            tile_id = self.map.tiles.at(x, y, layer)
            if tile_id == 0:
                continue
            tag = self.terrain(tile_id)
            if tag == BRIDGE and self.player.bridge == 0:
                continue
            if tag > 0 and tag != NEUTRAL:
                return tag
        return 0

    def blocks(self, tile_id: int, bit: int) -> bool:
        passage = self.map.tileset.passage(tile_id)
        return (
            passage is None
            or passage & bit != 0
            or passage & BLOCKED_EVERY_WAY == BLOCKED_EVERY_WAY
        )

    def terrain(self, tile_id: int) -> int:
        tag = self.map.tileset.terrain_tag(tile_id)
        return tag if tag in TERRAIN_TAGS else 0

    def tiles_passable(self, x: int, y: int, direction: int) -> bool:
        bit = direction_bit(direction)
        player = self.player
        for layer in (2, 1, 0):
            tile_id = self.map.tiles.at(x, y, layer)
            if tile_id == 0:
                continue
            tag = self.terrain(tile_id)
            if tag == BRIDGE and player.bridge == 0:
                continue
            if player.surfing and tag in PASSABLE_WATER:
                return True
            if player.rock_climbing and tag == ROCK_CLIMB:
                return True
            if player.bicycle and tag == TALL_GRASS:
                return False
            if tag == BRIDGE:
                return not self.blocks(tile_id, bit)
            if tag == NEUTRAL:
                continue
            if self.blocks(tile_id, bit):
                return False
            if self.map.tileset.priority(tile_id) == 0:
                return True
        return True

    def map_passable(self, x: int, y: int, direction: int) -> bool:
        if not self.valid(x, y):
            return False
        bit = direction_bit(direction)
        for event in self.tiled.get((x, y), ()):
            if self.blocks(event.tile_id, bit):
                return False
            if self.map.tileset.priority(event.tile_id) == 0:
                return True
        return self.tiles_passable(x, y, direction)

    def open_step(self, x: int, y: int, direction: int) -> bool:
        dx, dy = OFFSETS[direction]
        new_x, new_y = x + dx, y + dy
        if not self.valid(new_x, new_y):
            return False
        if self.player.through:
            return True
        if not self.map_passable(x, y, direction):
            return False
        if not self.map_passable(new_x, new_y, 10 - direction):
            return False
        return (new_x, new_y) not in self.walls

    def passable(self, x: int, y: int, direction: int) -> bool:
        if not self.open_step(x, y, direction):
            return False
        dx, dy = STEPS[direction]
        player = self.player
        return player.through or not (
            player.x == x + dx and player.y == y + dy and player.character_name
        )

    def landable(self, x: int, y: int) -> bool:
        return self.open_step(x, y, LAND)

    def counter(self, x: int, y: int) -> bool:
        for layer in (2, 1, 0):
            tile_id = self.map.tiles.at(x, y, layer)
            if tile_id == 0:
                continue
            passage = self.map.tileset.passage(tile_id)
            if passage is not None and passage & COUNTER:
                return True
        return False


def footprint(x: int, y: int, width: int, height: int) -> frozenset[Tile]:
    return frozenset(
        (column, row) for column in range(x, x + width) for row in range(y - height + 1, y + 1)
    )


def direction_bit(direction: int) -> int:
    return (1 << (direction // 2 - 1)) & BLOCKED_EVERY_WAY if direction >= 2 else 0


def event_size(name: str) -> tuple[int, int]:
    match = EVENT_SIZE.search(name)
    return (int(match.group(1)), int(match.group(2))) if match else (1, 1)


def event_script(script: str) -> bool:
    return bool(TEMP_SWITCH.fullmatch(script) or COOLED_DOWN.fullmatch(script))


def live_script_switches(connection: sqlite3.Connection) -> list[int]:
    names = switch_names(connection)
    used = {
        switch_id
        for row in connection.execute("select switch1, switch2 from pages")
        for switch_id in row
        if switch_id is not None
    }
    return sorted(
        switch_id
        for switch_id in used
        if (name := names.get(switch_id)) is not None
        and name.startswith(SCRIPT_SWITCH)
        and not event_script(name[len(SCRIPT_SWITCH) :])
    )


def live_world(session: Session, connection: sqlite3.Connection) -> LiveWorld:
    return read_live_world(
        session,
        lambda map_id: page_counts(connection, map_id),
        live_script_switches(connection),
        guard_items(connection),
    )


def ruby_truthy(value: Any) -> bool:
    return value is not None and value is not False


@dataclass(frozen=True)
class Conditions:
    live: LiveWorld
    names: dict[int, str]

    def switch(self, switch_id: int) -> bool:
        switches = self.live.switches
        if switch_id > MAX_GAME_ID or switch_id >= len(switches):
            return False
        value = switches[switch_id]
        return False if value is None else ruby_truthy(value)

    def variable(self, variable_id: int) -> Any:
        variables = self.live.variables
        if variable_id > MAX_GAME_ID or variable_id >= len(variables):
            return 0
        value = variables[variable_id]
        return 0 if value is None else value

    def met(self, flag: Flag) -> bool:
        if flag.kind == "switch":
            return self.switch(flag.id)
        if flag.kind == "self_switch":
            return self.live.self_switches.get(f"{flag.map_id}:{flag.id}:A") is True
        value = self.variable(flag.id)
        integer = isinstance(value, int) and not isinstance(value, bool)
        return integer and value >= flag.value

    def switch_on(self, map_id: int, event_id: int, switch_id: int, temp: dict[str, bool]) -> bool:
        name = self.names.get(switch_id)
        if name is None:
            return False
        if not name.startswith(SCRIPT_SWITCH):
            return self.switch(switch_id)
        script = name[len(SCRIPT_SWITCH) :]
        if not event_script(script):
            read = self.live.script_switches.get(switch_id)
            if read is None:
                raise NavigateError(f"script switch {switch_id} {script!r} was not read")
            return read
        return self.script_switch(map_id, event_id, script, temp)

    def script_switch(self, map_id: int, event_id: int, script: str, temp: dict[str, bool]) -> bool:
        if match := TEMP_SWITCH.fullmatch(script):
            on = temp.get(match.group(2), False)
            return on if match.group(1) == "tsOn" else not on
        if match := COOLED_DOWN.fullmatch(script):
            amount = int(match.group(2))
            stored = self.live.event_vars.get(f"{map_id}:{event_id}")
            expired = (
                self.expired_days(stored, amount)
                if match.group(1) == "cooledDownDays"
                else self.expired(stored, amount)
            )
            return expired and not temp.get("A", False)
        raise NavigateError(f"script switch {script!r} is not ported")

    def expired(self, stored: Any, seconds: int) -> bool:
        if not isinstance(stored, int):
            return False
        return self.live.clock.unix > stored + seconds

    def expired_days(self, stored: Any, days: int) -> bool:
        clock = self.live.clock
        on_time = stored if isinstance(stored, int) else 0
        passed = clock.unix - on_time
        elapsed = passed // SECONDS_PER_DAY
        if passed % SECONDS_PER_DAY > clock.seconds_since_midnight:
            elapsed += 1
        return elapsed >= days

    def holds(self, map_id: int, event_id: int, page: Page, temp: dict[str, bool]) -> bool:
        for switch_id in (page.switch1, page.switch2):
            if switch_id is not None and not self.switch_on(map_id, event_id, switch_id, temp):
                return False
        if page.variable_id is not None:
            value = self.variable(page.variable_id)
            integer = isinstance(value, int) and not isinstance(value, bool)
            if integer and value < (page.variable_value or 0):
                return False
        if page.self_switch is not None:
            key = f"{map_id}:{event_id}:{page.self_switch}"
            if self.live.self_switches.get(key) is not True:
                return False
        return True

    def active_page(
        self, map_id: int, event: MapEvent, temp: dict[str, bool] | None = None
    ) -> Page | None:
        for page in reversed(event.pages):
            if self.holds(map_id, event.id, page, temp or {}):
                return page
        return None


def live_obstacles(live: LiveWorld) -> tuple[Obstacle, ...]:
    return tuple(
        Obstacle(
            id=event.id,
            x=event.x,
            y=event.y,
            width=event.width,
            height=event.height,
            through=event.through,
            character_name=event.character_name,
            tile_id=event.tile_id,
        )
        for event in sorted(live.events.values(), key=lambda event: event.id)
    )


def mover(live: LiveWorld) -> Mover:
    return Mover(
        x=live.player.x,
        y=live.player.y,
        through=live.player.through,
        character_name=live.player.character_name,
        bridge=live.bridge,
        surfing=live.surfing,
        bicycle=live.bicycle,
        rock_climbing=live.rock_climbing,
    )


def live_grid(connection: sqlite3.Connection, live: LiveWorld) -> Grid:
    return Grid(map_data(connection, live.map_id), live_obstacles(live), mover(live))


def page_counts(connection: sqlite3.Connection, map_id: int) -> dict[int, int]:
    return {
        event_id: count
        for event_id, count in connection.execute(
            "select event_id, count(*) from pages where map_id = ? group by event_id", (map_id,)
        )
    }


GAME_PASSABILITY = (
    "m=$game_map;p=$game_player;s='';c='';"
    "for y in 0...m.height;for x in 0...m.width;c<<(m.counter?(x,y) ? '1':'0');"
    "for d in [2,4,6,8];s<<(p.passable?(x,y,d) ? '1':'0');end;end;end;"
    "[m.map_id,m.width,m.height,s,c].join(';')"
)


@dataclass(frozen=True)
class GameTiles:
    tick: int
    map_id: int
    width: int
    height: int
    passable: str
    counters: str


def game_tiles(session: Session) -> GameTiles:
    answer = session.eval(GAME_PASSABILITY)
    map_id, width, height, passable, counters = answer.value.inspect.strip('"').split(";")
    return GameTiles(answer.tick, int(map_id), int(width), int(height), passable, counters)


@dataclass(frozen=True)
class StepDisagreement:
    x: int
    y: int
    direction: int
    port: bool
    game: bool


@dataclass(frozen=True)
class TileDisagreement:
    x: int
    y: int
    port: bool
    game: bool


@dataclass(frozen=True)
class PageDisagreement:
    event_id: int
    port: int | None
    game: int | None


@dataclass(frozen=True)
class CheckReport:
    live: LiveWorld
    map: MapData
    steps: int
    step_disagreements: list[StepDisagreement]
    counters: int
    counter_disagreements: list[TileDisagreement]
    pages: int
    page_disagreements: list[PageDisagreement]
    unknown_events: list[int]


def check(session: Session, connection: sqlite3.Connection) -> CheckReport:
    live = live_world(session, connection)
    game = game_tiles(session)
    if game.tick != live.tick or game.map_id != live.map_id:
        raise NavigateError(
            f"the game moved between the live read (tick {live.tick}, map {live.map_id}) and "
            f"the passability eval (tick {game.tick}, map {game.map_id}); run as the driver"
        )
    grid = live_grid(connection, live)
    if (grid.map.width, grid.map.height) != (game.width, game.height):
        raise NavigateError(
            f"map {live.map_id} is {game.width}x{game.height} in the game but "
            f"{grid.map.width}x{grid.map.height} in the world cache"
        )
    steps = []
    counters = []
    index = 0
    for y in range(grid.map.height):
        for x in range(grid.map.width):
            port_counter = grid.counter(x, y)
            game_counter = game.counters[y * grid.map.width + x] == TRUE_BIT
            if port_counter != game_counter:
                counters.append(TileDisagreement(x, y, port_counter, game_counter))
            for direction in DIRECTIONS:
                port = grid.passable(x, y, direction)
                ruby = game.passable[index] == TRUE_BIT
                index += 1
                if port != ruby:
                    steps.append(StepDisagreement(x, y, direction, port, ruby))
    pages, unknown = page_disagreements(connection, live)
    return CheckReport(
        live=live,
        map=grid.map,
        steps=index,
        step_disagreements=steps,
        counters=grid.map.width * grid.map.height,
        counter_disagreements=counters,
        pages=len(live.events) - len(unknown),
        page_disagreements=pages,
        unknown_events=unknown,
    )


def page_disagreements(
    connection: sqlite3.Connection, live: LiveWorld
) -> tuple[list[PageDisagreement], list[int]]:
    events = map_events(connection, live.map_id)
    conditions = Conditions(live, switch_names(connection))
    disagreements = []
    unknown = []
    for event_id, event in sorted(live.events.items()):
        static = events.get(event_id)
        if static is None:
            unknown.append(event_id)
            continue
        page = (
            None
            if event.erased
            else conditions.active_page(live.map_id, static, event.temp_switches)
        )
        port = None if page is None else page.number
        if port != event.page:
            disagreements.append(PageDisagreement(event_id, port, event.page))
    return disagreements, unknown


RUN_TOGGLE_STYLE = 1
WALK_SPEED = 3.5
RUN_SPEED = 5.5
ICE_SPEED = 5
BIKE_SPEED = 6
SURF_SPEED = 4.2
DIVE_SPEED = 3
JUMP_TILE_SECONDS = 0.125
COST_TICK_SECONDS = 0.025
SLIDE_START_TICKS = 1
CARRY_START_TICKS = 1
ANSWER_TICKS = 20
CURSOR_PRESS_TICKS = 2
CURSOR_STOPS = 3
TOUCH_TRIGGERS = frozenset({1, 2})
ACTION_TRIGGER = 0
WANDER_MOVE = 1
EVENT_TOUCH_TRIGGER = 2
AUTORUN_TRIGGER = 3
WARP_TRIGGERS = TOUCH_TRIGGERS | {ACTION_TRIGGER}
LOAD_TRIGGERS = frozenset({3, 4})
WARP_TICKS = 18
BUMP_TICKS = 6
STEP_START_TICKS = 4
TURN_TICKS = 1
PRESS_TICKS = 1
BUMP_LIMIT_TICKS = 60
WARP_POLL_TICKS = 10
WARP_STOPS = 120
WARP_START_LIMIT_TICKS = 20
TOUCH_PENALTY_TICKS = 600
BUTTONS = {2: "DOWN", 4: "LEFT", 6: "RIGHT", 8: "UP"}
RUN_BUTTON = "ACTION"
USE_BUTTON = "C"
TRANSITION = "transition"
STEP_LIMIT_TICKS = 30
RETRY_WAIT_TICKS = 20
BLOCKED_RETRIES = 2
STALE_REPLANS = 3
TRANSITION_STOPS = 200
STILL_LIMIT_TICKS = 120
EVENT_START_TICKS = 1

SURF_ITEM = "SURFITEM"
CLIMB_ITEM = "ROCKCLIMBITEM"
FLY_ITEM = "POKERIDER"
LENS_ITEM = "LENSOFTRUTH"
LENS_EVENT = re.compile(r"#EOT\b.*\bHIDE\b")
CUT_ITEM = "CUTITEM"
CUT_TREE = re.compile(r"cuttree", re.IGNORECASE)
LENS_TICKS = 152
FLY_TICKS = 24
FLY_SQUARE_TICKS = 2
NO_TOWN_SQUARE = (0, 0, 0)
FLY_VEHICLES = frozenset({"foot", "bicycle", "lens"})
SURF_USED = "¡\\c[1]{}\\c[0] usó la \\c[1]Montura Surf\\c[0]!"
NO_ITEM_ANIMATION = 1
SURF_MESSAGE_TICKS = 18
CLIMB_USED = "¡\\c[1]{}\\c[0] usó el \\c[1]Equipo de Escalada\\c[0]!"
CLIMB_MESSAGE_TICKS = 20
CLIMB_TICKS = 10
CLIMB_STEP_TICKS = 4
MESSAGE = "message"
CHOICE = "choice"
DIALOG_POLL_TICKS = 10
DIALOG_STOPS = 200
TALK_STOPS = 400
DIALOG_START_LIMIT_TICKS = 20
PRESS_LIMIT_TICKS = 120
ARRIVAL_QUIET_TICKS = 20

type Outcome = Literal["arrived", "interrupted", "stuck", "unreachable", "refused"]
type ExitKind = Literal["step", "bump", "press", "surf", "climb", "fly", "lens", "open"]
type Vehicle = Literal["foot", "bicycle", "surf", "lens"]
WARP_KINDS = frozenset({"step", "bump", "press"})


def cost_ticks(seconds: float) -> int:
    return math.floor(round(seconds / COST_TICK_SECONDS, 6)) + 1


def move_seconds(speed: float) -> float:
    if speed == 6:
        return 0.05
    if speed == 5:
        return 0.1
    return 2.0 / 2**speed


def step_ticks(speed: float) -> int:
    return cost_ticks(move_seconds(speed))


def jump_ticks(tiles: int) -> int:
    return cost_ticks(JUMP_TILE_SECONDS * tiles)


@dataclass(frozen=True)
class Pace:
    run_input: bool
    shoes: bool
    surfing: bool
    bicycle: bool
    diving: bool

    def can_run(self, tag: int) -> bool:
        vehicle = self.surfing or self.bicycle or self.diving
        return self.run_input and self.shoes and not vehicle and tag != TALL_GRASS

    def speed(self, tag: int) -> float:
        if tag == ICE:
            return ICE_SPEED
        if self.diving:
            return DIVE_SPEED
        if self.surfing:
            return SURF_SPEED
        if self.bicycle:
            return BIKE_SPEED
        return RUN_SPEED if self.can_run(tag) else WALK_SPEED

    @property
    def fastest_tile(self) -> int:
        return min(step_ticks(self.speed(tag)) for tag in (0, ICE))

    def on(self, vehicle: Vehicle) -> "Pace":
        return replace(self, surfing=vehicle == "surf", bicycle=vehicle == "bicycle")


def vehicle_of(live: LiveWorld) -> Vehicle:
    if live.surfing:
        return "surf"
    if live.bicycle:
        return "bicycle"
    return "lens" if live.lens > 0 and on_foot(live) else "foot"


@dataclass(frozen=True)
class Abilities:
    surf: bool
    climb: bool
    fly: bool
    lens: bool
    keys: frozenset[str] | None

    def holds(self, items: tuple[str, ...]) -> bool:
        return self.keys is None or self.keys.issuperset(items)


def abilities_of(live: LiveWorld) -> Abilities:
    return Abilities(
        surf=live.key_items.get(SURF_ITEM, 0) > 0,
        climb=live.key_items.get(CLIMB_ITEM, 0) > 0,
        fly=live.key_items.get(FLY_ITEM, 0) > 0 and live.follower_allows_transfer,
        lens=live.key_items.get(LENS_ITEM, 0) > 0,
        keys=frozenset(name for name, held in live.key_items.items() if held),
    )


EVERY_ABILITY = Abilities(surf=True, climb=True, fly=True, lens=True, keys=None)


def on_foot(live: LiveWorld) -> bool:
    return not (live.surfing or live.bicycle or live.diving)


def runs_by_holding(live: LiveWorld) -> bool:
    return live.run_style != RUN_TOGGLE_STYLE and live.running_shoes and on_foot(live)


def runs(live: LiveWorld) -> bool:
    return live.running_shoes and on_foot(live)


def pace_for(live: LiveWorld, holding: bool) -> Pace:
    return Pace(
        run_input=live.run_style == RUN_TOGGLE_STYLE or holding,
        shoes=live.running_shoes,
        surfing=live.surfing,
        bicycle=live.bicycle,
        diving=live.diving,
    )


@dataclass(frozen=True)
class Move:
    direction: int
    jump: bool
    tiles: tuple[Tile, ...]
    ticks: int
    vehicle: Vehicle | None = None
    stair: bool = False
    passing: tuple[Tile, ...] = ()
    carried: tuple[Tile, ...] = ()

    @property
    def end(self) -> Tile:
        return self.tiles[-1]

    @property
    def slide(self) -> int:
        return 0 if self.stair else len(self.tiles) - 1 - len(self.carried)


@dataclass(frozen=True)
class Stair:
    dx: int
    dy: int

    @property
    def direction(self) -> int:
        return 6 if self.dx > 0 else 4


def stair_of(commands: PageCommands | None) -> Stair | None:
    if commands is None:
        return None
    slope = width = None
    offset = STAIR_DEFAULT_OFFSET
    for comment in commands.comments:
        if found := STAIR_SLOPE.search(comment):
            slope = (int(found.group(1)), int(found.group(2)))
        elif found := STAIR_WIDTH.search(comment):
            width = found.groups()
        elif found := STAIR_OFFSET.search(comment):
            offset = int(found.group(1))
    if slope is None or width is None or slope[0] == 0 or not 0 <= offset < TILE_PIXELS:
        return None
    return Stair(*slope)


@dataclass(frozen=True)
class Push:
    direction: int
    steps: int


def push_of(commands: PageCommands | None) -> Push | None:
    if commands is None or commands.route is None:
        return None
    moves = [code for code in commands.route if code not in ROUTE_COSMETIC and code != ROUTE_END]
    if not moves or len(set(moves)) != 1 or moves[0] not in ROUTE_DIRECTIONS:
        return None
    return Push(ROUTE_DIRECTIONS[moves[0]], len(moves))


def carry(grid: Grid, pushes: dict[Tile, Push], start: Tile) -> tuple[tuple[Tile, ...], int] | None:
    here = start
    push = pushes[start]
    direction, left = push.direction, push.steps
    triggered = [start]
    path: list[Tile] = []
    while left:
        if not grid.open_step(*here, direction):
            return None
        dx, dy = STEPS[direction]
        here = (here[0] + dx, here[1] + dy)
        path.append(here)
        left -= 1
        if here in pushes:
            if here in triggered:
                return None
            triggered.append(here)
            direction, left = pushes[here].direction, pushes[here].steps
    return tuple(path), len(triggered)


def move_toward(
    grid: Grid,
    pace: Pace,
    x: int,
    y: int,
    direction: int,
    stairs: dict[Tile, Stair],
    pushes: dict[Tile, Push],
) -> Move | None:
    if not grid.open_step(x, y, direction):
        return None
    stair = stairs.get((x, y))
    if stair is not None and stair.direction == direction and not grid.player.surfing:
        return cross_stair(grid, pace, x, y, stair)
    dx, dy = STEPS[direction]
    speed = pace.speed(grid.terrain_tag(x, y))
    near = (x + dx, y + dy)
    if grid.player.surfing and grid.terrain_tag(*near) not in SURFABLE:
        return leave_water(grid, near, direction)
    if grid.terrain_tag(*near) == LEDGE:
        landing = (near[0] + dx, near[1] + dy)
        if not grid.landable(*landing):
            return None
        tiles = [landing]
        ticks = jump_ticks(2)
        jump = True
    else:
        tiles = [near]
        ticks = step_ticks(speed)
        jump = False
    slid = slide(grid, tiles[-1], direction)
    if slid is None:
        return None
    if slid:
        tiles += slid
        ticks += SLIDE_START_TICKS + len(slid) * step_ticks(ICE_SPEED)
    if tiles[-1] not in pushes:
        return Move(direction, jump, tuple(tiles), ticks)
    carried = carry(grid, pushes, tiles[-1])
    if carried is None:
        return None
    path, triggers = carried
    entry = ICE_SPEED if slid else WALK_SPEED if jump else speed
    ticks += triggers * CARRY_START_TICKS + len(path) * step_ticks(entry)
    return Move(direction, jump, (*tiles, *path), ticks, carried=path)


def cross_stair(grid: Grid, pace: Pace, x: int, y: int, stair: Stair) -> Move | None:
    step = 1 if stair.dx > 0 else -1
    row = [(x + step * distance, y) for distance in range(1, abs(stair.dx) + 1)]
    end = (x + stair.dx, y + stair.dy)
    if not grid.valid(*end):
        return None
    sources = [(x, y), *row[:-1]]
    ticks = sum(step_ticks(pace.speed(grid.terrain_tag(*tile))) for tile in sources)
    return Move(stair.direction, False, (*row[:-1], end), ticks, stair=True, passing=(row[-1],))


def leave_water(grid: Grid, near: Tile, direction: int) -> Move | None:
    here = behind(near, direction)
    if grid.terrain_tag(*here) not in PASSABLE_WATER or grid.terrain_tag(*near) in (LEDGE, ICE):
        return None
    if not grid.landable(*near):
        return None
    return Move(direction, True, (near,), jump_ticks(1), "foot")


def slide(grid: Grid, start: Tile, direction: int) -> list[Tile] | None:
    dx, dy = STEPS[direction]
    x, y = start
    tiles: list[Tile] = []
    while grid.terrain_tag(x, y) == ICE and grid.open_step(x, y, direction):
        x, y = x + dx, y + dy
        if grid.terrain_tag(x, y) == LEDGE or (x, y) in tiles:
            return None
        tiles.append((x, y))
    return tiles


@dataclass(frozen=True)
class Spot:
    id: int
    name: str
    x: int
    y: int
    width: int
    height: int
    page: Page | None
    through: bool
    character_name: str

    @property
    def tiles(self) -> frozenset[Tile]:
        return footprint(self.x, self.y, self.width, self.height)


@dataclass(frozen=True)
class Prompt:
    text: str
    options: tuple[str, ...] | None
    answer: int = 0


@dataclass(frozen=True)
class Exit:
    kind: ExitKind
    direction: int | None
    event_id: int | None
    destination: Place
    vehicle: Vehicle | None = None
    ticks: int = 0
    prompts: tuple[Prompt, ...] = ()
    touches: int = 0
    town: str | None = None
    square: tuple[int, int, int] | None = None
    items: tuple[str, ...] = ()
    passed: tuple[Tile, ...] = ()


@dataclass(frozen=True)
class Area:
    grid: Grid
    spots: dict[int, Spot]
    touch: frozenset[Tile]
    warp_tiles: frozenset[Tile]
    exits: dict[Tile, tuple[Exit, ...]]
    stairs: dict[Tile, Stair]
    pushes: dict[Tile, Push]
    closed: dict[Tile, Gate]
    scenes: dict[Tile, int]
    quiet: frozenset[Tile]


@dataclass
class Static:
    connection: sqlite3.Connection
    names: dict[int, str] = field(init=False)
    ids: list[int] = field(init=False)
    bicycle_only: frozenset[int] = field(init=False)
    outdoor: frozenset[int] = field(init=False)
    landings: list[Landing] = field(init=False)
    squares: dict[int, tuple[int, int, int]] = field(init=False)
    events: dict[int, dict[int, MapEvent]] = field(default_factory=dict)
    transfers: dict[int, dict[tuple[int, int], tuple[Place, ...]]] = field(default_factory=dict)
    maps: dict[int, MapData] = field(default_factory=dict)
    commands: dict[int, dict[tuple[int, int], PageCommands]] = field(default_factory=dict)
    temp_sets: dict[int, dict[tuple[int, int], frozenset[str]]] = field(default_factory=dict)
    facings: dict[int, dict[tuple[int, int], int]] = field(default_factory=dict)
    choices: dict[int, dict[tuple[int, int], tuple[ChoiceTransfer, ...]]] = field(
        default_factory=dict
    )
    scenes: dict[int, frozenset[tuple[int, int]]] = field(default_factory=dict)
    quiet_pages: dict[int, frozenset[tuple[int, int]]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.names = switch_names(self.connection)
        self.ids = map_ids(self.connection)
        self.bicycle_only = always_bicycle_maps(self.connection)
        self.outdoor = outdoor_maps(self.connection)
        self.landings = landings(self.connection)
        self.squares = town_map_positions(self.connection)

    def map_events(self, map_id: int) -> dict[int, MapEvent]:
        if map_id not in self.events:
            self.events[map_id] = map_events(self.connection, map_id)
        return self.events[map_id]

    def quiet_transfers(self, map_id: int) -> dict[tuple[int, int], tuple[Place, ...]]:
        if map_id not in self.transfers:
            self.transfers[map_id] = quiet_transfers(self.connection, map_id)
        return self.transfers[map_id]

    def choice_transfers(self, map_id: int) -> dict[tuple[int, int], tuple[ChoiceTransfer, ...]]:
        if map_id not in self.choices:
            self.choices[map_id] = choice_transfers(self.connection, map_id)
        return self.choices[map_id]

    def transfer_facings(self, map_id: int) -> dict[tuple[int, int], int]:
        if map_id not in self.facings:
            self.facings[map_id] = transfer_facings(self.connection, map_id)
        return self.facings[map_id]

    def map_data(self, map_id: int) -> MapData:
        if map_id not in self.maps:
            self.maps[map_id] = map_data(self.connection, map_id)
        return self.maps[map_id]

    def page_commands(self, map_id: int) -> dict[tuple[int, int], PageCommands]:
        if map_id not in self.commands:
            self.commands[map_id] = page_commands(self.connection, map_id)
        return self.commands[map_id]

    def scene_pages(self, map_id: int) -> frozenset[tuple[int, int]]:
        if map_id not in self.scenes:
            self.scenes[map_id] = scene_pages(self.connection, map_id)
        return self.scenes[map_id]

    def quiet_touches(self, map_id: int) -> frozenset[tuple[int, int]]:
        if map_id not in self.quiet_pages:
            self.quiet_pages[map_id] = quiet_touch_pages(self.connection, map_id)
        return self.quiet_pages[map_id]

    def temp_switches_set(self, map_id: int) -> dict[tuple[int, int], frozenset[str]]:
        if map_id not in self.temp_sets:
            self.temp_sets[map_id] = temp_switches_set(self.connection, map_id)
        return self.temp_sets[map_id]


@dataclass
class Atlas:
    static: Static
    live: LiveWorld
    abilities: Abilities
    story: bool = True
    felled: bool = False
    conditions: Conditions = field(init=False)
    spot_cache: dict[int, dict[int, Spot]] = field(default_factory=dict)
    autorun_cache: dict[int, tuple[ChoiceTransfer, ...]] = field(default_factory=dict)
    areas: dict[tuple[int, Vehicle], Area] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.conditions = Conditions(self.live, self.static.names)

    def spots(self, map_id: int) -> dict[int, Spot]:
        if map_id not in self.spot_cache:
            events = self.static.map_events(map_id)
            if map_id == self.live.map_id:
                spots = live_spots(events, self.live)
            else:
                sets = self.static.temp_switches_set(map_id)
                spots = static_spots(map_id, events, self.conditions, sets)
            if not self.story:
                spots = self.opened(map_id, events, spots)
            self.spot_cache[map_id] = spots
        return self.spot_cache[map_id]

    def opened(
        self, map_id: int, events: dict[int, MapEvent], spots: dict[int, Spot]
    ) -> dict[int, Spot]:
        found = dict(spots)
        sets = self.static.temp_switches_set(map_id)
        for gate in GATES:
            if gate.map_id != map_id or gate.kind != "wall" or self.conditions.met(gate.opens):
                continue
            conditions = Conditions(flag_met(self.live, gate.opens), self.static.names)
            for event_id in gate.events:
                spot = found.get(event_id)
                event = events.get(event_id)
                if spot is not None and event is not None:
                    page = loaded_page(map_id, event, conditions, sets)
                    found[event_id] = replace(spot, page=page)
        return found

    def destination(self, map_id: int, spot: Spot) -> Place | None:
        page = spot.page
        if page is None or page.trigger not in WARP_TRIGGERS:
            return None
        places = set(self.static.quiet_transfers(map_id).get((spot.id, page.number), ()))
        if len(places) != 1:
            redirect = redirected_transfer(places, self.conditions.switch)
            if redirect is not None:
                return redirect
            if places:
                log.debug(
                    "map %d event %d page %d has %d destinations; not used as a warp",
                    map_id,
                    spot.id,
                    page.number,
                    len(places),
                )
            return None
        return places.pop()

    def choices(self, map_id: int, spot: Spot) -> tuple[ChoiceTransfer, ...]:
        page = spot.page
        if page is None:
            return ()
        found = self.static.choice_transfers(map_id).get((spot.id, page.number), ())
        if page.trigger == ACTION_TRIGGER:
            return tuple(
                transfer for transfer in found if not transfer.before and not transfer.after
            )
        if page.trigger == EVENT_TOUCH_TRIGGER and COUNTER_EVENT.search(spot.name):
            return found
        return ()

    def autoruns(self, map_id: int) -> tuple[ChoiceTransfer, ...]:
        if map_id not in self.autorun_cache:
            self.autorun_cache[map_id] = self.find_autoruns(map_id)
        return self.autorun_cache[map_id]

    def find_autoruns(self, map_id: int) -> tuple[ChoiceTransfer, ...]:
        chosen = self.static.choice_transfers(map_id)
        for spot in self.spots(map_id).values():
            page = spot.page
            if page is None or page.trigger != AUTORUN_TRIGGER:
                continue
            found = chosen.get((spot.id, page.number), ())
            if found and {transfer.answer for transfer in found} == set(
                range(len(found[0].options))
            ):
                return found
        return ()

    def arrivals(self, map_id: int, exit: Exit) -> list[Exit]:
        destination = exit.destination.map_id
        if exit.kind not in WARP_KINDS or destination == map_id:
            return [exit]
        autoruns = self.autoruns(destination)
        if not autoruns:
            return [exit]
        return [
            replace(
                exit,
                destination=transfer.place,
                prompts=exit.prompts + transfer_prompts(transfer),
                items=exit.items + transfer.items,
            )
            for transfer in autoruns
            if self.abilities.holds(transfer.items)
        ]

    def grid(self, map_id: int, vehicle: Vehicle) -> Grid:
        data = self.static.map_data(map_id)
        player = replace(mover(self.live), surfing=vehicle == "surf", bicycle=vehicle == "bicycle")
        if map_id == self.live.map_id:
            obstacles = self.revealed(map_id, vehicle, live_obstacles(self.live))
            obstacles = self.wandered(map_id, obstacles)
            return Grid(data, self.unwalled(map_id, self.cleared(map_id, obstacles)), player)
        obstacles = tuple(
            Obstacle(
                id=spot.id,
                x=spot.x,
                y=spot.y,
                width=spot.width,
                height=spot.height,
                through=spot.through,
                character_name=spot.character_name,
                tile_id=0 if spot.page is None else spot.page.tile_id,
            )
            for spot in self.spots(map_id).values()
        )
        obstacles = self.wandered(map_id, self.revealed(map_id, vehicle, obstacles))
        return Grid(data, self.unwalled(map_id, self.cleared(map_id, obstacles)), player)

    def wandered(self, map_id: int, obstacles: tuple[Obstacle, ...]) -> tuple[Obstacle, ...]:
        wanderers = {
            spot.id
            for spot in self.spots(map_id).values()
            if spot.page is not None and spot.page.move_type == WANDER_MOVE
        }
        if not wanderers:
            return obstacles
        return tuple(
            replace(obstacle, through=True) if obstacle.id in wanderers else obstacle
            for obstacle in obstacles
        )

    def trees(self, map_id: int) -> dict[int, Spot]:
        return {spot.id: spot for spot in self.spots(map_id).values() if CUT_TREE.search(spot.name)}

    def cleared(self, map_id: int, obstacles: tuple[Obstacle, ...]) -> tuple[Obstacle, ...]:
        if not self.felled:
            return obstacles
        trees = self.trees(map_id)
        if not trees:
            return obstacles
        return tuple(
            replace(obstacle, through=True) if obstacle.id in trees else obstacle
            for obstacle in obstacles
        )

    def hidden(self, map_id: int) -> frozenset[int]:
        return frozenset(
            spot.id for spot in self.spots(map_id).values() if LENS_EVENT.search(spot.name)
        )

    def revealed(
        self, map_id: int, vehicle: Vehicle, obstacles: tuple[Obstacle, ...]
    ) -> tuple[Obstacle, ...]:
        hidden = self.hidden(map_id)
        if not hidden:
            return obstacles
        return tuple(
            replace(obstacle, through=vehicle == "lens") if obstacle.id in hidden else obstacle
            for obstacle in obstacles
        )

    def hidden_tiles(self, map_id: int) -> frozenset[Tile]:
        spots = self.spots(map_id)
        return frozenset(tile for event_id in self.hidden(map_id) for tile in spots[event_id].tiles)

    def unwalled(self, map_id: int, obstacles: tuple[Obstacle, ...]) -> tuple[Obstacle, ...]:
        if self.story:
            return obstacles
        walls = {
            event_id
            for gate in GATES
            if gate.map_id == map_id and gate.kind == "wall" and not self.conditions.met(gate.opens)
            for event_id in gate.events
        }
        return tuple(
            replace(obstacle, through=True) if obstacle.id in walls else obstacle
            for obstacle in obstacles
        )

    def area(self, map_id: int, vehicle: Vehicle) -> Area:
        key = (map_id, vehicle)
        if key not in self.areas:
            self.areas[key] = self.build_area(map_id, vehicle)
        return self.areas[key]

    def build_area(self, map_id: int, vehicle: Vehicle) -> Area:
        grid = self.grid(map_id, vehicle)
        spots = self.spots(map_id)
        commands = self.static.page_commands(map_id)
        touch: set[Tile] = set()
        warp_tiles: set[Tile] = set()
        exits: dict[Tile, list[Exit]] = {}
        stairs: dict[Tile, Stair] = {}
        pushes: dict[Tile, Push] = {}
        gates = [gate for gate in GATES if gate.map_id == map_id]
        recorded = {event_id for gate in gates for event_id in gate.events}
        closed: dict[Tile, Gate] = {}
        for gate in gates:
            if gate.kind != "wall" or self.conditions.met(gate.opens):
                continue
            for event_id in gate.events:
                spot = spots.get(event_id)
                if spot is not None:
                    closed.update(dict.fromkeys(spot.tiles, gate))
        if self.story and vehicle != "surf":
            for source, exit in self.door_exits(map_id, grid, spots, closed):
                exits.setdefault(source, []).append(exit)
        talking = self.static.scene_pages(map_id)
        silent = self.static.quiet_touches(map_id)
        quiet: set[Tile] = set()
        scenes: dict[Tile, int] = {}
        for spot in spots.values():
            page = spot.page
            if page is None:
                continue
            stair = None
            if spot.name == STAIR_EVENT and page.trigger in TOUCH_TRIGGERS:
                stair = stair_of(commands.get((spot.id, page.number)))
            if stair is not None:
                stairs.update((tile, stair) for tile in spot.tiles)
            elif page.trigger in TOUCH_TRIGGERS:
                touch |= spot.tiles
                push = push_of(commands.get((spot.id, page.number)))
                if push is not None and over_trigger(grid, spot):
                    pushes.update((tile, push) for tile in spot.tiles)
                elif (spot.id, page.number) in silent:
                    quiet |= spot.tiles
            chosen = self.choices(map_id, spot)
            sight = sight_tiles(grid, spot) if chosen and page.trigger != ACTION_TRIGGER else None
            if sight is not None:
                warp_tiles |= sight
            for transfer in chosen:
                if not self.abilities.holds(transfer.items):
                    continue
                prompts = transfer_prompts(transfer)
                if sight is None:
                    sources = spot_exits(grid, spot, transfer.place)
                else:
                    sources = sight_exits(grid, spot, sight, transfer.place)
                for source, exit in sources:
                    found = replace(exit, prompts=prompts, items=transfer.items)
                    exits.setdefault(source, []).append(found)
            destination = self.destination(map_id, spot)
            if (
                destination is None
                and stair is None
                and page.trigger in TOUCH_TRIGGERS
                and spot.id not in recorded
                and not spot.character_name
                and page.tile_id == 0
                and (spot.id, page.number) in talking
                and not any(tile in pushes for tile in spot.tiles)
            ):
                scenes.update(dict.fromkeys(spot.tiles, spot.id))
            if destination is None:
                continue
            if page.trigger in TOUCH_TRIGGERS:
                warp_tiles |= spot.tiles
            facing = self.static.transfer_facings(map_id).get((spot.id, page.number))
            for source, exit in spot_exits(grid, spot, destination):
                if facing is None or exit.direction == facing:
                    exits.setdefault(source, []).append(exit)
        surfable = map_id not in self.static.bicycle_only
        if self.abilities.surf and vehicle != "surf" and surfable:
            water = self.grid(map_id, "surf")
            prompts = surf_prompts(self.live)
            for source, exit in surf_exits(grid, water, spots, touch, prompts):
                exits.setdefault(source, []).append(exit)
        if self.abilities.lens and vehicle == "foot" and self.hidden(map_id):
            for x in range(grid.map.width):
                for y in range(grid.map.height):
                    place = Place(map_id, x, y)
                    exit = Exit("lens", None, None, place, "lens", LENS_TICKS)
                    exits.setdefault((x, y), []).append(exit)
        if self.abilities.climb:
            prompts = climb_prompts(self.live)
            sliding = replace(grid, player=replace(grid.player, through=True))
            uncrossed = warp_tiles | closed.keys() | scenes.keys() if self.story else warp_tiles
            climbs = climb_exits(grid, sliding, spots, touch, uncrossed, prompts)
            for source, exit in climbs:
                exits.setdefault(source, []).append(exit)
        return Area(
            grid=grid,
            spots=spots,
            touch=frozenset(touch),
            warp_tiles=frozenset(warp_tiles),
            exits={
                tile: tuple(arrival for exit in found for arrival in self.arrivals(map_id, exit))
                for tile, found in exits.items()
            },
            stairs=stairs,
            pushes=pushes,
            closed=closed,
            scenes=scenes,
            quiet=frozenset(quiet),
        )

    def door_exits(
        self, map_id: int, grid: Grid, spots: dict[int, Spot], closed: dict[Tile, Gate]
    ) -> list[tuple[Tile, Exit]]:
        found: list[tuple[Tile, Exit]] = []
        for gate in dict.fromkeys(closed.values()):
            opener = gate.opener
            if opener is None or opener.talk or not self.openable(gate):
                continue
            prompts = door_prompts(opener)
            warps = self.opened_warps(map_id, gate, spots)
            if warps:
                for event_id, place in warps.items():
                    for source, direction in facing_tiles(grid, spots[event_id]).items():
                        exit = Exit("open", direction, event_id, place, prompts=prompts)
                        found.append((source, exit))
                continue
            doors = {
                tile: event_id
                for event_id in gate.events
                if (spot := spots.get(event_id)) is not None
                for tile in spot.tiles
            }
            opened = replace(
                grid,
                obstacles=tuple(
                    replace(obstacle, through=True) if obstacle.id in gate.events else obstacle
                    for obstacle in grid.obstacles
                ),
            )
            for tile, event_id in sorted(doors.items()):
                for direction in DIRECTIONS:
                    source = behind(tile, direction)
                    if source in doors or not opened.open_step(*source, direction):
                        continue
                    passed = door_crossing(opened, doors, tile, direction)
                    end = passed[-1]
                    if end in doors:
                        ahead = behind(end, direction, -1)
                        warp = None if ahead in doors else self.warp_at(map_id, spots, ahead)
                        if warp is None:
                            continue
                        destination = warp
                    elif end in closed:
                        continue
                    else:
                        destination = self.warp_at(map_id, spots, end) or Place(map_id, *end)
                    exit = Exit(
                        "open",
                        direction,
                        event_id,
                        destination,
                        prompts=prompts,
                        passed=passed,
                    )
                    found.append((source, exit))
        return found

    def opened_warps(self, map_id: int, gate: Gate, spots: dict[int, Spot]) -> dict[int, Place]:
        events = self.static.map_events(map_id)
        sets = self.static.temp_switches_set(map_id)
        conditions = Conditions(flag_met(self.live, gate.opens), self.static.names)
        found = {}
        for event_id in gate.events:
            spot = spots.get(event_id)
            event = events.get(event_id)
            if spot is None or event is None:
                continue
            page = loaded_page(map_id, event, conditions, sets)
            place = self.destination(map_id, replace(spot, page=page))
            if place is not None:
                found[event_id] = place
        return found

    def warp_at(self, map_id: int, spots: dict[int, Spot], tile: Tile) -> Place | None:
        for spot in spots.values():
            page = spot.page
            if page is None or page.trigger not in TOUCH_TRIGGERS or tile not in spot.tiles:
                continue
            place = self.destination(map_id, spot)
            if place is not None:
                return place
        return None

    def openable(self, gate: Gate) -> bool:
        opener = gate.opener
        return opener is not None and all(self.conditions.met(flag) for flag in opener.needs)

    def crossable(self, gate: Gate) -> bool:
        return self.openable(gate) and gate.opener is not None and not gate.opener.talk

    def talk_goal(self, gate: Gate) -> "Goal | None":
        opener = gate.opener
        if opener is None:
            return None
        grid = self.area(gate.map_id, "foot").grid
        spots = self.spots(gate.map_id)
        tiles: dict[Tile, int | None] = {}
        for event_id in opener.talk:
            spot = spots.get(event_id)
            if spot is not None and spot.page is not None:
                for tile, direction in facing_tiles(grid, spot).items():
                    tiles.setdefault(tile, direction)
        return Goal(gate.map_id, tiles, opener.talk[0]) if tiles else None

    @cached_property
    def flights(self) -> tuple[Exit, ...]:
        if not self.abilities.fly:
            return ()
        switch = self.conditions.switch
        return tuple(
            Exit(
                kind="fly",
                direction=None,
                event_id=None,
                destination=landing_target(landing, switch),
                vehicle="foot",
                ticks=FLY_TICKS,
                town=landing.name,
                square=(landing.region, landing.x, landing.y),
            )
            for landing in self.static.landings
            if landing.place.map_id in self.live.visited
            and (landing.switch is None or switch(landing.switch))
        )

    def can_fly(self, map_id: int, vehicle: Vehicle) -> bool:
        return vehicle in FLY_VEHICLES and map_id in self.static.outdoor and bool(self.flights)

    def flight_ticks(self, map_id: int, exit: Exit) -> int | None:
        region, x, y = self.static.squares.get(map_id, NO_TOWN_SQUARE)
        if exit.square is None or exit.square[0] != region:
            return None
        return exit.ticks + FLY_SQUARE_TICKS * (abs(exit.square[1] - x) + abs(exit.square[2] - y))

    def links(self) -> dict[int, set[int]]:
        found: dict[int, set[int]] = {}
        for map_id in self.static.ids:
            quiet = self.static.quiet_transfers(map_id)
            chosen = self.static.choice_transfers(map_id)
            if map_id != self.live.map_id and not quiet and not chosen:
                continue
            for spot in self.spots(map_id).values():
                destination = self.destination(map_id, spot)
                if destination is not None:
                    found.setdefault(map_id, set()).add(destination.map_id)
                for transfer in self.choices(map_id, spot):
                    found.setdefault(map_id, set()).add(transfer.place.map_id)
            for transfer in self.autoruns(map_id):
                found.setdefault(map_id, set()).add(transfer.place.map_id)
        return found

    def warps_to(self, map_id: int) -> dict[int, int]:
        inbound: dict[int, set[int]] = {}
        for source, targets in self.links().items():
            for target in targets:
                inbound.setdefault(target, set()).add(source)
        distance = {map_id: 0}
        queue = deque([map_id])
        while queue:
            here = queue.popleft()
            for source in inbound.get(here, ()):
                if source not in distance:
                    distance[source] = distance[here] + 1
                    queue.append(source)
        return distance


def flag_met(live: LiveWorld, flag: Flag) -> LiveWorld:
    if flag.kind == "self_switch":
        selves = {**live.self_switches, f"{flag.map_id}:{flag.id}:A": True}
        return live.model_copy(update={"self_switches": selves})
    field_name = "switches" if flag.kind == "switch" else "variables"
    values = list(getattr(live, field_name))
    values.extend([None] * (flag.id + 1 - len(values)))
    values[flag.id] = True if flag.kind == "switch" else flag.value
    return live.model_copy(update={field_name: values})


def live_spots(events: dict[int, MapEvent], live: LiveWorld) -> dict[int, Spot]:
    spots = {}
    for event in sorted(live.events.values(), key=lambda event: event.id):
        static = events.get(event.id)
        page = None
        if static is not None and not event.erased and event.page is not None:
            page = next((page for page in static.pages if page.number == event.page), None)
        spots[event.id] = Spot(
            id=event.id,
            name="" if static is None else static.name,
            x=event.x,
            y=event.y,
            width=event.width,
            height=event.height,
            page=page,
            through=event.through,
            character_name=event.character_name,
        )
    return spots


def loaded_page(
    map_id: int,
    event: MapEvent,
    conditions: Conditions,
    sets: dict[tuple[int, int], frozenset[str]],
) -> Page | None:
    temp: dict[str, bool] = {}
    page = conditions.active_page(map_id, event, temp)
    while page is not None and page.trigger in LOAD_TRIGGERS:
        letters = sets.get((event.id, page.number), frozenset())
        if all(temp.get(letter, False) for letter in letters):
            break
        temp.update(dict.fromkeys(letters, True))
        page = conditions.active_page(map_id, event, temp)
    return page


def static_spots(
    map_id: int,
    events: dict[int, MapEvent],
    conditions: Conditions,
    sets: dict[tuple[int, int], frozenset[str]],
) -> dict[int, Spot]:
    spots = {}
    for event in events.values():
        page = loaded_page(map_id, event, conditions, sets)
        width, height = event_size(event.name)
        spots[event.id] = Spot(
            id=event.id,
            name=event.name,
            x=event.x,
            y=event.y,
            width=width,
            height=height,
            page=page,
            through=True if page is None else page.through,
            character_name="" if page is None else page.character_name,
        )
    return spots


def over_trigger(grid: Grid, spot: Spot) -> bool:
    if spot.character_name and not spot.through:
        return False
    if HIDDEN_ITEM.search(spot.name):
        return False
    return any(grid.map_passable(*tile, LAND) for tile in spot.tiles)


def behind(tile: Tile, direction: int, distance: int = 1) -> Tile:
    dx, dy = STEPS[direction]
    return (tile[0] - dx * distance, tile[1] - dy * distance)


def facing_tiles(grid: Grid, spot: Spot) -> dict[Tile, int]:
    tiles = spot.tiles
    found: dict[Tile, int] = {}
    for tile in sorted(tiles):
        for direction in DIRECTIONS:
            source = behind(tile, direction)
            if source not in tiles and grid.valid(*source):
                found.setdefault(source, direction)
            across = behind(tile, direction, 2)
            if (
                source not in tiles
                and grid.valid(*source)
                and grid.counter(*source)
                and grid.valid(*across)
                and across not in tiles
            ):
                found.setdefault(across, direction)
    return found


def spot_exits(grid: Grid, spot: Spot, destination: Place) -> list[tuple[Tile, Exit]]:
    page = spot.page
    if page is None:
        return []
    over = over_trigger(grid, spot)
    if page.trigger == ACTION_TRIGGER:
        if over:
            return [(tile, Exit("press", None, spot.id, destination)) for tile in spot.tiles]
        return [
            (source, Exit("press", direction, spot.id, destination))
            for source, direction in facing_tiles(grid, spot).items()
        ]
    exits = []
    for tile in sorted(spot.tiles):
        for direction in DIRECTIONS:
            source = behind(tile, direction)
            if not grid.valid(*source):
                continue
            if over:
                if grid.open_step(*source, direction) and plain_step(grid, tile):
                    exits.append((source, Exit("step", direction, spot.id, destination)))
            elif source not in spot.tiles and not grid.open_step(*source, direction):
                exits.append((source, Exit("bump", direction, spot.id, destination)))
    return exits


def door_crossing(
    grid: Grid, doors: dict[Tile, int], start: Tile, direction: int
) -> tuple[Tile, ...]:
    dx, dy = STEPS[direction]
    tiles = [start]
    while tiles[-1] in doors:
        x, y = tiles[-1]
        if not grid.open_step(x, y, direction):
            break
        tiles.append((x + dx, y + dy))
    return tuple(tiles)


def door_prompts(opener: Opener) -> tuple[Prompt, ...]:
    if opener.question is None:
        return ()
    return (Prompt(opener.question, opener.options, opener.answer),)


def transfer_prompts(transfer: ChoiceTransfer) -> tuple[Prompt, ...]:
    return (
        *(Prompt(text, None) for text in transfer.before),
        Prompt(transfer.question, transfer.options, transfer.answer),
        *(Prompt(text, None) for text in transfer.after),
    )


def sight_tiles(grid: Grid, spot: Spot) -> frozenset[Tile]:
    page = spot.page
    named = COUNTER_EVENT.search(spot.name)
    if page is None or named is None or page.direction not in STEPS:
        return frozenset()
    distance = int(named.group(1))
    dx, dy = STEPS[page.direction]
    found = set()
    for tile in spot.tiles:
        for reach in range(1, distance + 1):
            seen = (tile[0] + dx * reach, tile[1] + dy * reach)
            if seen not in spot.tiles and grid.valid(*seen):
                found.add(seen)
    return frozenset(found)


def sight_exits(
    grid: Grid, spot: Spot, sight: frozenset[Tile], destination: Place
) -> list[tuple[Tile, Exit]]:
    exits = []
    for tile in sorted(sight):
        for direction in DIRECTIONS:
            source = behind(tile, direction)
            if source in sight or not grid.valid(*source):
                continue
            if grid.open_step(*source, direction) and plain_step(grid, tile):
                exits.append((source, Exit("step", direction, spot.id, destination)))
    return exits


def surf_prompts(live: LiveWorld) -> tuple[Prompt, ...]:
    if live.item_animation == NO_ITEM_ANIMATION:
        return ()
    return (Prompt(SURF_USED.format(live.player.name), None),)


def surf_exits(
    grid: Grid,
    water: Grid,
    spots: dict[int, Spot],
    touch: set[Tile],
    prompts: tuple[Prompt, ...],
) -> list[tuple[Tile, Exit]]:
    paged = {tile for spot in spots.values() if spot.page is not None for tile in spot.tiles}
    ticks = jump_ticks(1) + (SURF_MESSAGE_TICKS if prompts else 0)
    exits = []
    for y in range(grid.map.height):
        for x in range(grid.map.width):
            if grid.terrain_tag(x, y) not in SURF_START or (x, y) in touch:
                continue
            if not water.landable(x, y):
                continue
            for direction in DIRECTIONS:
                source = behind((x, y), direction)
                if not grid.valid(*source) or not grid.map_passable(*source, direction):
                    continue
                if pressed_tiles(grid, source, (x, y), direction) & paged:
                    continue
                place = Place(grid.map.id, x, y)
                exits.append((source, Exit("surf", direction, None, place, "surf", ticks, prompts)))
    return exits


def pressed_tiles(grid: Grid, source: Tile, facing: Tile, direction: int) -> set[Tile]:
    pressed = {source, facing}
    if grid.counter(*facing):
        pressed.add(behind(source, direction, -2))
    return pressed


def climb_prompts(live: LiveWorld) -> tuple[Prompt, ...]:
    if live.item_animation == NO_ITEM_ANIMATION:
        return ()
    return (Prompt(CLIMB_USED.format(live.player.name), None),)


def climb_path(grid: Grid, start: Tile, direction: int) -> tuple[tuple[Tile, ...], Tile] | None:
    dx, dy = STEPS[direction]
    x, y = start
    tiles = [start]
    while True:
        ahead = [(x, y + dy)] if dy else [(x + dx, y), (x + dx, y - 1), (x + dx, y + 1)]
        near = next(
            (tile for tile in ahead if grid.valid(*tile) and grid.terrain_tag(*tile) == ROCK_CLIMB),
            None,
        )
        if near is None:
            break
        x, y = near
        tiles.append(near)
    landing = (x + dx, y + dy)
    if not grid.valid(*landing):
        return None
    return tuple(tiles), landing


def climb_exits(
    grid: Grid,
    sliding: Grid,
    spots: dict[int, Spot],
    touch: set[Tile],
    warp_tiles: set[Tile],
    prompts: tuple[Prompt, ...],
) -> list[tuple[Tile, Exit]]:
    paged = {tile for spot in spots.values() if spot.page is not None for tile in spot.tiles}
    shown = CLIMB_MESSAGE_TICKS if prompts else 0
    exits = []
    for y in range(grid.map.height):
        for x in range(grid.map.width):
            if grid.terrain_tag(x, y) != ROCK_CLIMB:
                continue
            for direction in DIRECTIONS:
                source = behind((x, y), direction)
                if not grid.valid(*source):
                    continue
                if pressed_tiles(grid, source, (x, y), direction) & paged:
                    continue
                path = climb_path(grid, (x, y), direction)
                if path is None:
                    continue
                tiles, landing = path
                slid = slide(sliding, landing, direction)
                if slid is None:
                    continue
                end = slid[-1] if slid else landing
                if grid.terrain_tag(*end) == ROCK_CLIMB:
                    continue
                ticks = shown + CLIMB_TICKS + (len(tiles) - 1) * CLIMB_STEP_TICKS
                if slid:
                    ticks += SLIDE_START_TICKS + len(slid) * step_ticks(ICE_SPEED)
                passed = (*tiles, landing, *slid)
                if warp_tiles.intersection(passed):
                    continue
                touched = sum(tile in touch for tile in passed)
                place = Place(grid.map.id, *end)
                exit = Exit(
                    "climb", direction, None, place, "foot", ticks, prompts, touched, passed=passed
                )
                exits.append((source, exit))
    return exits


def plain_step(grid: Grid, tile: Tile) -> bool:
    tag = grid.terrain_tag(*tile)
    if tag in (LEDGE, ICE):
        return False
    return not grid.player.surfing or tag in PASSABLE_WATER


type Node = tuple[int, int, int, Vehicle]


@dataclass(frozen=True)
class Goal:
    map_id: int
    tiles: dict[Tile, int | None] | None
    event_id: int | None = None

    def reached(self, map_id: int, tile: Tile) -> bool:
        return map_id == self.map_id and (self.tiles is None or tile in self.tiles)

    def sought(self, map_id: int, area: Area, tile: Tile) -> bool:
        if map_id != self.map_id:
            return False
        return (self.tiles is not None and tile in self.tiles) or (
            self.event_id is not None and area.scenes.get(tile) == self.event_id
        )


@dataclass(frozen=True)
class Leg:
    map_id: int
    moves: tuple[Move, ...]
    exit: Exit | None

    @property
    def ticks(self) -> int:
        return sum(move.ticks for move in self.moves)


@dataclass(frozen=True)
class Plan:
    legs: tuple[Leg, ...]
    ticks: int
    facing: int | None


def exit_ticks(area: Area, pace: Pace, tile: Tile, exit: Exit) -> int:
    answers = len(exit.prompts) * ANSWER_TICKS
    if exit.kind == "step":
        speed = pace.speed(area.grid.terrain_tag(*tile))
        return STEP_START_TICKS + step_ticks(speed) + WARP_TICKS + answers
    if exit.kind == "bump":
        return BUMP_TICKS + WARP_TICKS + answers
    if exit.kind in ("surf", "climb"):
        return TURN_TICKS + PRESS_TICKS + exit.ticks + exit.touches * TOUCH_PENALTY_TICKS
    if exit.kind in ("fly", "lens"):
        return exit.ticks
    if exit.kind == "open":
        steps = sum(step_ticks(pace.speed(area.grid.terrain_tag(*tile))) for tile in exit.passed)
        landed = (exit.destination.x, exit.destination.y) in exit.passed[-1:]
        warp = 0 if landed else WARP_TICKS
        return TURN_TICKS + PRESS_TICKS + answers + STEP_START_TICKS + steps + warp
    return TURN_TICKS + PRESS_TICKS + answers + WARP_TICKS


def search(
    atlas: Atlas,
    pace: Pace,
    start: Node,
    goal: Goal,
    warps_to: dict[int, int],
    blocked: set[tuple[int, int, int, int]],
) -> Plan | None:
    goal_tiles = list(goal.tiles or ())
    flights = [exit for exit in atlas.flights if exit.destination.map_id in warps_to]
    flight_floor = min(
        (FLY_TICKS + warps_to[exit.destination.map_id] * WARP_TICKS for exit in flights),
        default=None,
    )
    flown: set[int] = set()

    def estimate(node: Node) -> int:
        warps = warps_to.get(node[0])
        if warps is None:
            return flight_floor or 0
        walked = warps * WARP_TICKS
        if node[0] == goal.map_id and goal_tiles:
            walked += pace.fastest_tile * min(
                abs(node[1] - x) + abs(node[2] - y) for x, y in goal_tiles
            )
        return walked if flight_floor is None else min(walked, flight_floor)

    order = count()
    frontier = [(estimate(start), next(order), 0, start)]
    cost = {start: 0}
    came: dict[Node, tuple[Node, Move | Exit]] = {}
    while frontier:
        _, _, spent, node = heapq.heappop(frontier)
        if spent > cost[node]:
            continue
        map_id, x, y, vehicle = node
        if goal.reached(map_id, (x, y)):
            return plan_to(came, start, node, spent, goal)
        area = atlas.area(map_id, vehicle)
        paced = pace.on(vehicle)
        on_goal_map = map_id == goal.map_id and goal.tiles is not None
        edges: list[tuple[Node, Move | Exit, int]] = []
        for direction in DIRECTIONS:
            if (map_id, x, y, direction) in blocked:
                continue
            move = move_toward(area.grid, paced, x, y, direction, area.stairs, area.pushes)
            if move is None:
                continue
            passed = [
                tile for tile in move.tiles if not (on_goal_map and goal.reached(map_id, tile))
            ]
            if any(tile in area.warp_tiles for tile in passed):
                continue
            if atlas.story and story_stop(area, goal, map_id, move):
                continue
            touched = [tile for tile in passed if tile in area.touch and tile not in area.pushes]
            penalty = len(touched) * TOUCH_PENALTY_TICKS
            after = move.vehicle or vehicle
            edges.append(((map_id, *move.end, after), move, move.ticks + penalty))
        for exit in area.exits.get((x, y), ()):
            place = exit.destination
            if place.map_id not in warps_to:
                continue
            after = exit.vehicle or ("foot" if vehicle == "lens" else vehicle)
            edges.append(
                (
                    (place.map_id, place.x, place.y, after),
                    exit,
                    exit_ticks(area, paced, (x, y), exit),
                )
            )
        if (map_id not in flown or on_goal_map) and atlas.can_fly(map_id, vehicle):
            flown.add(map_id)
            for exit in flights:
                flight = atlas.flight_ticks(map_id, exit)
                if flight is None:
                    continue
                place = exit.destination
                edges.append(((place.map_id, place.x, place.y, "foot"), exit, flight))
        for end, edge, ticks in edges:
            total = spent + ticks
            if total < cost.get(end, total + 1):
                cost[end] = total
                came[end] = (node, edge)
                heapq.heappush(frontier, (total + estimate(end), next(order), total, end))
    return None


def story_stop(area: Area, goal: Goal, map_id: int, move: Move) -> bool:
    crossed = (*move.tiles, *move.passing)
    if any(tile in area.closed for tile in crossed):
        return True
    return any(tile in area.scenes and not goal.sought(map_id, area, tile) for tile in crossed)


def plan_to(
    came: dict[Node, tuple[Node, Move | Exit]], start: Node, end: Node, ticks: int, goal: Goal
) -> Plan:
    edges: list[Move | Exit] = []
    node = end
    while node != start:
        node, edge = came[node]
        edges.append(edge)
    edges.reverse()
    legs = []
    map_id = start[0]
    moves: list[Move] = []
    for edge in edges:
        if isinstance(edge, Move):
            moves.append(edge)
            continue
        legs.append(Leg(map_id, tuple(moves), edge))
        map_id = edge.destination.map_id
        moves = []
    legs.append(Leg(map_id, tuple(moves), None))
    facing = None if goal.tiles is None else goal.tiles.get((end[1], end[2]))
    return Plan(tuple(legs), ticks, facing)


@dataclass(frozen=True)
class Target:
    map_id: int
    tile: Tile | None = None
    event_id: int | None = None
    touch: bool = False

    def __str__(self) -> str:
        if self.tile is not None:
            return f"map {self.map_id} ({self.tile[0]}, {self.tile[1]})"
        if self.event_id is not None:
            return f"map {self.map_id} event {self.event_id}"
        return f"map {self.map_id}"


def goal_for(atlas: Atlas, target: Target) -> Goal | str:
    if target.map_id not in atlas.static.ids:
        return f"there is no map {target.map_id}"
    if target.tile is not None:
        grid = atlas.area(target.map_id, "foot").grid
        if not grid.valid(*target.tile):
            return f"{target.tile} is outside map {target.map_id}"
        return Goal(target.map_id, {target.tile: None})
    if target.event_id is None:
        return Goal(target.map_id, None)
    spot = atlas.spots(target.map_id).get(target.event_id)
    if spot is None:
        return f"map {target.map_id} has no event {target.event_id}"
    if spot.page is None:
        return f"event {target.event_id} on map {target.map_id} has no active page"
    grid = atlas.area(target.map_id, "foot").grid
    if spot.page.trigger == ACTION_TRIGGER and over_trigger(grid, spot):
        return Goal(target.map_id, dict.fromkeys(spot.tiles), target.event_id)
    return Goal(target.map_id, dict(facing_tiles(grid, spot)), target.event_id)


@dataclass(frozen=True)
class Reached:
    pass


@dataclass(frozen=True)
class Blocked:
    x: int
    y: int
    direction: int


@dataclass(frozen=True)
class Strayed:
    pass


@dataclass(frozen=True)
class Interrupted:
    context: Context


type SegmentEnd = Reached | Blocked | Strayed | Interrupted


@dataclass
class Walker:
    driver: Driver
    map_id: int
    position: tuple[int, int, int]
    moving: bool
    tick: int
    overworld: str | None = None
    passing: dict[str, Context] = field(default_factory=dict)
    running: bool = False
    pressed: bool = False
    steps: int = 0

    def advance(
        self,
        direction: int | None,
        until: list[StopCondition],
        limit: int,
        run: bool,
        use: bool = False,
    ) -> AdvanceResult:
        names = [BUTTONS[direction]] if direction is not None else []
        if run:
            names.append(RUN_BUTTON)
        if use:
            names.append(USE_BUTTON)
        self.pressed = run or use
        step = self.driver.advance_driven(limit, [buttons(*names)], repeat=True, until=until)
        result = step.value
        self.tick = step.tick
        self.moving = bool(result.moving)
        if result.position is not None:
            self.position = result.position
        return result

    def context(self, result: AdvanceResult, force: bool = False) -> Context | None:
        signature = result.signature
        if signature == self.overworld and not force:
            return None
        if signature in self.passing:
            return self.passing[signature]
        context = read_context(self.driver.session).value
        if context.name == OVERWORLD:
            self.overworld = signature
            return None
        if context.name == TRANSITION:
            self.passing[signature] = context
        return context

    def release_buttons(self) -> None:
        if self.moving:
            self.advance(None, ["moving"], STILL_LIMIT_TICKS, run=False)
        elif self.pressed:
            self.advance(None, [], 1, run=False)

    def walk(self, route: tuple[Move, ...], run: bool, quiet_tiles: frozenset[Tile]) -> SegmentEnd:
        def passes(context: Context) -> bool:
            return context.name == TRANSITION or (
                context.name == EVENT and self.tile in quiet_tiles
            )

        expected = [(move.direction, tile) for move in route for tile in move.tiles]
        passing = [
            move.passing if tile == move.end else () for move in route for tile in move.tiles
        ]
        landings = [move.stair and tile == move.end for move in route for tile in move.tiles]
        here = self.tile
        index = retries = transitions = 0
        waiting = quiet = lingered = False
        while True:
            settling = index >= len(expected)
            direction = None if waiting or quiet or settling else expected[index][0]
            until: list[StopCondition] = ["position", "signature"]
            if settling and self.moving:
                until.append("moving")
            limit = RETRY_WAIT_TICKS if waiting else STEP_LIMIT_TICKS
            if settling and not self.moving:
                limit = 1
            result = self.advance(direction, until, limit, run=run and not (settling or quiet))
            waiting = False
            landed = {
                expected[near][1]
                for near in (index - 1, index)
                if 0 <= near < len(expected) and landings[near]
            }
            context = self.context(result)
            if self.landing(context, landed):
                context = None
            if context is not None and not passes(context):
                if (
                    self.position[0] == self.map_id
                    and self.tile != here
                    and index < len(expected)
                    and self.tile == expected[index][1]
                ):
                    self.steps += 1
                return Interrupted(context)
            if context is None and quiet:
                return Strayed()
            quiet = quiet or context is not None
            if self.position[0] != self.map_id:
                moved = context or self.forced(result)
                return Strayed() if moved is None else Interrupted(moved)
            if self.tile != here:
                here = self.tile
                if index < len(expected) and here == expected[index][1]:
                    index += 1
                    self.steps += 1
                    retries = transitions = 0
                    continue
                if index < len(expected) and here in passing[index]:
                    retries = transitions = 0
                    continue
                log.info("left the route at %s on tick %d; replanning", here, self.tick)
                return Strayed()
            if context is not None:
                transitions += 1
                if transitions > TRANSITION_STOPS:
                    return Interrupted(context)
                continue
            if settling:
                if self.moving:
                    continue
                final = self.forced(result)
                if self.landing(final, landed):
                    continue
                if final is None and not lingered:
                    lingered = True
                    result = self.advance(None, [], EVENT_START_TICKS, run=False)
                    final = self.forced(result)
                if self.landing(final, landed):
                    continue
                if final is None:
                    return Strayed() if quiet else Reached()
                if not passes(final):
                    return Interrupted(final)
                quiet = True
                continue
            if result.stopped != "ticks":
                continue
            stopped = self.forced(result)
            if stopped is not None and not passes(stopped):
                return Interrupted(stopped)
            if stopped is not None:
                quiet = True
            if direction is None:
                continue
            retries += 1
            if retries > BLOCKED_RETRIES:
                return Blocked(*here, direction)
            log.info(
                "step %s from %s blocked on tick %d; waiting",
                DIRECTIONS[direction],
                here,
                self.tick,
            )
            waiting = True

    def landing(self, context: Context | None, landed: set[Tile]) -> bool:
        return context is not None and context.name == TRANSITION and self.tile in landed

    def face(self, direction: int, facing: int) -> None:
        if facing != direction:
            self.advance(direction, [], TURN_TICKS, run=False)

    def press(self) -> AdvanceResult:
        self.pressed = False
        step = self.driver.advance_driven(
            PRESS_LIMIT_TICKS,
            [buttons(USE_BUTTON), buttons()],
            repeat=True,
            until=["signature"],
        )
        result = step.value
        self.tick = step.tick
        self.moving = bool(result.moving)
        if result.position is not None:
            self.position = result.position
        return result

    def use_exit(self, exit: Exit, facing: int) -> SegmentEnd:
        origin = self.position
        if exit.kind == "open":
            assert exit.direction is not None
            opened = self.open_by_talk(exit.direction, facing, exit.prompts)
            if isinstance(opened, Reached):
                log.info("opened event %s on tick %d", exit.event_id, self.tick)
            return opened
        if exit.direction is not None:
            self.face(exit.direction, facing)
        self.advance(None, [], PRESS_TICKS, run=False, use=True)
        log.info(
            "%s from %s on tick %d toward %s",
            exit.kind,
            origin,
            self.tick,
            (exit.destination.x, exit.destination.y),
        )
        if exit.prompts:
            talked = self.converse(exit.prompts)
            if talked is not None:
                return talked
        return self.wait_until_at(exit.destination, climbing=exit.kind == "climb")

    def open_by_talk(self, direction: int, facing: int, prompts: tuple[Prompt, ...]) -> SegmentEnd:
        self.face(direction, facing)
        self.advance(None, [], PRESS_TICKS, run=False, use=True)
        talked = self.talk_through(prompts[0] if prompts else None)
        if talked is not None:
            return talked
        context = self.settle()
        if context.name != OVERWORLD:
            return Interrupted(context)
        return Reached()

    def talk_through(self, question: Prompt | None) -> Strayed | Interrupted | None:
        filler = Filler(self.driver.session)
        asked = None if question is None else filler.text(question.text)
        started = False
        quiet = 0
        for _ in range(TALK_STOPS):
            context = read_context(self.driver.session).value
            if context.name in (MESSAGE, CHOICE):
                started = True
                quiet = 0
                text = payload_field(context, MESSAGE, "text")
                shown = filler.text(text) if isinstance(text, str) else text
                asking = question is not None and asked is not None and same_text(asked, shown)
                if context.name == CHOICE:
                    options = payload_field(context, CHOICE, "options")
                    if question is None or not asking or tuple(options or ()) != question.options:
                        return Interrupted(context)
                    if not self.point(question.answer, len(question.options)):
                        return Interrupted(read_context(self.driver.session).value)
                    log.info("answering %r on tick %d", text, self.tick)
                elif asking:
                    self.advance(None, ["signature"], PRESS_LIMIT_TICKS, run=False)
                    continue
                self.press()
                continue
            if context.name not in (OVERWORLD, EVENT, TRANSITION):
                return Interrupted(context)
            result = self.advance(
                None, ["signature", "position", "moving"], DIALOG_POLL_TICKS, run=False
            )
            if context.name != OVERWORLD:
                quiet = 0
                continue
            quiet += result.ticks
            if quiet >= DIALOG_START_LIMIT_TICKS:
                return None if started else Strayed()
        return Interrupted(read_context(self.driver.session).value)

    def converse(self, prompts: tuple[Prompt, ...]) -> Strayed | Interrupted | None:
        filler = Filler(self.driver.session)
        texts = [filler.text(prompt.text) for prompt in prompts]
        last = max(
            (number for number, prompt in enumerate(prompts) if prompt.options is not None),
            default=len(prompts) - 1,
        )
        index = 0
        finished = False
        quiet = 0
        for _ in range(DIALOG_STOPS):
            context = read_context(self.driver.session).value
            if context.name not in (MESSAGE, CHOICE):
                if finished:
                    return None
                if context.name not in (OVERWORLD, EVENT, TRANSITION):
                    return Interrupted(context)
                result = self.advance(
                    None, ["signature", "position", "moving"], DIALOG_POLL_TICKS, run=False
                )
                if context.name == OVERWORLD and index == 0:
                    quiet += result.ticks
                    if quiet >= DIALOG_START_LIMIT_TICKS:
                        return Strayed()
                continue
            text = payload_field(context, MESSAGE, "text")
            shown = filler.text(text) if isinstance(text, str) else text
            match = next(
                (
                    number
                    for number in range(index, len(prompts))
                    if same_text(texts[number], shown)
                ),
                None,
            )
            if match is None:
                return Interrupted(context)
            index = match
            prompt = prompts[index]
            if context.name == CHOICE:
                options = payload_field(context, CHOICE, "options")
                if prompt.options is None or tuple(options or ()) != prompt.options:
                    return Interrupted(context)
                if not self.point(prompt.answer, len(prompt.options)):
                    return Interrupted(read_context(self.driver.session).value)
            elif prompt.options is not None:
                self.advance(None, ["signature"], PRESS_LIMIT_TICKS, run=False)
                continue
            log.info("answering %r on tick %d", text, self.tick)
            self.press()
            finished = index >= last
        context = read_context(self.driver.session).value
        return Interrupted(context)

    def point(self, target: int, rows: int) -> bool:
        for _ in range(CURSOR_STOPS * (rows + 1)):
            context = read_context(self.driver.session).value
            if context.name != CHOICE:
                return False
            cursor = payload_field(context, CHOICE, "cursor")
            if cursor == target:
                return True
            if cursor is None:
                self.advance(None, [], 1, run=False)
                continue
            key = BUTTONS[2] if target > cursor else BUTTONS[8]
            step = self.driver.advance_driven(CURSOR_PRESS_TICKS, [buttons(key), buttons()])
            self.tick = step.tick
        return False

    def wait_until_at(self, destination: Place, climbing: bool = False) -> SegmentEnd:
        quiet = 0
        context: Context | None = None
        for _ in range(WARP_STOPS):
            before = self.position
            result = self.advance(
                None, ["position", "signature", "moving"], WARP_POLL_TICKS, run=False
            )
            context = read_context(self.driver.session).value
            if context.name in (TRANSITION, EVENT):
                quiet = 0
                continue
            if context.name != OVERWORLD:
                return Interrupted(context)
            if self.position != before:
                quiet = 0
            if self.moving:
                continue
            if self.position == (destination.map_id, destination.x, destination.y):
                if climbing and read_rock_climbing(self.driver.session):
                    continue
                self.overworld = result.signature
                log.info("settled at %s on tick %d", self.tile, self.tick)
                return Reached()
            if self.position != before:
                continue
            quiet += result.ticks
            if quiet >= ARRIVAL_QUIET_TICKS:
                return Strayed()
        assert context is not None
        return Interrupted(context)

    def take_exit(self, exit: Exit, facing: int) -> SegmentEnd:
        origin = self.position
        if exit.kind not in WARP_KINDS:
            return self.use_exit(exit, facing)
        started = False
        if exit.kind == "press":
            if exit.direction is not None:
                self.face(exit.direction, facing)
            self.advance(None, [], PRESS_TICKS, run=False, use=True)
            if exit.prompts:
                talked = self.converse(exit.prompts)
                if talked is not None:
                    return talked
        elif exit.kind == "bump":
            assert exit.direction is not None
            started = self.bump(exit.direction)
        else:
            assert exit.direction is not None
            result = self.advance(
                exit.direction, ["position", "signature"], STEP_LIMIT_TICKS, run=False
            )
            if result.stopped == "ticks" and self.position == origin:
                return Blocked(origin[1], origin[2], exit.direction)
        if exit.kind != "press" and exit.prompts:
            talked = self.converse(exit.prompts)
            if talked is not None:
                return talked
            started = True
        log.info(
            "%s event %s from %s on tick %d toward map %d",
            exit.kind,
            exit.event_id,
            origin,
            self.tick,
            exit.destination.map_id,
        )
        return self.cross(origin, exit.destination, started)

    def bump(self, direction: int) -> bool:
        for _ in range(BUMP_LIMIT_TICKS):
            result = self.advance(direction, ["position", "signature"], 1, run=False)
            if result.stopped != "ticks":
                return False
            if read_context(self.driver.session).value.name != OVERWORLD:
                return True
        return False

    def settle(self) -> Context:
        context = read_context(self.driver.session).value
        for _ in range(WARP_STOPS):
            if context.name not in (TRANSITION, EVENT):
                break
            self.advance(None, ["signature"], WARP_POLL_TICKS, run=False)
            context = read_context(self.driver.session).value
        return context

    def touch(self, direction: int) -> SegmentEnd:
        log.info("touching %s from %s on tick %d", DIRECTIONS[direction], self.tile, self.tick)
        if not self.bump(direction):
            return Strayed()
        context = self.settle()
        if context.name == OVERWORLD:
            return Reached()
        return Interrupted(context)

    def cross(self, origin: tuple[int, int, int], destination: Place, seen: bool) -> SegmentEnd:
        quiet = 0
        context: Context | None = None
        for _ in range(WARP_STOPS):
            result = self.advance(
                None, ["position", "signature", "moving"], WARP_POLL_TICKS, run=False
            )
            context = read_context(self.driver.session).value
            if context.name in (TRANSITION, EVENT):
                seen = True
                quiet = 0
                continue
            if context.name != OVERWORLD:
                return Interrupted(context)
            if self.moving:
                continue
            arrived = self.position == (destination.map_id, destination.x, destination.y)
            if self.position[0] != origin[0] or (seen and arrived):
                self.overworld = result.signature
                log.info(
                    "settled on map %d at %s on tick %d", self.position[0], self.tile, self.tick
                )
                return Reached()
            if seen:
                return Strayed()
            quiet += result.ticks
            if quiet >= WARP_START_LIMIT_TICKS:
                return Strayed()
        assert context is not None
        return Interrupted(context)

    def forced(self, result: AdvanceResult) -> Context | None:
        return self.context(result, force=True)

    @property
    def tile(self) -> Tile:
        return (self.position[1], self.position[2])


def payload_field(context: Context, kind: str, name: str) -> Any:
    for payload in reversed(context.payloads):
        if payload.get("kind") == kind:
            return payload.get(name)
    return None


@dataclass(frozen=True)
class GoResult:
    outcome: Outcome
    target: Target
    started: int
    tick: int
    position: tuple[int, int, int] | None
    reason: str
    context: Context | None
    route: Plan | None
    steps: int
    warps: int
    replans: int
    flights: int = 0


def go(
    driver: Driver, connection: sqlite3.Connection, target: Target, report: Callable[[str], None]
) -> GoResult:
    session = driver.session
    static = Static(connection)
    start = read_context(session)
    note(session, "target", **target_fields(target))
    if start.value.name != OVERWORLD:
        return recorded(
            session,
            GoResult(
                outcome="refused",
                target=target,
                started=start.tick,
                tick=start.tick,
                position=None,
                reason=f"the game is in {start.value.name}, not the overworld",
                context=start.value,
                route=None,
                steps=0,
                warps=0,
                replans=0,
            ),
        )
    live = live_world(session, connection)
    position = (live.map_id, live.player.x, live.player.y)
    walker = Walker(driver, live.map_id, position, live.player.moving, live.tick)
    first: Plan | None = None
    replans = -1
    warps = 0
    flights = 0

    def end(outcome: Outcome, reason: str, context: Context | None = None) -> GoResult:
        return recorded(
            session,
            GoResult(
                outcome=outcome,
                target=target,
                started=start.tick,
                tick=walker.tick,
                position=walker.position,
                reason=reason,
                context=context,
                route=first,
                steps=walker.steps,
                warps=warps,
                replans=max(replans, 0),
                flights=flights,
            ),
        )

    blocked: set[tuple[int, int, int, int]] = set()
    best: int | None = None
    stale = 0
    talked: set[str] = set()
    opening: Gate | None = None
    while True:
        replans += 1
        if walker.moving:
            walker.release_buttons()
        now = read_context(session)
        if target.touch and now.value.name in (TRANSITION, EVENT):
            walker.settle()
            now = read_context(session)
        if now.value.name != OVERWORLD:
            return end("interrupted", f"{now.value.name} at tick {now.tick}", now.value)
        live = live_world(session, connection)
        walker.map_id = live.map_id
        walker.position = (live.map_id, live.player.x, live.player.y)
        here: Node = (*walker.position, vehicle_of(live))
        abilities = abilities_of(live)
        atlas = Atlas(static, live, abilities)
        goal = goal_for(atlas, target)
        if isinstance(goal, str):
            return end("unreachable", goal)
        if goal.tiles is None and goal.reached(live.map_id, walker.tile):
            return end("arrived", f"on map {live.map_id} at {walker.tile}")
        warps_to = atlas.warps_to(goal.map_id)
        flying = any(exit.destination.map_id in warps_to for exit in atlas.flights)
        if live.map_id not in warps_to and not flying:
            missing = missing_edges(static, live, abilities, here, goal)
            return end("unreachable", no_route_text(here, target, goal, missing, warpless=True))
        holding = runs_by_holding(live)
        pace = pace_for(live, holding)
        if opening is not None and atlas.conditions.met(opening.opens):
            opening = None
        route = None
        if opening is None:
            route = search(atlas, pace, here, goal, warps_to, blocked)
            opening = None if route is not None else detour(atlas, here, goal)
        talk = None if opening is None else atlas.talk_goal(opening)
        if opening is not None and talk is not None:
            route = search(atlas, pace, here, talk, atlas.warps_to(talk.map_id), blocked)
            if route is not None:
                goal = talk
                log.info("on the way to talk to %s", opening.name)
        if route is None:
            opening = None
            if blocked and search(atlas, pace, here, goal, warps_to, set()):
                return end("stuck", f"steps blocked at {sorted(blocked)} on every route left")
            missing = missing_edges(static, live, abilities, here, goal)
            return end("unreachable", no_route_text(here, target, goal, missing, warpless=False))
        running = runs(live)
        if first is None:
            first = route
            report(route_text(route, running))
        else:
            log.info("replanned from %s: %s", here, route_text(route, running))
        note(session, "route", **route_fields(route, running, replans))
        if best is None or route.ticks < best:
            best = route.ticks
            stale = 0
        else:
            stale += 1
            if stale > STALE_REPLANS:
                return end("stuck", f"{stale} replans from {here} made no progress")
        leg = route.legs[0]
        facing = live.player.direction
        if leg.moves:
            segment = walker.walk(leg.moves, holding, atlas.area(here[0], here[3]).quiet)
            if isinstance(segment, Interrupted):
                if walker.pressed:
                    walker.release_buttons()
                return end(
                    "interrupted", f"{segment.context.name} at tick {walker.tick}", segment.context
                )
            if isinstance(segment, Blocked) and lens_ran_out(atlas, here, segment):
                log.info(
                    "step %s from (%d, %d) blocked by a hidden event; the lens ran out",
                    DIRECTIONS[segment.direction],
                    segment.x,
                    segment.y,
                )
            elif isinstance(segment, Blocked):
                log.info(
                    "step %s from (%d, %d) stayed blocked; marking it",
                    DIRECTIONS[segment.direction],
                    segment.x,
                    segment.y,
                )
                blocked.add((live.map_id, segment.x, segment.y, segment.direction))
            walker.release_buttons()
            if not isinstance(segment, Reached) or walker.tile != leg.moves[-1].end:
                continue
            facing = leg.moves[-1].direction
        elif walker.pressed:
            walker.release_buttons()
        if leg.exit is not None and leg.exit.kind == "fly":
            flown = fly(driver, connection, leg.exit.town or "", report)
            walker.tick = flown.tick
            if flown.outcome != "finished":
                return end(
                    "interrupted" if flown.context.name != OVERWORLD else "stuck",
                    f"flying to {leg.exit.town} ended {flown.outcome}: {flown.reason}",
                    flown.context,
                )
            flights += 1
            continue
        if leg.exit is not None and leg.exit.kind == "lens":
            used = use_lens(driver, report)
            walker.tick = used.tick
            if used.outcome != "finished":
                return end(
                    "interrupted" if used.context.name != OVERWORLD else "stuck",
                    f"using the Lente de la Verdad ended {used.outcome}: {used.reason}",
                    used.context,
                )
            continue
        if leg.exit is not None:
            crossed = walker.take_exit(leg.exit, facing)
            if isinstance(crossed, Interrupted):
                return end(
                    "interrupted", f"{crossed.context.name} at tick {walker.tick}", crossed.context
                )
            if isinstance(crossed, Blocked):
                blocked.add((live.map_id, crossed.x, crossed.y, crossed.direction))
            if isinstance(crossed, Reached) and leg.exit.kind in WARP_KINDS:
                warps += 1
            continue
        if route.facing is not None:
            walker.face(route.facing, facing)
        arrived = live_world(session, connection)
        walker.position = (arrived.map_id, arrived.player.x, arrived.player.y)
        if not goal.reached(arrived.map_id, walker.tile):
            continue
        if route.facing is not None and arrived.player.direction != route.facing:
            return end(
                "stuck",
                f"at {walker.tile} but facing {DIRECTIONS[arrived.player.direction]}, "
                f"not {DIRECTIONS[route.facing]}",
            )
        if opening is not None and opening.opener is not None and route.facing is not None:
            if opening.name in talked:
                return end("stuck", f"talked to {opening.name!r} and it stayed closed")
            talked.add(opening.name)
            prompts = door_prompts(opening.opener)
            opened = walker.open_by_talk(route.facing, route.facing, prompts)
            if isinstance(opened, Interrupted):
                return end(
                    "interrupted", f"{opened.context.name} at tick {walker.tick}", opened.context
                )
            log.info("talked to %s on tick %d", opening.name, walker.tick)
            best = None
            stale = 0
            continue
        if target.touch and route.facing is not None:
            touched = walker.touch(route.facing)
            if isinstance(touched, Interrupted):
                return end(
                    "interrupted", f"{touched.context.name} at tick {walker.tick}", touched.context
                )
            if isinstance(touched, Reached):
                return end(
                    "arrived",
                    f"touched event {target.event_id} from map {arrived.map_id} {walker.tile}, "
                    "and it started nothing",
                )
            continue
        where = f"on map {arrived.map_id} at {walker.tile}"
        if route.facing is not None:
            where += f" facing {DIRECTIONS[route.facing]}"
        return end("arrived", where)


def lens_ran_out(atlas: Atlas, here: Node, blocked: Blocked) -> bool:
    dx, dy = STEPS[blocked.direction]
    ahead = (blocked.x + dx, blocked.y + dy)
    return here[3] == "lens" and ahead in atlas.hidden_tiles(here[0])


def recorded(session: Session, result: GoResult) -> GoResult:
    note(session, "result", **result_fields(result))
    return result


def note(session: Session, stage: str, **fields: Any) -> None:
    reply = session.call("note", kind=NAV_KIND, entry={"stage": stage, **fields})
    if not NoteResult.model_validate(reply.result).recorded:
        log.info("the session keeps no record; the %s %s entry was dropped", NAV_KIND, stage)


def target_fields(target: Target) -> dict[str, Any]:
    return {
        "target": str(target),
        "map": target.map_id,
        "tile": None if target.tile is None else list(target.tile),
        "event_id": target.event_id,
        "touch": target.touch,
    }


def route_fields(route: Plan, running: bool, replan: int) -> dict[str, Any]:
    return {
        "replan": replan,
        "ticks": route.ticks,
        "running": running,
        "facing": None if route.facing is None else DIRECTIONS[route.facing],
        "legs": [
            {
                "map": leg.map_id,
                "path": [list(tile) for move in leg.moves for tile in move.tiles],
                "exit": None if leg.exit is None else exit_text(leg.exit),
            }
            for leg in route.legs
        ],
        "text": route_text(route, running),
    }


def result_fields(result: GoResult) -> dict[str, Any]:
    return {
        "outcome": result.outcome,
        "reason": result.reason,
        "position": None if result.position is None else list(result.position),
        "steps": result.steps,
        "warps": result.warps,
        "replans": result.replans,
        "flights": result.flights,
        "ticks": result.tick - result.started,
        "context": None if result.context is None else result.context.name,
    }


def missing_edges(
    static: Static,
    live: LiveWorld,
    abilities: Abilities,
    here: Node,
    goal: Goal,
) -> list[str]:
    pace = pace_for(live, False)
    held = Atlas(static, live, abilities)
    route = staged(Atlas(static, live, abilities, story=False), pace, here, goal)
    if route is not None:
        return story_blocks(held, route, goal)
    for each, story, felled in STAGES:
        found = abilities if each is None else each
        route = staged(Atlas(static, live, found, story=story, felled=felled), pace, here, goal)
        if route is not None:
            break
    if route is None:
        return []
    missing = story_blocks(held, route, goal) + tree_blocks(held, route)
    kinds = {leg.exit.kind for leg in route.legs if leg.exit is not None}
    if "surf" in kinds and not abilities.surf:
        missing.append(f"Surf ({SURF_ITEM}; has {live.key_items.get(SURF_ITEM, 0)})")
    if "climb" in kinds and not abilities.climb:
        missing.append(f"Rock Climb ({CLIMB_ITEM}; has {live.key_items.get(CLIMB_ITEM, 0)})")
    if "lens" in kinds and not abilities.lens:
        missing.append(
            f"the Lente de la Verdad ({LENS_ITEM}; has {live.key_items.get(LENS_ITEM, 0)})"
        )
    if "fly" in kinds and not abilities.fly:
        held = live.key_items.get(FLY_ITEM, 0)
        why = "a partner is following" if held else f"has {held}"
        missing.append(f"flying with the PokéRider ({FLY_ITEM}; {why})")
    for leg in route.legs:
        if leg.exit is None or abilities.holds(leg.exit.items):
            continue
        for item in leg.exit.items:
            if abilities.holds((item,)):
                continue
            text = f"{item} for event {leg.exit.event_id} on map {leg.map_id} (has "
            text += f"{live.key_items.get(item, 0)})"
            if text not in missing:
                missing.append(text)
    return missing


STAGES: tuple[tuple[Abilities | None, bool, bool], ...] = (
    (None, True, True),
    (None, False, True),
    (EVERY_ABILITY, True, False),
    (EVERY_ABILITY, False, False),
    (EVERY_ABILITY, True, True),
    (EVERY_ABILITY, False, True),
)


def tree_blocks(atlas: Atlas, route: Plan) -> list[str]:
    found = []
    held = atlas.live.key_items.get(CUT_ITEM, 0)
    for leg in route.legs:
        trees = atlas.trees(leg.map_id)
        if not trees:
            continue
        crossed = {tile for move in leg.moves for tile in (*move.tiles, *move.passing)}
        if leg.exit is not None:
            crossed.update(leg.exit.passed)
        for tree in trees.values():
            if not crossed & tree.tiles:
                continue
            text = (
                f"cutting the tree of event {tree.id} on map {leg.map_id} at {(tree.x, tree.y)} "
                f"({CUT_ITEM}, has {held}; interact with the tree to cut it, which uses nothing "
                "up, and it grows back when the map is entered again)"
            )
            if text not in found:
                found.append(text)
    return found


def no_route_text(
    here: Node, target: Target, goal: Goal, missing: list[str], warpless: bool
) -> str:
    map_id, x, y, _ = here
    if missing:
        return f"every route from map {map_id} {(x, y)} to {target} needs " + " and ".join(missing)
    if warpless:
        return f"no warp on its active page leads from map {map_id} toward map {goal.map_id}"
    return (
        f"no route from map {map_id} {(x, y)} to {target} over steps, ledges, ice, side stairs, "
        "arrow tiles, warps on their active pages, lifts, Surf, Rock Climb and flying"
    )


def staged(atlas: Atlas, pace: Pace, here: Node, goal: Goal) -> Plan | None:
    return search(atlas, pace, here, goal, atlas.warps_to(goal.map_id), set())


def story_blocks(atlas: Atlas, route: Plan, goal: Goal) -> list[str]:
    found = []
    for leg in route.legs:
        area = atlas.area(leg.map_id, "foot")
        exit = leg.exit
        if exit is not None and exit.kind == "open":
            exit = None
        if exit is not None and exit.event_id is not None:
            for gate in GATES:
                if (
                    gate.map_id == leg.map_id
                    and gate.kind == "wall"
                    and exit.event_id in gate.events
                    and not atlas.conditions.met(gate.opens)
                    and not atlas.crossable(gate)
                ):
                    text = gate_text(gate)
                    if text not in found:
                        found.append(text)
        crossed = [tile for move in leg.moves for tile in (*move.tiles, *move.passing)]
        if exit is not None:
            crossed.extend(exit.passed)
        for tile in crossed:
            gate = area.closed.get(tile)
            scene = area.scenes.get(tile)
            if gate is not None and atlas.crossable(gate):
                continue
            if gate is not None:
                text = gate_text(gate)
            elif scene is not None and not goal.sought(leg.map_id, area, tile):
                text = f"crossing the story scene of event {scene} on map {leg.map_id} at "
                text += f"{tile}, which only a walk targeting it crosses"
            else:
                continue
            if text not in found:
                found.append(text)
    return found


def walls_crossed(atlas: Atlas, route: Plan) -> list[Gate]:
    found: list[Gate] = []
    for leg in route.legs:
        area = atlas.area(leg.map_id, "foot")
        crossed = [tile for move in leg.moves for tile in (*move.tiles, *move.passing)]
        found.extend(gate for tile in crossed if (gate := area.closed.get(tile)) is not None)
        exit = leg.exit
        if exit is None or exit.kind == "open":
            continue
        found.extend(gate for tile in exit.passed if (gate := area.closed.get(tile)) is not None)
        if exit.event_id is None:
            continue
        found.extend(
            gate
            for gate in GATES
            if gate.map_id == leg.map_id
            and gate.kind == "wall"
            and exit.event_id in gate.events
            and not atlas.conditions.met(gate.opens)
        )
    return list(dict.fromkeys(found))


def detour(atlas: Atlas, here: Node, goal: Goal) -> Gate | None:
    unwalled = Atlas(atlas.static, atlas.live, atlas.abilities, story=False)
    route = staged(unwalled, pace_for(atlas.live, False), here, goal)
    if route is None:
        return None
    for gate in walls_crossed(atlas, route):
        if atlas.crossable(gate):
            continue
        opener = gate.opener
        if opener is None or not opener.talk or not atlas.openable(gate):
            return None
        return gate
    return None


def gate_text(gate: Gate) -> str:
    events = "event" if len(gate.events) == 1 else "events"
    text = f"the closed story gate {gate.name!r} (map {gate.map_id} {events} "
    text += f"{', '.join(map(str, gate.events))}; opens on "
    return text + f"{flag_text(gate.opens)}: {gate.done_by})"


def flag_text(flag: Flag) -> str:
    if flag.kind == "switch":
        return f"switch {flag.id}"
    if flag.kind == "self_switch":
        return f"self switch A of map {flag.map_id} event {flag.id}"
    return f"variable {flag.id} at {flag.value}"


def route_text(route: Plan, running: bool) -> str:
    parts = []
    for leg in route.legs:
        text = f"map {leg.map_id}: " + (moves_text(leg.moves) if leg.moves else "stay")
        exit = leg.exit
        if exit is not None:
            text += ", " + exit_text(exit)
        parts.append(text)
    if route.facing is not None:
        parts.append(f"face {DIRECTIONS[route.facing]}")
    moves = sum(len(leg.moves) for leg in route.legs)
    warps = sum(leg.exit is not None and leg.exit.kind in WARP_KINDS for leg in route.legs)
    flights = sum(leg.exit is not None and leg.exit.kind == "fly" for leg in route.legs)
    flown = f", {flights} flights" if flights else ""
    pace = "running" if running else "walking"
    return (
        f"route: {moves} moves, {warps} warps{flown}, about {route.ticks} ticks at 1x {pace}: "
        f"{'; '.join(parts)}"
    )


def exit_text(exit: Exit) -> str:
    how = exit.kind if exit.direction is None else f"{exit.kind} {DIRECTIONS[exit.direction]}"
    place = exit.destination
    if exit.kind == "surf":
        return f"{how} onto ({place.x}, {place.y})"
    if exit.kind == "climb":
        return f"{how} to ({place.x}, {place.y})"
    if exit.kind == "fly":
        return f"fly to {exit.town}, map {place.map_id} ({place.x}, {place.y})"
    if exit.kind == "lens":
        return f"use the Lente de la Verdad at ({place.x}, {place.y})"
    if exit.kind == "open":
        answers = [prompt.options[prompt.answer] for prompt in exit.prompts if prompt.options]
        text = f"{how} event {exit.event_id}"
        if answers:
            text += f" answering {', '.join(answers)}"
        if (place.x, place.y) in exit.passed[-1:]:
            return text + f", then through to ({place.x}, {place.y})"
        return text + f", then the warp to map {place.map_id} ({place.x}, {place.y})"
    text = f"{how} event {exit.event_id} to map {place.map_id} ({place.x}, {place.y})"
    answers = [prompt.options[prompt.answer] for prompt in exit.prompts if prompt.options]
    return text + "".join(f" answering {answer}" for answer in answers)


def moves_text(route: tuple[Move, ...]) -> str:
    parts: list[str] = []
    run_length = 0
    for index, move in enumerate(route):
        name = DIRECTIONS[move.direction]
        if move.jump:
            parts.append(f"jump {name}")
        elif move.stair:
            parts.append(f"stairs {name} to ({move.end[0]}, {move.end[1]})")
        else:
            run_length += 1
            following = route[index + 1] if index + 1 < len(route) else None
            if (
                following is not None
                and following.direction == move.direction
                and not following.jump
                and not following.stair
                and not move.slide
                and not move.carried
            ):
                continue
            parts.append(f"{name} {run_length}")
            run_length = 0
        if move.slide:
            parts[-1] += f" (slide {move.slide})"
        if move.carried:
            parts[-1] += f" (carried {len(move.carried)} to ({move.end[0]}, {move.end[1]}))"
    return ", ".join(parts)


@dataclass(frozen=True)
class Costing:
    atlas: Atlas
    here: Node
    pace: Pace
    direction: int


def costing(session: Session, connection: sqlite3.Connection) -> Costing:
    live = live_world(session, connection)
    atlas = Atlas(Static(connection), live, abilities_of(live))
    here: Node = (live.map_id, live.player.x, live.player.y, vehicle_of(live))
    return Costing(atlas, here, pace_for(live, runs_by_holding(live)), live.player.direction)


def active_page(found: Costing, map_id: int, event_id: int) -> int | None:
    spot = found.atlas.spots(map_id).get(event_id)
    return None if spot is None or spot.page is None else spot.page.number


def route_to(found: Costing, target: Target) -> Plan | None:
    goal = goal_for(found.atlas, target)
    if isinstance(goal, str):
        return None
    map_id, x, y, _ = found.here
    if goal.reached(map_id, (x, y)):
        return Plan((), 0, None)
    warps_to = found.atlas.warps_to(goal.map_id)
    flying = any(exit.destination.map_id in warps_to for exit in found.atlas.flights)
    if map_id not in warps_to and not flying:
        return None
    return search(found.atlas, found.pace, found.here, goal, warps_to, set())


def route_ticks(found: Costing, target: Target) -> int | None:
    route = route_to(found, target)
    return None if route is None else route.ticks


def wild_steps(found: Costing, route: Plan, land_maps: Iterable[int]) -> dict[int, int]:
    land = set(land_maps)
    steps: dict[int, int] = {}
    for leg in route.legs:
        if leg.map_id not in land:
            continue
        grid = found.atlas.area(leg.map_id, "foot").grid
        for move in leg.moves:
            for tile in move.tiles:
                if grid.terrain_tag(*tile) in LAND_ENCOUNTER_TAGS:
                    steps[leg.map_id] = steps.get(leg.map_id, 0) + 1
    return steps


def unreachable_reason(found: Costing, target: Target) -> str:
    goal = goal_for(found.atlas, target)
    if isinstance(goal, str):
        return goal
    atlas = found.atlas
    warps_to = atlas.warps_to(goal.map_id)
    flying = any(exit.destination.map_id in warps_to for exit in atlas.flights)
    missing = missing_edges(atlas.static, atlas.live, atlas.abilities, found.here, goal)
    warpless = found.here[0] not in warps_to and not flying
    return no_route_text(found.here, target, goal, missing, warpless)


def off_target(found: Costing, target: Target) -> str | None:
    goal = goal_for(found.atlas, target)
    if isinstance(goal, str):
        return goal
    map_id, x, y, _ = found.here
    if not goal.reached(map_id, (x, y)):
        return f"the player is on map {map_id} at ({x}, {y}), not at {target}"
    facing = None if goal.tiles is None else goal.tiles.get((x, y))
    if facing is not None and found.direction != facing:
        return f"the player is at ({x}, {y}) on map {map_id} facing {found.direction}, not {facing}"
    return None


LAND_ENCOUNTER_TAGS = frozenset({2, TALL_GRASS, 11, 14})


def encounter_pairs(found: Costing, map_id: int) -> dict[Tile, Tile]:
    area = found.atlas.area(map_id, "foot")
    grid = area.grid
    avoid = area.warp_tiles | area.touch | frozenset(area.scenes) | frozenset(area.closed)

    def wild(tile: Tile) -> bool:
        if not grid.valid(*tile) or tile in avoid or not grid.landable(*tile):
            return False
        return grid.terrain_tag(*tile) in LAND_ENCOUNTER_TAGS

    pairs: dict[Tile, Tile] = {}
    for x in range(grid.map.width):
        for y in range(grid.map.height):
            if not wild((x, y)):
                continue
            for direction, (dx, dy) in STEPS.items():
                other = (x + dx, y + dy)
                if (
                    wild(other)
                    and grid.open_step(x, y, direction)
                    and grid.open_step(*other, 10 - direction)
                ):
                    pairs[(x, y)] = other
                    break
    return pairs


def plan_end(found: Costing, route: Plan) -> Tile:
    last = route.legs[-1]
    if last.moves:
        return last.moves[-1].end
    if len(route.legs) > 1:
        place = route.legs[-2].exit
        if place is not None:
            return (place.destination.x, place.destination.y)
    return (found.here[1], found.here[2])


def nearest_tile(found: Costing, map_id: int, tiles: Iterable[Tile]) -> tuple[Tile, int] | None:
    goal = Goal(map_id, dict.fromkeys(tiles))
    if not goal.tiles:
        return None
    here_map, x, y, _ = found.here
    if goal.reached(here_map, (x, y)):
        return (x, y), 0
    warps_to = found.atlas.warps_to(map_id)
    flying = any(exit.destination.map_id in warps_to for exit in found.atlas.flights)
    if here_map not in warps_to and not flying:
        return None
    route = search(found.atlas, found.pace, found.here, goal, warps_to, set())
    return None if route is None else (plan_end(found, route), route.ticks)
