from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENV: str = "dev"
    DB_PATH: str = "mage.db"
    API_PREFIX: str = ""
    NOTION_TOKEN: str | None = None
    LLM_DEFAULT_PROVIDER: str = "local"
    LOCAL_LLM_BASE_URL: str | None = None
    LOCAL_LLM_MODEL: str | None = None
    LOCAL_LLM_TIMEOUT_S: float = 30.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
