from dataclasses import dataclass
from pathlib import PureWindowsPath


@dataclass(frozen=True)
class Build:
    name: str
    language: str
    local_archive: PureWindowsPath
    archive_sha256: str
    scripts_sha256: str
    plugin_scripts_sha256: str


BUILDS: dict[str, Build] = {
    build.name: build
    for build in (
        Build(
            name="es-v4.14",
            language="es",
            local_archive=PureWindowsPath("Downloads", "POKEMON ANIL v4.14.zip"),
            archive_sha256="eb4474a0a2111737add1ad76cfd035393696a3dec978a1ffd3f475c264557bb8",
            scripts_sha256="e276de98e8ac8e8577968cd4b9c981cfb74e93c4dd598446cfcc219977f50831",
            plugin_scripts_sha256="aa1a2afd4003063b7c650c840b15d20dc9eee0cc95ba66ab0041395e739a3c5e",
        ),
    )
}

DEFAULT_BUILD = "es-v4.14"
