import hashlib
import re
import shutil
import stat
import zipfile
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from rubymarshal.classes import RubyString
from rubymarshal.reader import loads

from anil.install.builds import Build
from anil.install.windows import to_linux, user_profile

PROJECT_ROOT = Path(__file__).resolve().parents[3]
GAME_ROOT = PROJECT_ROOT / "game"
SCRIPTS_IN_BASE = Path("Data") / "Scripts.rxdata"
PLUGIN_SCRIPTS_IN_BASE = Path("Data") / "PluginScripts.rxdata"
SCRIPTS_DIR = "scripts"
PLUGINS_DIR = "plugins"
INDEX_NAME = "_index.txt"
CHUNK = 1 << 20
UNSAFE_SECTION_CHARS = re.compile(r"[^A-Za-z0-9_.-]+")
UNSAFE_PATH_CHARS = re.compile(r'[\x00-\x1f<>:"|?*\\/]+')
READ_ONLY = stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH

Reporter = Callable[[str], None]


class GameFilesError(Exception):
    pass


@dataclass(frozen=True)
class GamePaths:
    archive: Path
    base: Path
    extracted: Path

    @classmethod
    def for_build(cls, build: Build) -> "GamePaths":
        return cls(
            archive=GAME_ROOT / "archives" / f"{build.name}.zip",
            base=GAME_ROOT / "base" / build.name,
            extracted=GAME_ROOT / "extracted" / build.name,
        )


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def base_is_pristine(build: Build, base: Path) -> bool:
    pinned = (
        (base / SCRIPTS_IN_BASE, build.scripts_sha256),
        (base / PLUGIN_SCRIPTS_IN_BASE, build.plugin_scripts_sha256),
    )
    return all(path.is_file() and sha256_of(path) == digest for path, digest in pinned)


def extraction_is_complete(extracted: Path) -> bool:
    return all((extracted / name / INDEX_NAME).is_file() for name in (SCRIPTS_DIR, PLUGINS_DIR))


def fetch(build: Build, *, no_cache: bool, report: Reporter) -> GamePaths:
    paths = GamePaths.for_build(build)
    if not no_cache and base_is_pristine(build, paths.base):
        report(f"base {paths.base} matches its hashes")
        if not extraction_is_complete(paths.extracted):
            extract_all(paths.base, paths.extracted, report)
        return paths
    if no_cache or not archive_is_valid(build, paths.archive, report):
        copy_archive(build, paths.archive, report)
    unpack(build, paths.archive, paths.base, report)
    extract_all(paths.base, paths.extracted, report)
    return paths


def archive_is_valid(build: Build, archive: Path, report: Reporter) -> bool:
    if not archive.is_file():
        return False
    if sha256_of(archive) == build.archive_sha256:
        report(f"archive {archive} matches its hash")
        return True
    report(f"archive {archive} fails its hash, deleting it")
    archive.unlink()
    return False


def copy_archive(build: Build, archive: Path, report: Reporter) -> None:
    source = to_linux(user_profile() / build.local_archive)
    if not source.is_file():
        raise GameFilesError(f"the archive for {build.name} is not at {source}")
    archive.parent.mkdir(parents=True, exist_ok=True)
    partial = archive.with_name(archive.name + ".part")
    report(f"copying {source}")
    shutil.copyfile(source, partial)
    actual = sha256_of(partial)
    if actual != build.archive_sha256:
        partial.unlink()
        raise GameFilesError(f"{source} fails its hash ({actual}); the copy was deleted")
    partial.replace(archive)
    report(f"archive {archive} verified")


def unpack(build: Build, archive: Path, base: Path, report: Reporter) -> None:
    staging = base.with_name(f".{base.name}.unpacking")
    remove_tree(staging)
    report(f"unpacking {archive} into {base}")
    with zipfile.ZipFile(archive) as zipped:
        members = zipped.infolist()
        top_levels = {member.filename.split("/", 1)[0] for member in members}
        if len(top_levels) != 1:
            raise GameFilesError(f"expected one top-level folder in {archive}, got {top_levels}")
        for member in members:
            relative = member.filename.split("/", 1)[1] if "/" in member.filename else ""
            if not relative:
                continue
            target = staging / relative
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zipped.open(member) as source, target.open("wb") as out:
                shutil.copyfileobj(source, out, CHUNK)
    if not base_is_pristine(build, staging):
        remove_tree(staging)
        raise GameFilesError(
            f"unpacked {SCRIPTS_IN_BASE} or {PLUGIN_SCRIPTS_IN_BASE} fails its hash"
        )
    remove_tree(base)
    staging.replace(base)


def extract_all(base: Path, extracted: Path, report: Reporter) -> None:
    staging = extracted.with_name(f".{extracted.name}.extracting")
    remove_tree(staging)
    sections = extract_scripts(base / SCRIPTS_IN_BASE, staging / SCRIPTS_DIR)
    plugins, files = extract_plugins(base / PLUGIN_SCRIPTS_IN_BASE, staging / PLUGINS_DIR)
    remove_tree(extracted)
    staging.replace(extracted)
    report(f"extracted {sections} sections and {files} files of {plugins} plugins into {extracted}")


def extract_scripts(scripts: Path, target: Path) -> int:
    target.mkdir(parents=True)
    sections = loads(scripts.read_bytes())
    index = []
    for position, (_, name, blob) in enumerate(sections):
        title = as_text(name)
        code = zlib.decompress(as_bytes(blob))
        safe = UNSAFE_SECTION_CHARS.sub("_", title)[:60] or "unnamed"
        write_read_only(target / f"{position:03d}_{safe}.rb", code)
        index.append(f"{position:03d}\t{len(code)}\t{title}")
    write_read_only(target / INDEX_NAME, ("\n".join(index) + "\n").encode())
    return len(sections)


def extract_plugins(plugin_scripts: Path, target: Path) -> tuple[int, int]:
    target.mkdir(parents=True)
    plugins = loads(plugin_scripts.read_bytes())
    index = []
    files = 0
    for position, (name, _, sources) in enumerate(plugins):
        plugin = as_text(name)
        folder = target / safe_segment(plugin)
        for file_name, blob in sources:
            relative = as_text(file_name)
            code = zlib.decompress(as_bytes(blob))
            path = folder.joinpath(*(safe_segment(part) for part in relative.split("/")))
            path.parent.mkdir(parents=True, exist_ok=True)
            write_read_only(path, code)
            index.append(f"{position:03d}\t{len(code)}\t{plugin}/{relative}")
            files += 1
    write_read_only(target / INDEX_NAME, ("\n".join(index) + "\n").encode())
    return len(plugins), files


def safe_segment(name: str) -> str:
    cleaned = UNSAFE_PATH_CHARS.sub("_", name).strip()
    return cleaned if cleaned not in ("", ".", "..") else "unnamed"


def write_read_only(path: Path, content: bytes) -> None:
    path.write_bytes(content)
    path.chmod(READ_ONLY)


def as_text(value: object) -> str:
    if isinstance(value, RubyString):
        return value.text
    return as_bytes(value).decode("utf-8", "replace")


def as_bytes(value: object) -> bytes:
    if isinstance(value, bytes):
        return value
    raise GameFilesError(f"unexpected script field {type(value).__name__}")


def remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
