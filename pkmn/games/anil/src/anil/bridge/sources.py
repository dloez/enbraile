import hashlib
from dataclasses import dataclass
from importlib.resources import files

PRELOAD_ORDER = (
    "anil_json.rb",
    "anil_read.rb",
    "anil_context.rb",
    "anil_drive.rb",
    "anil_speed.rb",
    "anil_audio.rb",
    "anil_record.rb",
    "anil_events.rb",
    "anil_snapshot.rb",
    "anil_bridge.rb",
)
VERSION_FILE = "anil_version.rb"
LAUNCH_FILE = "anil_launch.json"


@dataclass(frozen=True)
class RubySource:
    name: str
    content: bytes


def ruby_sources() -> list[RubySource]:
    package = files("anil.bridge") / "ruby"
    return [RubySource(name, (package / name).read_bytes()) for name in PRELOAD_ORDER]


def bridge_hash(sources: list[RubySource] | None = None) -> str:
    digest = hashlib.sha256()
    for source in sources if sources is not None else ruby_sources():
        digest.update(source.name.encode())
        digest.update(b"\0")
        digest.update(hashlib.sha256(source.content).digest())
    return digest.hexdigest()


def version_source(build: str, sources: list[RubySource] | None = None) -> RubySource:
    content = (
        f'module AnilVersion\n  BRIDGE_HASH = "{bridge_hash(sources)}"\n  BUILD = "{build}"\nend\n'
    )
    return RubySource(VERSION_FILE, content.encode())


def preload_scripts() -> list[str]:
    return [VERSION_FILE, *PRELOAD_ORDER]
