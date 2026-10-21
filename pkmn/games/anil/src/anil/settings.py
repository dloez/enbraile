from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_GAME_SUBDIR = r"Documents\Pokemon\Pokemon Anil-enbraile"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ANIL_")

    game_dir: str | None = None
