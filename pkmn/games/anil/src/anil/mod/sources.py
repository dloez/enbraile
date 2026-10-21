import json
from importlib.resources import files

from anil.mod.allowlists import load, load_types
from anil.mod.showdown import load_names

VERSION = 1
PRELOAD_ORDER = ("randomlocke.rb", "showdown.rb")
VERSION_FILE = "randomlocke_version.rb"
ALLOW_LISTS_FILE = "randomlocke_allowlists.rb"
SHOWDOWN_NAMES_FILE = "randomlocke_showdown_names.rb"
GUIDE_FILE = "LEEME-Randomlocke.txt"


def version_source() -> bytes:
    return f"module RandomlockeVersion\n  VERSION = {VERSION}\nend\n".encode()


def symbol_array(name: str, symbols: list[str]) -> str:
    entries = "".join(f"    {symbol}\n" for symbol in symbols)
    return f"  {name.upper()} = %i[\n{entries}  ].freeze\n"


def types_hash(types: dict[str, list[str]]) -> str:
    entries = "".join(f"    {symbol}: %i[{' '.join(names)}],\n" for symbol, names in types.items())
    return f"  TYPES = {{\n{entries}  }}.freeze\n"


def allow_lists_source() -> bytes:
    lists = "".join(symbol_array(name, symbols) for name, symbols in load().by_name().items())
    constants = lists + types_hash(load_types())
    return f"module RandomlockeAllowLists\n{constants}end\n".encode()


def names_hash(kind: str, names: dict[str, str]) -> str:
    entries = "".join(
        f"    {symbol}: {json.dumps(name, ensure_ascii=False)},\n" for symbol, name in names.items()
    )
    return f"  {kind.upper()} = {{\n{entries}  }}.freeze\n"


def showdown_names_source() -> bytes:
    constants = "".join(names_hash(kind, names) for kind, names in load_names().items())
    return f"module RandomlockeShowdownNames\n{constants}end\n".encode()


def mod_files() -> dict[str, bytes]:
    package = files("anil.mod") / "ruby"
    sources = {name: (package / name).read_bytes() for name in PRELOAD_ORDER}
    return {
        VERSION_FILE: version_source(),
        ALLOW_LISTS_FILE: allow_lists_source(),
        SHOWDOWN_NAMES_FILE: showdown_names_source(),
        **sources,
    }


def guide_files() -> dict[str, bytes]:
    return {GUIDE_FILE: (files("anil.mod") / GUIDE_FILE).read_bytes()}


def preload_scripts() -> list[str]:
    return [VERSION_FILE, ALLOW_LISTS_FILE, SHOWDOWN_NAMES_FILE, *PRELOAD_ORDER]
