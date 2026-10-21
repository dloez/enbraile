import logging
import sys
from collections.abc import Callable

import click

from anil.bridge.client import BridgeError
from anil.bridge.protocol import Role, SpeedPreset
from anil.harness.drive import DriveError, control, set_speed
from anil.harness.investigate import InvestigateError, Session, attach
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
from anil.harness.replay import ReplayError, replay
from anil.harness.showdown import export_party
from anil.harness.snapshot import SnapshotError, SnapshotInfo, list_snapshots
from anil.harness.snapshot import restore as restore_snapshot
from anil.harness.snapshot import save as save_snapshot
from anil.harness.state import GameState, StateError, read_state
from anil.install.builds import BUILDS, DEFAULT_BUILD
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
