import hashlib
import json
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PureWindowsPath

from pydantic import BaseModel

from anil.install.builds import Build
from anil.install.game_files import PROJECT_ROOT, GamePaths, Reporter, remove_tree
from anil.install.windows import to_linux, user_profile
from anil.mod.sources import mod_files
from anil.mod.sources import preload_scripts as mod_preload_scripts
from anil.settings import DEFAULT_GAME_SUBDIR, Settings

STAMP_FILE = "anil_stamp.json"
MKXP_CONFIG = "mkxp.json"
PRELOAD_KEY = "preloadScript"
FRAME_SYNC_KEYS = ("vsync", "syncToRefreshrate")
LINE_COMMENT = re.compile(r"^\s*//.*$", re.MULTILINE)
TRAILING_COMMA = re.compile(r",(\s*[}\]])")


class DeployError(Exception):
    pass


@dataclass(frozen=True)
class OverlayLayer:
    name: str
    files: dict[str, bytes]
    preload: list[str]


class DeployStamp(BaseModel):
    build: str
    base_complete: bool
    commit: str | None = None
    overlay: dict[str, str] = {}
    deployed_at: str | None = None


def game_dir(settings: Settings) -> Path:
    if settings.game_dir:
        return to_linux(PureWindowsPath(settings.game_dir))
    return to_linux(user_profile() / DEFAULT_GAME_SUBDIR)


def read_stamp(target: Path) -> DeployStamp | None:
    stamp = target / STAMP_FILE
    if not stamp.is_file():
        return None
    return DeployStamp.model_validate_json(stamp.read_text())


def write_stamp(target: Path, stamp: DeployStamp) -> None:
    (target / STAMP_FILE).write_text(stamp.model_dump_json(indent=2) + "\n")


def project_commit() -> str:
    head = subprocess.run(
        ["git", "-C", str(PROJECT_ROOT), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    dirty = subprocess.run(
        ["git", "-C", str(PROJECT_ROOT), "status", "--porcelain", "--", "."],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return f"{head}+dirty" if dirty else head


def deploy(
    build: Build, paths: GamePaths, settings: Settings, *, full: bool, report: Reporter
) -> DeployStamp:
    target = game_dir(settings)
    stamp = read_stamp(target)
    if full or stamp is None or stamp.build != build.name or not stamp.base_complete:
        copy_base(build, paths.base, target, stamp, report)
    else:
        report(f"base for {build.name} already in {target}")
    overlay = write_overlay(paths.base, target, report)
    stamp = DeployStamp(
        build=build.name,
        base_complete=True,
        commit=project_commit(),
        overlay=overlay,
        deployed_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
    write_stamp(target, stamp)
    report(f"stamp written: build {stamp.build}, commit {stamp.commit}")
    return stamp


def copy_base(
    build: Build, base: Path, target: Path, stamp: DeployStamp | None, report: Reporter
) -> None:
    if target.exists() and stamp is None and any(target.iterdir()):
        raise DeployError(
            f"{target} exists, is not empty and has no {STAMP_FILE}; "
            "it is not an anil working copy, so it is left alone"
        )
    started = time.monotonic()
    if target.exists():
        report(f"removing the previous working copy {target}")
        remove_tree(target)
    target.mkdir(parents=True)
    write_stamp(target, DeployStamp(build=build.name, base_complete=False))
    report(f"copying {base} into {target}")
    shutil.copytree(base, target, dirs_exist_ok=True)
    report(f"base copied in {time.monotonic() - started:.0f} s")


def mod_layer() -> OverlayLayer:
    return OverlayLayer("randomlocke", mod_files(), mod_preload_scripts())


def overlay_files(
    base: Path, layers: list[OverlayLayer], *, frame_sync_off: bool
) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    preload: list[str] = []
    for layer in layers:
        clashes = sorted(set(layer.files) & (set(files) | {MKXP_CONFIG}))
        if clashes:
            raise DeployError(f"overlay layer {layer.name} rewrites {', '.join(clashes)}")
        files.update(layer.files)
        preload.extend(layer.preload)
    files[MKXP_CONFIG] = mkxp_config(base / MKXP_CONFIG, preload, frame_sync_off=frame_sync_off)
    return files


def write_overlay(base: Path, target: Path, report: Reporter) -> dict[str, str]:
    files = overlay_files(base, [mod_layer()], frame_sync_off=False)
    written = 0
    for name, content in files.items():
        path = target / name
        if path.is_file() and path.read_bytes() == content:
            continue
        path.write_bytes(content)
        report(f"overlay {name} written")
        written += 1
    report(f"overlay: {written} written, {len(files) - written} unchanged")
    return {name: hashlib.sha256(content).hexdigest() for name, content in files.items()}


def mkxp_config(shipped: Path, preload: list[str], *, frame_sync_off: bool) -> bytes:
    text = TRAILING_COMMA.sub(r"\1", LINE_COMMENT.sub("", shipped.read_text(encoding="utf-8")))
    try:
        config = json.loads(text)
    except json.JSONDecodeError as error:
        raise DeployError(f"{shipped} does not parse once comments are removed: {error}") from error
    if not isinstance(config, dict):
        raise DeployError(f"{shipped} is not an object")
    config[PRELOAD_KEY] = [*config.get(PRELOAD_KEY, []), *preload]
    if frame_sync_off:
        for key in FRAME_SYNC_KEYS:
            config[key] = False
    return (json.dumps(config, ensure_ascii=False, indent=4) + "\n").encode()
