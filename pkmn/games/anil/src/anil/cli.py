import logging
import sqlite3
import sys
from collections.abc import Callable
from contextlib import closing
from dataclasses import fields, is_dataclass

import click

from anil.bridge.client import BridgeError
from anil.bridge.protocol import Role, SpeedPreset
from anil.harness import calc
from anil.harness.battle import BattleChanges, BattleResult, continue_battle
from anil.harness.battle import fight as battle_fight
from anil.harness.battle import item as battle_item
from anil.harness.battle import run as battle_run
from anil.harness.battle import store as battle_store
from anil.harness.battle import switch as battle_switch
from anil.harness.calc import (
    BattleCalc,
    Chance,
    DamageRange,
    HitsToKO,
    KnockOut,
    MoveCalc,
    Order,
    Span,
    ThreatCalc,
)
from anil.harness.changes import StateChanges
from anil.harness.check import CheckError, run_gamedb_check
from anil.harness.dialog import DialogResult, continue_dialog, interact
from anil.harness.drive import DriveError, Driver, control, drive, set_speed
from anil.harness.gamedb import (
    LOOKUPS,
    GameDbError,
    Location,
    gamedb_path,
    locations,
    matchup,
    open_gamedb,
    trainer,
    trainer_ids,
)
from anil.harness.gamedb import counts as gamedb_counts
from anil.harness.gamedb import species as gamedb_species
from anil.harness.investigate import InvestigateError, Session, attach
from anil.harness.knowledge import STORY, KnowledgeView
from anil.harness.launch import (
    DEFAULT_CLOCK,
    LOG_FORMAT,
    REAL_CLOCK,
    SEED_LIMIT,
    LaunchError,
    LaunchOptions,
    parse_clock,
    run,
    stop,
)
from anil.harness.lock import LockError
from anil.harness.menu import (
    AnswerError,
    MenuAnswer,
    MenuResult,
    answer_text,
    buy,
    choose_pokemon,
    continue_menu,
    fly,
    give_item,
    parse_answer,
    relearn,
    save,
    sell,
    set_exp_share,
    swap_party,
    take_item,
    use_item,
    use_lens,
    use_vial,
)
from anil.harness.navigate import (
    DIRECTIONS,
    CheckReport,
    GoResult,
    NavigateError,
    Target,
    check,
    go,
)
from anil.harness.random import (
    SPECIES_WITHOUT_RANDOM_ABILITIES,
    STARTER_VARIABLES,
    RandomError,
    RunRandom,
    read_random,
)
from anil.harness.replay import ReplayError, replay
from anil.harness.rules import (
    Action,
    Audit,
    BattleItem,
    Buy,
    ContinueBattle,
    ContinueDialog,
    ContinueMenu,
    Fight,
    Fly,
    GiveItem,
    Interact,
    Pc,
    RulesError,
    Run,
    Save,
    Sell,
    SetExpShare,
    Store,
    Swap,
    Switch,
    TakeItem,
    UseItem,
    Vial,
    Walk,
    guard,
    run_audit,
    run_freeze,
)
from anil.harness.showdown import export_party
from anil.harness.snapshot import SnapshotError, SnapshotInfo, list_snapshots
from anil.harness.snapshot import restore as restore_snapshot
from anil.harness.snapshot import save as save_snapshot
from anil.harness.state import (
    ID_SEPARATOR,
    Battle,
    GameState,
    StateError,
    read_badges,
    read_battle,
    read_reveals,
    read_state,
)
from anil.harness.storage import OpError, parse_op, pc
from anil.harness.world import WorldError, counts, open_world, world_path
from anil.install.builds import BUILDS, DEFAULT_BUILD, Build
from anil.install.deploy import DeployError, deploy
from anil.install.game_files import GameFilesError, fetch
from anil.install.windows import InteropError
from anil.settings import Settings
from anil.state_text import state_lines

INVESTIGATION_ERRORS = (
    InvestigateError,
    BridgeError,
    LockError,
    InteropError,
    OSError,
    StateError,
    DriveError,
    SnapshotError,
    NavigateError,
    WorldError,
)

DEFAULT_SAVE = "main"
STATE_EVENTS = 10

SPEED_PRESETS: dict[str, SpeedPreset] = {"1x": "1x", "2x": "2x", "max": "max"}

BUILD_OPTION = click.option(
    "--build", "build_name", type=click.Choice(sorted(BUILDS)), default=DEFAULT_BUILD
)


@click.group()
def anil() -> None:
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, stream=sys.stderr)


@anil.command("install")
@BUILD_OPTION
@click.option("--no-cache", is_flag=True, help="Ignore local copies and copy the archive afresh.")
@click.option("--full", is_flag=True, help="Copy the base again even if it is already deployed.")
@click.option("--harness", is_flag=True, help="Add the bridge, so `anil run` can launch the game.")
def install(build_name: str, no_cache: bool, full: bool, harness: bool) -> None:
    build = BUILDS[build_name]
    try:
        paths = fetch(build, no_cache=no_cache, report=click.echo)
        deploy(build, paths, Settings(), full=full, harness=harness, report=click.echo)
    except (GameFilesError, DeployError, InteropError, LockError) as error:
        raise click.ClickException(str(error)) from error


@anil.command("run")
@BUILD_OPTION
@click.option(
    "--save",
    "save_name",
    default=DEFAULT_SAVE,
    show_default=True,
    help="Save folder name under the data root.",
)
@click.option(
    "--clock",
    help=(
        "Pinned game time as YYYY-MM-DDTHH:MM[:SS], or "
        f"'{REAL_CLOCK}' for the wall clock [default: {DEFAULT_CLOCK}, or the snapshot's]."
    ),
)
@click.option(
    "--seed",
    type=click.IntRange(0, SEED_LIMIT - 1),
    help="RNG seed; the snapshot's, or a random one, is used and recorded when omitted.",
)
@click.option("--snapshot", "snapshot", help="Boot into this snapshot.")
@click.option("--hidden", is_flag=True, help="Hide the game window once the game is up.")
def run_command(
    build_name: str,
    save_name: str,
    clock: str | None,
    seed: int | None,
    snapshot: str | None,
    hidden: bool,
) -> None:
    if snapshot is not None and clock is not None:
        raise click.UsageError("--clock cannot be used with --snapshot, which sets its own clock")
    try:
        options = LaunchOptions(
            save=save_name,
            clock=parse_clock(clock or DEFAULT_CLOCK),
            seed=seed,
            snapshot=snapshot,
            hidden=hidden,
        )
        running = run(BUILDS[build_name], Settings(), options)
    except (LaunchError, LockError, InteropError) as error:
        raise click.ClickException(str(error)) from error
    handshake = running.handshake
    click.echo(f"session {handshake.session}: game pid {handshake.pid}, build {handshake.build}")
    click.echo(f"bridge {handshake.bridge_hash}, protocol {handshake.protocol}")
    click.echo(f"save {running.save_dir}, clock {running.clock or REAL_CLOCK}, seed {running.seed}")
    if running.snapshot is not None:
        click.echo(f"booted into snapshot {running.snapshot} at tick {handshake.tick}")
    click.echo("held until a driver attaches or `anil control take` hands the game over")
    window = running.window
    if window is None:
        click.echo("could not place or show the game window; see the log")
    else:
        where = window.monitor or "the only monitor"
        click.echo(f"window {'shown' if window.visible else 'hidden'} on {where}")
    click.echo(f"logs: {running.session_dir}")


@anil.command("stop")
def stop_command() -> None:
    try:
        click.echo(stop(Settings()))
    except (LaunchError, InteropError) as error:
        raise click.ClickException(str(error)) from error


@anil.command("replay")
@click.argument("session")
@click.option("--keep", is_flag=True, help="Leave the replayed game running when replay ends.")
def replay_command(session: str, keep: bool) -> None:
    try:
        outcome = replay(Settings(), session, keep=keep, report=click.echo)
    except (ReplayError, *INVESTIGATION_ERRORS, LaunchError) as error:
        raise click.ClickException(str(error)) from error
    click.echo(
        f"session {outcome.session}: replayed {session} over ticks "
        f"{outcome.first_tick}-{outcome.last_tick} with no digest mismatch "
        f"({outcome.advances} advances, {outcome.evals} evals, {outcome.restores} restores checked)"
    )


def ask[T](name: str, action: Callable[[Session], T], role: Role | None = None) -> T:
    try:
        with attach(Settings(), name, role) as session:
            return action(session)
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error


@anil.command("eval")
@click.argument("source")
def eval_command(source: str) -> None:
    answer = ask("anil eval", lambda session: session.eval(source))
    click.echo(f"tick {answer.tick}: {answer.value.class_name}")
    click.echo(answer.value.inspect)


@anil.command("showdown")
def showdown_command() -> None:
    click.echo(ask("anil showdown", export_party), nl=False)


@anil.command("stack")
def stack_command() -> None:
    answer = ask("anil stack", Session.stack)
    click.echo(f"tick {answer.tick}:")
    for frame in answer.value.frames:
        click.echo(f"  {frame}")


@anil.command("shot")
def shot_command() -> None:
    answer = ask("anil shot", Session.shot)
    click.echo(f"tick {answer.tick}: {answer.value}")


@anil.command("rng")
def rng_command() -> None:
    answer = ask("anil rng", Session.rng)
    click.echo(f"tick {answer.tick}: {answer.value.calls} rng calls")


@anil.command("control")
@click.argument("action", type=click.Choice(["take", "release"]))
def control_command(action: str) -> None:
    try:
        answer = control(Settings(), "take" if action == "take" else "release")
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    holder = (
        "the owner"
        if answer.value.owner
        else "the driver"
        if answer.value.driver
        else "the owner (no driver)"
    )
    click.echo(f"tick {answer.tick}: {holder} controls the game")


@anil.command("speed")
@click.argument("preset", required=False, type=click.Choice(list(SPEED_PRESETS)))
def speed_command(preset: str | None) -> None:
    try:
        if preset is None:
            with attach(Settings(), "anil speed") as session:
                answer = session.speed()
        else:
            answer = set_speed(Settings(), SPEED_PRESETS[preset])
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    click.echo(
        f"tick {answer.tick}: speed {answer.value.speed}, {answer.value.renders} frames rendered"
    )


@anil.command("state")
@click.option("--switch", "switches", type=int, multiple=True, help="Game switch ID to show.")
@click.option("--variable", "variables", type=int, multiple=True, help="Game variable ID to show.")
@click.option("--self-switches", is_flag=True, help="Show the self switches that are on.")
@click.option(
    "--events",
    "event_count",
    type=click.IntRange(0),
    default=STATE_EVENTS,
    show_default=True,
    help="How many of the most recent events to show.",
)
@click.option("--json", "as_json", is_flag=True, help="Print the typed state as JSON.")
def state_command(
    switches: tuple[int, ...],
    variables: tuple[int, ...],
    self_switches: bool,
    event_count: int,
    as_json: bool,
) -> None:
    def read(session: Session) -> GameState:
        if event_count:
            session.follow_events(max(0, session.event_seq - event_count))
        return read_state(
            session,
            switches=list(switches),
            variables=list(variables),
            with_self_switches=self_switches,
        )

    state = ask("anil state", read)
    state.events = state.events[-event_count:] if event_count else []
    if as_json:
        click.echo(state.model_dump_json(indent=2))
        return
    for line in state_lines(state):
        click.echo(line)


@anil.group()
def snapshot() -> None:
    pass


SEED_OPTION = click.option(
    "--seed", type=click.IntRange(0, SEED_LIMIT - 1), help="RNG seed for the restore."
)


@snapshot.command("save")
@click.argument("name")
@SEED_OPTION
def snapshot_save(name: str, seed: int | None) -> None:
    taken = ask("anil snapshot", lambda session: save_snapshot(session, name, seed), "control")
    click.echo(
        f"tick {taken.tick}: saved and restored snapshot {taken.value.name} "
        f"(tick {taken.value.tick}, seed {taken.value.seed}, hash {taken.value.hash})"
    )


@snapshot.command("restore")
@click.argument("name")
@SEED_OPTION
def snapshot_restore(name: str, seed: int | None) -> None:
    restored = ask(
        "anil snapshot", lambda session: restore_snapshot(session, name, seed), "control"
    )
    click.echo(
        f"tick {restored.tick}: restored snapshot {restored.value.name} "
        f"(seed {restored.value.seed}, hash {restored.value.hash})"
    )


@snapshot.command("list")
def snapshot_list() -> None:
    for entry in list_snapshots(Settings()):
        click.echo(snapshot_line(entry))


def snapshot_line(entry: SnapshotInfo | SnapshotError) -> str:
    if isinstance(entry, SnapshotError):
        return f"unusable: {entry}"
    where = "?" if entry.position is None else "map {} ({}, {})".format(*entry.position)
    clock = "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}".format(*entry.clock)
    return (
        f"{entry.name}: {where}, tick {entry.tick}, seed {entry.seed}, clock {clock}, "
        f"taken {entry.taken} in session {entry.session}"
    )


@anil.command("world")
@BUILD_OPTION
@click.option("--rebuild", is_flag=True, help="Rebuild the cache even if its stamp is current.")
def world_command(build_name: str, rebuild: bool) -> None:
    build = BUILDS[build_name]
    try:
        connection = open_world(build, Settings(), rebuild=rebuild)
    except (WorldError, OSError) as error:
        raise click.ClickException(str(error)) from error
    with closing(connection):
        found = counts(connection)
    click.echo(f"world {world_path(build, Settings())}")
    click.echo(
        f"{found.maps} maps, {found.tilesets} tilesets, {found.events} events "
        f"({found.pages} pages), {found.transfers} transfers on {found.transfer_maps} maps, "
        f"{found.scripts} script commands, {found.town_points} town-map points, "
        f"encounters on {found.encounter_maps} maps"
    )


@anil.group("db", invoke_without_command=True)
@BUILD_OPTION
@click.option("--rebuild", is_flag=True, help="Rebuild the cache even if its stamp is current.")
@click.pass_context
def db(context: click.Context, build_name: str, rebuild: bool) -> None:
    build = BUILDS[build_name]
    try:
        connection = open_gamedb(build, Settings(), rebuild=rebuild)
    except (GameDbError, OSError) as error:
        raise click.ClickException(str(error)) from error
    context.obj = context.with_resource(closing(connection))
    if context.invoked_subcommand is not None:
        return
    found = gamedb_counts(connection)
    click.echo(f"gamedb {gamedb_path(build, Settings())}")
    click.echo(f"stamp {found.stamp}")
    click.echo(
        ", ".join(
            f"{count} {kind}"
            + (f" ({found.allowed[kind]} allowed)" if kind in found.allowed else "")
            for kind, count in found.entries.items()
        )
        + f"; {found.retyped} species with types the overlay changed (retyped or reordered)"
    )
    click.echo(
        "locations: " + ", ".join(f"{count} {kind}" for kind, count in found.locations.items())
    )


def db_lookup(kind: str) -> click.Command:
    lookup = LOOKUPS[kind]

    @click.argument("symbol")
    @click.pass_obj
    def show(connection: sqlite3.Connection, symbol: str) -> None:
        try:
            record = lookup(connection, symbol)
        except GameDbError as error:
            raise click.ClickException(str(error)) from error
        for line in record_lines(record):
            click.echo(line)

    return click.command(kind)(show)


for db_kind in LOOKUPS:
    db.add_command(db_lookup(db_kind))


@db.command("matchup")
@click.argument("attack")
@click.argument("defend", nargs=-1, required=True)
@click.pass_obj
def db_matchup(connection: sqlite3.Connection, attack: str, defend: tuple[str, ...]) -> None:
    try:
        found = matchup(connection, attack.upper(), *(each.upper() for each in defend))
    except GameDbError as error:
        raise click.ClickException(str(error)) from error
    click.echo(
        f"{found.attack} against {'/'.join(found.defend)}: x{found.multiplier} [{found.tag}]"
    )


@db.command("trainer")
@click.argument("trainer_type")
@click.argument("name", required=False)
@click.argument("version", type=int, required=False)
@click.pass_obj
def db_trainer(
    connection: sqlite3.Connection, trainer_type: str, name: str | None, version: int | None
) -> None:
    try:
        record = trainer(connection, one_trainer(connection, trainer_type, name, version))
    except GameDbError as error:
        raise click.ClickException(str(error)) from error
    for line in record_lines(record):
        if not line.startswith(("trainer_type:", "pokemon:")):
            click.echo(line)
    click.echo("trainer_type:")
    for line in record_lines(record.trainer_type):
        click.echo(f"  {line}")
    for slot, pokemon in enumerate(record.pokemon, 1):
        click.echo(f"pokemon {slot}:")
        for line in record_lines(pokemon):
            click.echo(f"  {line}")


def one_trainer(
    connection: sqlite3.Connection, trainer_type: str, name: str | None, version: int | None
) -> str:
    found = trainer_ids(connection, trainer_type, name)
    if version is not None:
        found = [each for each in found if each.endswith(f"{ID_SEPARATOR}{version}")]
    if len(found) != 1:
        choices = ", ".join(found) or "none"
        raise click.ClickException(
            f"{len(found)} trainers match; give NAME and VERSION of: {choices}"
        )
    return found[0]


@db.command("locations")
@click.argument("map_id", type=int, required=False)
@click.pass_obj
def db_locations(connection: sqlite3.Connection, map_id: int | None) -> None:
    found = locations(connection, map_id)
    if not found:
        raise click.ClickException(
            f"no locations on map {map_id}" if map_id is not None else "no locations"
        )
    shown_map = None
    for location in found:
        if location.map_id != shown_map:
            shown_map = location.map_id
            click.echo(f"map {location.map_id} {location.map_name}")
        click.echo(f"  {location_text(location)}")


def location_text(location: Location) -> str:
    place = (
        f"event {location.event_id} ({location.x},{location.y}) page {location.page} "
        f"command {location.command}"
    )
    if location.kind == "gift_pokemon":
        named = f"{location.species or '?'} level {location.level or '?'}"
    elif location.kind in ("mart", "tm_mart"):
        named = ", ".join(location.items) or "?"
        if location.kind == "tm_mart":
            named = f"{location.quantity} random TMs (fixed list if off: {named})"
    else:
        quantity = "?" if location.quantity is None else location.quantity
        named = f"{' or '.join(location.items) or '?'} x{quantity}"
    return f"{location.kind} {named}; random {location.random}; {place} [{location.tag}]"


@db.command("check")
@click.pass_obj
def db_check(connection: sqlite3.Connection) -> None:
    try:
        result = run_gamedb_check(Settings(), connection, click.echo)
    except (CheckError, *INVESTIGATION_ERRORS) as error:
        raise click.ClickException(str(error)) from error
    if not result.passed:
        raise SystemExit(1)


@db.command("random")
@click.argument("species", required=False)
@click.pass_obj
def db_random(connection: sqlite3.Connection, species: str | None) -> None:
    try:
        record = gamedb_species(connection, species) if species is not None else None
        run = ask("anil db random", lambda session: read_random(session, connection))
    except (GameDbError, RandomError) as error:
        raise click.ClickException(str(error)) from error
    click.echo(f"tick {run.tick}: {len(run.owned)} species owned")
    if record is None:
        random_summary(run)
        return
    tables = {
        "ability table": (run.abilities, record.id),
        "learnset": (run.learnsets, record.id),
        "tm compatibility": (run.compatibility, record.species),
    }
    for label, (table, key) in tables.items():
        if label == "ability table" and key in SPECIES_WITHOUT_RANDOM_ABILITIES:
            click.echo(f"{label}: not used for {key}, which keeps its real abilities")
        elif table is None:
            click.echo(f"{label}: not rolled")
        elif key not in table:
            click.echo(f"{label}: not rolled for {key}")
        else:
            click.echo(f"{label}:")
            for line in record_lines(table[key]):
                click.echo(f"  {line}")


def random_summary(run: RunRandom) -> None:
    click.echo("owned: " + (", ".join(sorted(run.owned)) or "-"))
    for label, table in (
        ("ability table", run.abilities),
        ("learnsets", run.learnsets),
    ):
        click.echo(
            f"{label}: " + ("not rolled" if table is None else f"{len(table)} species-forms")
        )
    click.echo(
        "tm compatibility: "
        + ("not rolled" if run.compatibility is None else f"{len(run.compatibility)} species")
    )
    if run.tm_moves is None:
        click.echo("tm moves: not rolled")
    else:
        click.echo(
            "tm moves: "
            + (", ".join(f"{tm.item} {tm.move} [{tm.tag}]" for tm in run.tm_moves.values()) or "-")
        )
    for variable, starter in zip(STARTER_VARIABLES, run.starters, strict=True):
        if starter is None:
            click.echo(f"starter {variable}: none")
            continue
        click.echo(
            f"starter {variable}: {starter.species} [{starter.species_tag}] level {starter.level}, "
            f"moves {', '.join(starter.moves) or '-'}, ability {starter.ability or 'not rolled'} "
            f"[{starter.tag}]"
        )
    opponent_summary(run)


def opponent_summary(run: RunRandom) -> None:
    if not run.wild:
        click.echo("wild tables: not rolled")
    else:
        click.echo(f"wild tables: {len(run.wild)} maps")
        for map_id, types in run.wild.items():
            for encounter_type, slots in types.items():
                click.echo(
                    f"  map {map_id} {encounter_type}: "
                    + (
                        ", ".join(
                            f"{slot.species} [{slot.species_tag}] {slot.chance}% "
                            f"L{slot.min_level}-{slot.max_level} [{slot.tag}]"
                            for slot in slots
                        )
                        or "-"
                    )
                )
    if not run.trainers:
        click.echo("trainer teams: not rolled")
    else:
        click.echo(f"trainer teams: {len(run.trainers)} trainers")
        for team in run.trainers.values():
            click.echo(f"  {team.trainer} [{team.tag}]")
            for member in team.party:
                ivs = " ".join(f"{stat}{value}" for stat, value in member.ivs.items())
                click.echo(
                    f"    {member.species} [{member.species_tag}] level {member.level}, "
                    f"moves {', '.join(member.moves) or '-'}, ability {member.ability}, "
                    f"item {member.item or '-'}, nature {member.nature}, ivs {ivs or '-'} "
                    f"[{member.tag}]"
                )
    if not run.tm_marts:
        click.echo("tm marts: not rolled")
    else:
        click.echo(f"tm marts: {len(run.tm_marts)}")
        for mart in run.tm_marts.values():
            click.echo(
                f"  mart {mart.mart} [{mart.tag}]: "
                + (", ".join(f"{tm.item} {tm.move or '?'} [{tm.tag}]" for tm in mart.stock) or "-")
            )


def record_lines(record: object) -> list[str]:
    if not is_dataclass(record) or isinstance(record, type):
        return [str(record)]
    return [f"{field.name}: {field_text(getattr(record, field.name))}" for field in fields(record)]


def field_text(value: object) -> str:
    if isinstance(value, tuple):
        return ", ".join(field_text(item) for item in value) or "-"
    if isinstance(value, dict):
        return ", ".join(f"{key} {field_text(item)}" for key, item in value.items()) or "-"
    if is_dataclass(value) and not isinstance(value, type):
        return " ".join(str(getattr(value, field.name)) for field in fields(value))
    return str(value)


@anil.command("go")
@BUILD_OPTION
@click.argument("place", nargs=-1, type=int)
@click.option("--map", "map_target", type=int, help="Go to this map's first settled tile.")
@click.option(
    "--event",
    "event_target",
    type=(int, int),
    help="Stop ready to interact with this event: map and event ID.",
)
def go_command(
    build_name: str,
    place: tuple[int, ...],
    map_target: int | None,
    event_target: tuple[int, int] | None,
) -> None:
    given = sum((bool(place), map_target is not None, event_target is not None))
    if given != 1 or (place and len(place) != 3):
        raise click.UsageError("give one of MAP X Y, --map MAP or --event MAP EVENT")
    if event_target is not None:
        target = Target(event_target[0], event_id=event_target[1])
    elif map_target is not None:
        target = Target(map_target)
    else:
        target = Target(place[0], tile=(place[1], place[2]))
    try:
        connection = open_world(BUILDS[build_name], Settings())
    except (WorldError, OSError) as error:
        raise click.ClickException(str(error)) from error
    try:
        with closing(connection), drive(Settings(), "anil go") as driver:
            result = go(driver, connection, target, click.echo)
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    for line in go_lines(result):
        click.echo(line)
    if result.outcome != "arrived":
        raise SystemExit(1)


def go_lines(result: GoResult) -> list[str]:
    where = "?" if result.position is None else "map {} ({}, {})".format(*result.position)
    lines = [
        f"tick {result.tick}: {result.outcome}: {result.reason}",
        (
            f"  at {where} after {result.steps} steps, {result.warps} warps, {result.flights} flights, "
            f"{result.replans} replans and "
            f"{result.tick - result.started} ticks"
        ),
    ]
    context = result.context
    if context is not None:
        screen = f" ({context.screen})" if context.screen else ""
        lines.append(f"  context {context.name}{screen} at {context.frame}")
        lines += [f"  payload {payload}" for payload in context.payloads]
    return lines


ANSWER_OPTION = click.option(
    "--answer",
    "answers",
    multiple=True,
    help="Answer for the next choice or number input, in order; repeatable.",
)


@anil.command("interact")
@BUILD_OPTION
@click.argument("map_id", metavar="MAP", type=int)
@click.argument("event_id", metavar="EVENT", type=int)
@ANSWER_OPTION
def interact_command(build_name: str, map_id: int, event_id: int, answers: tuple[str, ...]) -> None:
    try:
        connection = open_world(BUILDS[build_name], Settings())
    except (WorldError, OSError) as error:
        raise click.ClickException(str(error)) from error
    try:
        with closing(connection), drive(Settings(), "anil interact") as driver:
            result = interact(driver, connection, map_id, event_id, answers, click.echo)
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    show_dialog(result)


@anil.command("dialog")
@ANSWER_OPTION
def dialog_command(answers: tuple[str, ...]) -> None:
    try:
        with drive(Settings(), "anil dialog") as driver:
            result = continue_dialog(driver, answers, click.echo)
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    show_dialog(result)


@anil.group()
def menu() -> None:
    pass


@menu.command("continue")
@click.argument("answers", nargs=-1)
def menu_continue(answers: tuple[str, ...]) -> None:
    parsed = parse_answers(answers)
    show_menu(lambda driver: continue_menu(driver, parsed, click.echo))


@menu.command("use")
@click.argument("item")
@click.argument("slot", type=click.IntRange(0, 5))
@click.option("--count", type=click.IntRange(min=1), default=1, show_default=True)
@click.argument("answers", nargs=-1)
def menu_use(item: str, slot: int, count: int, answers: tuple[str, ...]) -> None:
    parsed = parse_answers(answers)
    show_menu(lambda driver: use_item(driver, item.upper(), slot, count, parsed, click.echo))


@menu.command("give")
@click.argument("item")
@click.argument("slot", type=click.IntRange(0, 5))
def menu_give(item: str, slot: int) -> None:
    show_menu(lambda driver: give_item(driver, item.upper(), slot, click.echo))


@menu.command("take")
@click.argument("slot", type=click.IntRange(0, 5))
def menu_take(slot: int) -> None:
    show_menu(lambda driver: take_item(driver, slot, click.echo))


@menu.command("swap")
@click.argument("a", type=click.IntRange(0, 5))
@click.argument("b", type=click.IntRange(0, 5))
def menu_swap(a: int, b: int) -> None:
    show_menu(lambda driver: swap_party(driver, a, b, click.echo))


@menu.command("choose")
@click.argument("slot", type=click.IntRange(0, 5), required=False)
def menu_choose(slot: int | None) -> None:
    show_menu(lambda driver: choose_pokemon(driver, slot, click.echo))


@menu.command("lens")
def menu_lens() -> None:
    show_menu(lambda driver: use_lens(driver, click.echo))


@menu.command("vial")
def menu_vial() -> None:
    show_menu(lambda driver: use_vial(driver, click.echo))


@menu.command("fly")
@BUILD_OPTION
@click.argument("town")
def menu_fly(build_name: str, town: str) -> None:
    try:
        connection = open_world(BUILDS[build_name], Settings())
    except (WorldError, OSError) as error:
        raise click.ClickException(str(error)) from error
    with closing(connection):
        show_menu(lambda driver: fly(driver, connection, town, click.echo))


@menu.command("exp-share")
@click.argument("slot", type=click.IntRange(0, 5))
@click.argument("setting", type=click.Choice(["on", "off"]))
def menu_exp_share(slot: int, setting: str) -> None:
    show_menu(lambda driver: set_exp_share(driver, slot, setting == "on", click.echo))


@menu.command("save")
def menu_save() -> None:
    show_menu(lambda driver: save(driver, click.echo))


@menu.command("buy")
@click.argument("items", nargs=-1)
def menu_buy(items: tuple[str, ...]) -> None:
    orders = parse_orders(items)
    show_menu(lambda driver: buy(driver, orders, click.echo))


@menu.command("sell")
@click.argument("items", nargs=-1)
def menu_sell(items: tuple[str, ...]) -> None:
    orders = parse_orders(items)
    show_menu(lambda driver: sell(driver, orders, click.echo))


@menu.command("relearn")
@click.argument("moves", nargs=-1)
@click.option("--answer", "answers", multiple=True, help="A chain answer, in order; repeatable.")
def menu_relearn(moves: tuple[str, ...], answers: tuple[str, ...]) -> None:
    parsed = parse_answers(answers)
    wanted = [move.upper() for move in moves]
    show_menu(lambda driver: relearn(driver, wanted, parsed, click.echo))


@menu.command("pc")
@click.argument("ops", nargs=-1)
def menu_pc(ops: tuple[str, ...]) -> None:
    try:
        parsed = [parse_op(op) for op in ops]
    except OpError as error:
        raise click.UsageError(str(error)) from error
    show_menu(lambda driver: pc(driver, parsed, click.echo))


@anil.group()
@BUILD_OPTION
@click.pass_context
def battle(context: click.Context, build_name: str) -> None:
    context.obj = BUILDS[build_name]


@battle.command("continue")
@click.pass_obj
def battle_continue(build: Build) -> None:
    show_battle(build, lambda driver: continue_battle(driver, click.echo))


@battle.command("fight")
@click.argument("move")
@click.option("--target", type=click.IntRange(0, 5), default=None)
@click.pass_obj
def battle_fight_command(build: Build, move: str, target: int | None) -> None:
    show_battle(build, lambda driver: battle_fight(driver, move.upper(), target, click.echo))


@battle.command("run")
@click.pass_obj
def battle_run_command(build: Build) -> None:
    show_battle(build, lambda driver: battle_run(driver, click.echo))


@battle.command("switch")
@click.argument("slot", type=click.IntRange(0, 5))
@click.pass_obj
def battle_switch_command(build: Build, slot: int) -> None:
    show_battle(build, lambda driver: battle_switch(driver, slot, click.echo))


@battle.command("item")
@click.argument("item")
@click.option("--pokemon", type=click.IntRange(0, 5), default=None)
@click.option("--move", default=None)
@click.option("--target", type=click.IntRange(0, 5), default=None)
@click.pass_obj
def battle_item_command(
    build: Build, item: str, pokemon: int | None, move: str | None, target: int | None
) -> None:
    named = None if move is None else move.upper()
    show_battle(
        build,
        lambda driver: battle_item(driver, item.upper(), pokemon, named, target, click.echo),
    )


@battle.command("store")
@click.argument("place")
@click.option(
    "--bag/--keep-item",
    default=None,
    help="Whether the held item of the Pokémon sent to a box goes to the bag.",
)
@click.pass_obj
def battle_store_command(build: Build, place: str, bag: bool | None) -> None:
    slot = store_place(place)
    show_battle(build, lambda driver: battle_store(driver, slot, bag, click.echo))


@battle.command("calc")
@click.pass_obj
def battle_calc_command(build: Build) -> None:
    connection = battle_gamedb(build)
    try:
        with closing(connection), drive(Settings(), "anil battle") as driver:
            found = read_battle(driver.session).value
            lines = calc_lines(battle_calc(connection, driver.session, found))
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    for line in lines:
        click.echo(line)


def store_place(place: str) -> int | None:
    if place.lower() == "pc":
        return None
    if place.isdigit() and int(place) < 6:
        return int(place)
    raise click.UsageError(f"PLACE is 'pc' or a party slot from 0 to 5, not {place!r}")


BATTLE_SUCCESS = frozenset({"finished", "decision"})
COMMAND_DECISION = "command"


def battle_gamedb(build: Build) -> sqlite3.Connection:
    try:
        return open_gamedb(build, Settings())
    except (GameDbError, OSError) as error:
        raise click.ClickException(str(error)) from error


def show_battle(build: Build, verb: Callable[[Driver], BattleResult]) -> None:
    connection = battle_gamedb(build)
    try:
        with closing(connection), drive(Settings(), "anil battle") as driver:
            result = verb(driver)
            annotation = None
            decision = result.decision
            if (
                decision is not None
                and decision.kind == COMMAND_DECISION
                and result.battle_after is not None
            ):
                annotation = battle_calc(connection, driver.session, result.battle_after)
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    for line in battle_lines(result) + calc_lines(annotation):
        click.echo(line)
    if result.outcome not in BATTLE_SUCCESS:
        raise SystemExit(1)


def battle_calc(
    connection: sqlite3.Connection, session: Session, found: Battle | None
) -> BattleCalc | str | None:
    if found is None:
        return None
    view = KnowledgeView(STORY, connection)
    try:
        known = view.battle(found, read_reveals(session).value)
        return calc.annotate(connection, known, read_badges(session), view.random(session))
    except Exception as error:
        logging.getLogger("harness.calc").exception("the damage calc failed")
        return f"the damage calc failed: {type(error).__name__}: {error}"


def calc_lines(annotation: BattleCalc | str | None) -> list[str]:
    if annotation is None:
        return []
    if isinstance(annotation, str):
        return [f"  calc: {annotation}"]
    lines = ["  calc:"]
    for own in annotation.ours:
        lines.append(f"    battler {own.battler}, ours:")
        lines += [f"      {move_calc_text(move)}" for move in own.moves]
    for foe in annotation.foes:
        lines.append(f"    battler {foe.battler}, foe:")
        lines += [f"      not modelled: {name}" for name in foe.not_modelled]
        lines += [f"      {threat_calc_text(threat)}" for threat in foe.threats]
    return lines


def move_calc_text(found: MoveCalc) -> str:
    spread = f" (spread over {list(found.targets)})" if found.spread else ""
    parts = [f"{found.move} -> battler {found.target}{spread}"]
    if found.damage is not None:
        parts.append(damage_text(found.damage))
    if found.hits_to_ko is not None:
        parts.append(hits_text(found.hits_to_ko))
    parts.append(f"accuracy {chance_text(found.accuracy.chance)}")
    if found.critical is not None:
        parts.append(f"crit {chance_text(found.critical.chance)}")
    if found.order is not None:
        parts.append(order_text(found.order))
    named = (
        *found.accuracy.not_modelled,
        *(() if found.critical is None else found.critical.not_modelled),
        *(() if found.order is None else found.order.not_modelled),
        *(() if found.hits_to_ko is None else found.hits_to_ko.not_modelled),
    )
    return "; ".join(parts) + not_modelled_text(named)


def threat_calc_text(found: ThreatCalc) -> str:
    parts = [
        f"{found.source} {found.move} -> battler {found.target}",
        damage_text(found.damage),
        hits_text(found.hits_to_ko),
        f"accuracy {chance_text(found.accuracy.chance)}",
    ]
    if found.order is not None:
        parts.append(order_text(found.order))
    named = (
        *found.accuracy.not_modelled,
        *found.hits_to_ko.not_modelled,
        *(() if found.order is None else found.order.not_modelled),
    )
    return "; ".join(parts) + not_modelled_text(named)


def damage_text(found: DamageRange) -> str:
    if found.immune is not None:
        return f"{found.type} {found.category}, immune: {found.immune}"
    if found.fails:
        return f"{found.type} {found.category}, fails"
    text = (
        f"{found.type} {found.category} x{found.effectiveness:g}, "
        f"{span_text(found.damage)} HP ({span_text(found.percent)}%), "
        f"crit {span_text(found.crit_damage)} HP ({span_text(found.crit_percent)}%)"
    )
    if found.hits != Span.exact(1):
        text += f", {span_text(found.hits)} hits"
    if found.recoil is not None:
        text += f", recoil {span_text(found.recoil)} HP"
    if found.crash is not None:
        text += f", crash {span_text(found.crash)} HP"
    if found.substitute is not None:
        text += f", substitute {found.substitute} HP"
    for risk in found.risks:
        note = f", {risk.note}" if risk.note else ""
        text += f", if {risk.name}: {span_text(risk.damage)} HP ({span_text(risk.percent)}%){note}"
    return text + not_modelled_text(found.not_modelled)


def hits_text(found: HitsToKO) -> str:
    return f"KO in {knock_out_text(found.plain)} hits ({knock_out_text(found.crit)} all crits)"


def knock_out_text(found: KnockOut) -> str:
    if found.fewest is None:
        return "no"
    if found.most is None:
        return f"{found.fewest}+"
    if found.fewest == found.most:
        return str(found.fewest)
    return f"{found.fewest}-{found.most}"


def order_text(found: Order) -> str:
    room = ", trick room" if found.trick_room else ""
    reasons = f" ({', '.join(found.reasons)})" if found.reasons else ""
    return (
        f"first: {found.first}{reasons}, priority {span_text(found.user_priority)} "
        f"vs {span_text(found.target_priority)}, speed {span_text(found.user_speed)} "
        f"vs {span_text(found.target_speed)}{room}"
    )


def span_text(found: Span) -> str:
    if found.low == found.high:
        return str(found.low)
    return f"{found.low}-{found.high}"


def chance_text(found: Chance) -> str:
    low, high = f"{found.low:.1%}", f"{found.high:.1%}"
    return low if low == high else f"{low}-{high}"


def not_modelled_text(named: tuple[str, ...]) -> str:
    unique = list(dict.fromkeys(named))
    return f" [not modelled: {', '.join(unique)}]" if unique else ""


def battle_lines(result: BattleResult) -> list[str]:
    lines = [
        f"tick {result.tick}: {result.outcome}: {result.reason}",
        (
            f"  {len(result.transcript)} lines over {result.tick - result.started} ticks, "
            f"{len(result.events)} events"
        ),
    ]
    decision = result.decision
    if decision is not None:
        lines.append(
            f"  decision: {decision.kind} for battler {decision.battler} on turn {decision.turn}, "
            f"{decision.prompt!r}: {decision.commands}"
        )
        if decision.kind == "full_party":
            held = ", ".join(f"slot {slot} {item}" for slot, item in decision.held.items())
            lines.append(
                f"    caught {decision.caught} holding {decision.caught_item}; "
                f"party slots {decision.slots}, holding {held or 'nothing'}"
            )
        elif decision.kind != COMMAND_DECISION:
            lines.append(f"    party slots that can come in: {decision.slots}")
        lines += [
            f"    move {move.id} ({move.name}) {move.pp}/{move.total_pp} PP"
            for move in decision.moves
        ]
    if result.outcome in ("handoff", "stuck", "refused"):
        context = result.context
        screen = f" ({context.screen})" if context.screen else ""
        lines.append(f"  context {context.name}{screen} at {context.frame}")
        lines += [f"  payload {payload}" for payload in context.payloads]
    if result.outcome == "stuck":
        lines += [f"  frame {frame}" for frame in result.frames]
    return lines + battle_changes_lines(result.battle_changes) + changes_lines(result.changes)


def battle_changes_lines(changes: BattleChanges) -> list[str]:
    if changes.empty:
        return []
    lines = ["  battle changes:"]
    for name, value in (
        ("turn", changes.turn),
        ("weather", changes.weather),
        ("terrain", changes.terrain),
    ):
        if value is not None:
            lines.append(f"    {name}: {value.before} -> {value.after}")
    for battler in changes.battlers:
        lines.append(f"    battler {battler.index}: {battler.change} {battler.species}")
        lines += [
            f"      {name}: {value.before} -> {value.after}"
            for name, value in battler.fields.items()
        ]
    if changes.ended:
        lines.append("    the battle ended")
    return lines


def parse_orders(items: tuple[str, ...]) -> list[tuple[str, int]]:
    orders = []
    for text in items:
        item, _, quantity = text.partition("=")
        if not item or (quantity and not quantity.isdigit()):
            raise click.UsageError(f"{text!r} is not ITEM or ITEM=QUANTITY")
        orders.append((item.upper(), int(quantity) if quantity else 1))
    return orders


def parse_answers(answers: tuple[str, ...]) -> list[MenuAnswer]:
    try:
        return [parse_answer(answer) for answer in answers]
    except AnswerError as error:
        raise click.UsageError(str(error)) from error


def show_menu(verb: Callable[[Driver], MenuResult]) -> None:
    try:
        with drive(Settings(), "anil menu") as driver:
            result = verb(driver)
    except INVESTIGATION_ERRORS as error:
        raise click.ClickException(str(error)) from error
    for line in menu_lines(result):
        click.echo(line)
    if result.outcome != "finished":
        raise SystemExit(1)


def menu_lines(result: MenuResult) -> list[str]:
    lines = [
        f"tick {result.tick}: {result.outcome}: {result.reason}",
        (
            f"  {len(result.transcript)} lines over {result.tick - result.started} ticks, "
            f"{len(result.events)} events"
        ),
    ]
    decision = result.decision
    if decision is not None:
        details = {
            key: value
            for key, value in (
                ("species", decision.species),
                ("into", decision.new_species),
                ("move", decision.move),
                ("moves", decision.moves),
                ("options", decision.options),
                ("cursor", decision.cursor),
            )
            if value is not None
        }
        detail = ", ".join(f"{key} {value}" for key, value in details.items())
        lines.append(
            f"  decision: {decision.kind}, {decision.prompt!r}" + (f": {detail}" if detail else "")
        )
    if result.unused:
        lines.append(f"  unused answers: {[answer_text(answer) for answer in result.unused]}")
    if result.outcome in ("handoff", "stuck", "refused"):
        context = result.context
        screen = f" ({context.screen})" if context.screen else ""
        lines.append(f"  context {context.name}{screen} at {context.frame}")
        lines += [f"  payload {payload}" for payload in context.payloads]
    if result.outcome == "stuck":
        lines += [f"  frame {frame}" for frame in result.frames]
    return lines + changes_lines(result.changes)


def show_dialog(result: DialogResult) -> None:
    for line in dialog_lines(result):
        click.echo(line)
    if result.outcome not in DIALOG_SUCCESS:
        raise SystemExit(1)


DIALOG_SUCCESS = frozenset({"finished", "no_effect"})


def dialog_lines(result: DialogResult) -> list[str]:
    lines = [
        f"tick {result.tick}: {result.outcome}: {result.reason}",
        (
            f"  {len(result.transcript)} lines over {result.tick - result.started} ticks, "
            f"{len(result.events)} events"
        ),
    ]
    decision = result.decision
    if decision is not None:
        prompt = f" after {decision.prompt!r}" if decision.prompt else ""
        if decision.kind == "choice":
            lines.append(
                f"  decision: choice{prompt} from {decision.options}, cursor {decision.cursor}"
            )
        else:
            lines.append(
                f"  decision: number{prompt} from {decision.minimum} to {decision.maximum}, "
                f"value {decision.value}, digit {decision.digit}"
            )
    if result.unused:
        lines.append(f"  unused answers: {list(result.unused)}")
    if result.outcome in ("handoff", "stuck", "refused"):
        context = result.context
        screen = f" ({context.screen})" if context.screen else ""
        lines.append(f"  context {context.name}{screen} at {context.frame}")
        lines += [f"  payload {payload}" for payload in context.payloads]
    if result.outcome == "stuck":
        lines += [f"  frame {frame}" for frame in result.frames]
    return lines + changes_lines(result.changes)


def changes_lines(changes: StateChanges) -> list[str]:
    if changes.empty:
        return ["  no changes"]
    lines = ["  changes:"]
    lines += [
        f"    item {item.name or item.id}: {item.before} -> {item.after}" for item in changes.items
    ]
    if changes.money is not None:
        lines.append(f"    money: {changes.money.before} -> {changes.money.after}")
    if changes.vial is not None:
        lines.append(f"    vial charges: {changes.vial.before} -> {changes.vial.after}")
    for member in changes.party:
        lines.append(f"    party slot {member.slot}: {member.change} {member.species}")
        lines += [
            f"      {name}: {value.before} -> {value.after}"
            for name, value in member.fields.items()
        ]
    for stored in changes.boxes:
        lines.append(f"    box {stored.box} slot {stored.slot}: {stored.change} {stored.species}")
        lines += [
            f"      {name}: {value.before} -> {value.after}"
            for name, value in stored.fields.items()
        ]
    if changes.position is not None:
        lines.append(f"    position: {changes.position.before} -> {changes.position.after}")
    for title, found in (
        ("switch", changes.switches),
        ("variable", changes.variables),
        ("self switch", changes.self_switches),
    ):
        lines += [f"    {title} {flag.id}: {flag.before} -> {flag.after}" for flag in found]
    return lines


@anil.group("rules")
@BUILD_OPTION
@click.pass_context
def rules(context: click.Context, build_name: str) -> None:
    try:
        connection = open_gamedb(BUILDS[build_name], Settings())
    except (GameDbError, OSError) as error:
        raise click.ClickException(str(error)) from error
    context.obj = context.with_resource(closing(connection))


@rules.group("check")
def rules_check() -> None:
    pass


def show_verdict(connection: sqlite3.Connection, action: Action) -> None:
    try:
        verdict = ask("anil rules check", lambda session: guard(session, connection, action))
    except (RulesError, GameDbError) as error:
        raise click.ClickException(str(error)) from error
    if verdict.allowed:
        click.echo("allowed")
        return
    click.echo(f"refused by {verdict.rule}: {verdict.reason}")
    raise SystemExit(1)


@rules_check.command("buy")
@click.argument("items", nargs=-1, required=True)
@click.pass_obj
def rules_check_buy(connection: sqlite3.Connection, items: tuple[str, ...]) -> None:
    show_verdict(connection, Buy(tuple(parse_orders(items))))


@rules_check.command("use")
@click.argument("item")
@click.argument("slot", type=click.IntRange(0, 5))
@click.pass_obj
def rules_check_use(connection: sqlite3.Connection, item: str, slot: int) -> None:
    show_verdict(connection, UseItem(item.upper(), slot))


@rules_check.command("give")
@click.argument("item")
@click.argument("slot", type=click.IntRange(0, 5))
@click.pass_obj
def rules_check_give(connection: sqlite3.Connection, item: str, slot: int) -> None:
    show_verdict(connection, GiveItem(item.upper(), slot))


@rules_check.command("take")
@click.argument("slot", type=click.IntRange(0, 5))
@click.pass_obj
def rules_check_take(connection: sqlite3.Connection, slot: int) -> None:
    show_verdict(connection, TakeItem(slot))


@rules_check.command("swap")
@click.argument("a", type=click.IntRange(0, 5))
@click.argument("b", type=click.IntRange(0, 5))
@click.pass_obj
def rules_check_swap(connection: sqlite3.Connection, a: int, b: int) -> None:
    show_verdict(connection, Swap(a, b))


@rules_check.command("vial")
@click.pass_obj
def rules_check_vial(connection: sqlite3.Connection) -> None:
    show_verdict(connection, Vial())


@rules_check.command("pc")
@click.argument("ops", nargs=-1, required=True)
@click.pass_obj
def rules_check_pc(connection: sqlite3.Connection, ops: tuple[str, ...]) -> None:
    try:
        parsed = tuple(parse_op(op) for op in ops)
    except OpError as error:
        raise click.UsageError(str(error)) from error
    show_verdict(connection, Pc(parsed))


@rules_check.command("interact")
@click.argument("map_id", metavar="MAP", type=int)
@click.argument("event_id", metavar="EVENT", type=int)
@click.pass_obj
def rules_check_interact(connection: sqlite3.Connection, map_id: int, event_id: int) -> None:
    show_verdict(connection, Interact(map_id, event_id))


@rules_check.command("walk")
@click.option("--map", "map_id", type=int, default=None, help="The map the walk ends on.")
@click.pass_obj
def rules_check_walk(connection: sqlite3.Connection, map_id: int | None) -> None:
    show_verdict(connection, Walk(map_id))


@rules_check.command("dialog")
@click.pass_obj
def rules_check_dialog(connection: sqlite3.Connection) -> None:
    show_verdict(connection, ContinueDialog())


@rules_check.command("menu")
@click.pass_obj
def rules_check_menu(connection: sqlite3.Connection) -> None:
    show_verdict(connection, ContinueMenu())


@rules_check.command("save")
@click.pass_obj
def rules_check_save(connection: sqlite3.Connection) -> None:
    show_verdict(connection, Save())


@rules_check.command("sell")
@click.argument("items", nargs=-1, required=True)
@click.pass_obj
def rules_check_sell(connection: sqlite3.Connection, items: tuple[str, ...]) -> None:
    show_verdict(connection, Sell(tuple(parse_orders(items))))


@rules_check.command("exp-share")
@click.argument("slot", type=click.IntRange(0, 5))
@click.argument("state", type=click.Choice(["on", "off"]))
@click.pass_obj
def rules_check_exp_share(connection: sqlite3.Connection, slot: int, state: str) -> None:
    show_verdict(connection, SetExpShare(slot, state == "on"))


@rules_check.command("fly")
@click.argument("town")
@click.pass_obj
def rules_check_fly(connection: sqlite3.Connection, town: str) -> None:
    show_verdict(connection, Fly(town))


@rules_check.command("battle")
@click.pass_obj
def rules_check_battle(connection: sqlite3.Connection) -> None:
    show_verdict(connection, ContinueBattle())


@rules_check.command("run")
@click.pass_obj
def rules_check_run(connection: sqlite3.Connection) -> None:
    show_verdict(connection, Run())


@rules_check.command("switch")
@click.argument("slot", type=click.IntRange(0, 5))
@click.pass_obj
def rules_check_switch(connection: sqlite3.Connection, slot: int) -> None:
    show_verdict(connection, Switch(slot))


@rules_check.command("item")
@click.argument("item")
@click.pass_obj
def rules_check_item(connection: sqlite3.Connection, item: str) -> None:
    show_verdict(connection, BattleItem(item.upper()))


@rules_check.command("fight")
@click.argument("move")
@click.pass_obj
def rules_check_fight(connection: sqlite3.Connection, move: str) -> None:
    show_verdict(connection, Fight(move.upper()))


@rules_check.command("store")
@click.argument("place")
@click.pass_obj
def rules_check_store(connection: sqlite3.Connection, place: str) -> None:
    show_verdict(connection, Store(store_place(place)))


@rules.command("audit")
@click.pass_obj
def rules_audit(connection: sqlite3.Connection) -> None:
    try:
        found = ask("anil rules audit", lambda session: run_audit(session, connection))
    except (RulesError, GameDbError) as error:
        raise click.ClickException(str(error)) from error
    for line in audit_lines(found):
        click.echo(line)
    if any(obligation.blocking for obligation in found.obligations):
        raise SystemExit(1)


@rules.command("freeze")
@click.pass_obj
def rules_freeze(connection: sqlite3.Connection) -> None:
    try:
        found = ask("anil rules freeze", lambda session: run_freeze(session, connection))
    except (RulesError, GameDbError) as error:
        raise click.ClickException(str(error)) from error
    if not found.verdict.allowed:
        click.echo(f"refused by {found.verdict.rule}: {found.verdict.reason}")
        raise SystemExit(1)
    click.echo(f"gym {found.gym}'s paste frozen")
    click.echo(found.paste or "", nl=False)


def audit_lines(found: Audit) -> list[str]:
    lines = [f"tick {found.tick}: {len(found.obligations)} obligations"]
    for obligation in found.obligations:
        blocks = ", ".join(obligation.blocks) if obligation.blocks else "nothing"
        lines.append(f"  {obligation.duty} ({obligation.rule}): {obligation.reason}")
        lines.append(f"    blocks {blocks}")
    lines.append(f"shinies {len(found.shinies)} counted: {found.shinies}")
    if found.excess:
        lines.append(f"  past the 6th: {found.excess}")
    bought = ", ".join(f"{item} {count}" for item, count in found.competitive.items())
    lines.append(f"competitive items bought: {bought or 'none'}")
    pending = f", gym {found.pending}'s due" if found.pending is not None else ", none due"
    lines.append(f"badges {found.badges}, pastes frozen {found.frozen}{pending}")
    return lines


@anil.group()
def nav() -> None:
    pass


@nav.command("check")
@BUILD_OPTION
def nav_check(build_name: str) -> None:
    try:
        connection = open_world(BUILDS[build_name], Settings())
    except (WorldError, OSError) as error:
        raise click.ClickException(str(error)) from error
    with closing(connection):
        report = ask("anil nav check", lambda session: check(session, connection), "driver")
    for line in check_lines(report):
        click.echo(line)
    if report.step_disagreements or report.counter_disagreements or report.page_disagreements:
        raise SystemExit(1)


def check_lines(report: CheckReport) -> list[str]:
    live = report.live
    player = live.player
    lines = [
        (
            f"tick {live.tick}: map {report.map.id} ({report.map.name}), player at "
            f"({player.x}, {player.y}), bridge {live.bridge}, surfing {live.surfing}, "
            f"bicycle {live.bicycle}"
        ),
        f"steps: {report.steps} checked, {len(report.step_disagreements)} disagree",
    ]
    lines += [
        f"  ({entry.x}, {entry.y}) {DIRECTIONS[entry.direction]}: "
        f"port {passable_word(entry.port)}, game {passable_word(entry.game)}"
        for entry in report.step_disagreements
    ]
    lines.append(
        f"counter tiles: {report.counters} checked, {len(report.counter_disagreements)} disagree"
    )
    lines += [
        f"  ({entry.x}, {entry.y}): port {entry.port}, game {entry.game}"
        for entry in report.counter_disagreements
    ]
    lines.append(f"event pages: {report.pages} checked, {len(report.page_disagreements)} disagree")
    lines += [
        f"  event {entry.event_id}: port page {entry.port}, game page {entry.game}"
        for entry in report.page_disagreements
    ]
    if report.unknown_events:
        lines.append(f"live events not in the world cache: {report.unknown_events}")
    return lines


def passable_word(passable: bool) -> str:
    return "passable" if passable else "blocked"
