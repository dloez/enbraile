import click

from anil.install.builds import BUILDS, DEFAULT_BUILD
from anil.install.deploy import DeployError, deploy
from anil.install.game_files import GameFilesError, fetch
from anil.install.windows import InteropError
from anil.settings import Settings


@click.group()
def anil() -> None:
    pass


@anil.command("install")
@click.option("--build", "build_name", type=click.Choice(sorted(BUILDS)), default=DEFAULT_BUILD)
@click.option("--no-cache", is_flag=True, help="Ignore local copies and copy the archive afresh.")
@click.option("--full", is_flag=True, help="Copy the base again even if it is already deployed.")
def install(build_name: str, no_cache: bool, full: bool) -> None:
    build = BUILDS[build_name]
    try:
        paths = fetch(build, no_cache=no_cache, report=click.echo)
        deploy(build, paths, Settings(), full=full, report=click.echo)
    except (GameFilesError, DeployError, InteropError) as error:
        raise click.ClickException(str(error)) from error
