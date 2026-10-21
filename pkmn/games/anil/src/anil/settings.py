from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_GAME_SUBDIR = r"Documents\Pokemon\Pokemon Anil-enbraile"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ANIL_")

    data: Path = Path.home() / ".local" / "share" / "enbraile" / "anil"
    game_dir: str | None = None
    bridge_port: int = 24731

    @property
    def sessions(self) -> Path:
        return self.data / "sessions"

    @property
    def saves(self) -> Path:
        return self.data / "saves"

    @property
    def snapshots(self) -> Path:
        return self.data / "snapshots"

    @property
    def world(self) -> Path:
        return self.data / "world"

    @property
    def gamedb(self) -> Path:
        return self.data / "gamedb"

    @property
    def lock_file(self) -> Path:
        return self.data / "game.lock"
