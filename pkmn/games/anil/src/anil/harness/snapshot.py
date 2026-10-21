import re
import zlib
from pathlib import Path

from pydantic import BaseModel, ValidationError

from anil.bridge.protocol import SnapshotAction, SnapshotResult, SpeedPreset
from anil.harness.investigate import Answer, Session, answer
from anil.settings import Settings

SNAPSHOT_NAME = re.compile(r"[A-Za-z0-9_-]+")
SAVE_FILE = "save.dat"
INFO_FILE = "snapshot.json"


class SnapshotError(Exception):
    pass


class SnapshotInfo(BaseModel):
    name: str
    seed: int
    tick: int
    uptime: float
    speed: SpeedPreset
    rng: int
    clock: tuple[int, int, int, int, int, int]
    hash: str
    bytes: int
    position: tuple[int, int, int] | None
    session: str
    build: str
    bridge_hash: str
    taken: str


def check_name(name: str) -> str:
    if not SNAPSHOT_NAME.fullmatch(name):
        raise SnapshotError(f"snapshot name {name!r} may hold only letters, digits, '-' and '_'")
    return name


def snapshot_dir(settings: Settings, name: str) -> Path:
    return settings.snapshots / check_name(name)


def file_hash(path: Path) -> str:
    return f"{zlib.crc32(path.read_bytes()):08x}"


def read_snapshot(settings: Settings, name: str) -> SnapshotInfo:
    folder = snapshot_dir(settings, name)
    try:
        info = SnapshotInfo.model_validate_json((folder / INFO_FILE).read_bytes())
        current = file_hash(folder / SAVE_FILE)
    except FileNotFoundError as error:
        raise SnapshotError(f"no snapshot named {name} in {settings.snapshots}") from error
    except ValidationError as error:
        raise SnapshotError(f"snapshot {name} has an unreadable {INFO_FILE}: {error}") from error
    if current != info.hash:
        raise SnapshotError(
            f"snapshot {name} changed since it was taken ({current}, not {info.hash})"
        )
    return info


def list_snapshots(settings: Settings) -> list[SnapshotInfo | SnapshotError]:
    if not settings.snapshots.is_dir():
        return []
    found: list[SnapshotInfo | SnapshotError] = []
    for folder in sorted(settings.snapshots.iterdir()):
        if not folder.is_dir():
            continue
        try:
            found.append(read_snapshot(settings, folder.name))
        except SnapshotError as error:
            found.append(error)
    return found


def request(
    session: Session, action: SnapshotAction, name: str, seed: int | None
) -> Answer[SnapshotResult]:
    args: dict[str, object] = {"action": action, "name": check_name(name)}
    if seed is not None:
        args["seed"] = seed
    reply = session.call("snapshot", **args)
    return answer(reply, SnapshotResult.model_validate(reply.result))


def save(session: Session, name: str, seed: int | None = None) -> Answer[SnapshotResult]:
    return request(session, "save", name, seed)


def restore(session: Session, name: str, seed: int | None = None) -> Answer[SnapshotResult]:
    return request(session, "restore", name, seed)
