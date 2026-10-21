import os
from pathlib import Path

from pydantic import BaseModel

from anil.install.windows import windows_process_image

GAME_IMAGE = "Game.exe"


class LockError(Exception):
    pass


class GameLock(BaseModel):
    session: str
    harness_pid: int
    game_pid: int | None = None


def read_lock(path: Path) -> GameLock | None:
    if not path.is_file():
        return None
    return GameLock.model_validate_json(path.read_text())


def linux_process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def lock_is_live(lock: GameLock) -> bool:
    if lock.game_pid is not None:
        return windows_process_image(lock.game_pid) == GAME_IMAGE
    return linux_process_alive(lock.harness_pid)


def live_lock(path: Path) -> GameLock | None:
    lock = read_lock(path)
    if lock is None:
        return None
    if lock_is_live(lock):
        return lock
    path.unlink(missing_ok=True)
    return None


def acquire(path: Path, session: str) -> GameLock:
    held = live_lock(path)
    if held is not None:
        raise LockError(
            f"a game is already running (session {held.session}, game pid {held.game_pid}); "
            "stop it with `anil stop`"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = GameLock(session=session, harness_pid=os.getpid())
    try:
        with path.open("x") as handle:
            handle.write(lock.model_dump_json())
    except FileExistsError as error:
        raise LockError(f"{path} appeared while acquiring it") from error
    return lock


def write_lock(path: Path, lock: GameLock) -> None:
    path.write_text(lock.model_dump_json())


def release(path: Path) -> None:
    path.unlink(missing_ok=True)
