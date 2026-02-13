from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENV: str = "dev"
    DB_PATH: str = "module_09.db"
    API_PREFIX: str = ""
    NOTION_TOKEN: str | None = None
    NOTION_PROD_DB_ID: str = "b1721831-1a6c-4f5e-9c41-5488941abd4c"
    NOTION_EMAIL_DB_ID: str = "bc4d2a87-93fd-43ae-bc4c-d4bbefca5838"
    API_KEY: str | None = None
    LLM_DEFAULT_PROVIDER: str = "local"
    LOCAL_LLM_BASE_URL: str | None = None
    LOCAL_LLM_MODEL: str | None = None
    LOCAL_FAST_MODEL: str = "gemma:latest"
    LOCAL_DEEP_MODEL: str = "gpt-oss:20b"
    LOCAL_LLM_TIMEOUT_S: float = 30.0
    CLOUD_FALLBACK_PROVIDER: str = "gpt"
    CLOUD_APPROVAL_REQUIRED: bool = True
    OLLAMA_BASE_URL: str | None = "http://localhost:11434"
    OLLAMA_MODEL: str | None = "gemma"
    NOTIFY_PROVIDER: str = "off"
    NTFY_URL: str = "https://ntfy.sh"
    NTFY_TOPIC: str | None = None
    ALLOWED_SCAN_ROOTS: str | None = None
    EMAIL_READ_ENABLED: bool = False
    EMAIL_IMAP_HOST: str | None = None
    EMAIL_IMAP_PORT: int = 993
    EMAIL_IMAP_USER: str | None = None
    EMAIL_IMAP_PASSWORD: str | None = None
    EMAIL_IMAP_MAILBOX: str = "INBOX"
    EMAIL_ALLOWLIST_DOMAINS: str | None = None
    EMAIL_DENYLIST_SENDERS: str | None = None
    EMAIL_DENYLIST_SUBJECTS: str | None = None
    BRAIN_EXECUTION_MODE: str = "assist"
    AUTO_SCAN_ENABLED: bool = False
    AUTO_SCAN_INTERVAL_MIN: int = 60
    AUTO_SCAN_PATHS: str = "~/Desktop"
    AUTO_EMAIL_SYNC_ENABLED: bool = False
    AUTO_EMAIL_SYNC_INTERVAL_MIN: int = 60
    AUTO_EMAIL_SYNC_LIMIT: int = 10
    AUTO_NEWS_REFRESH_MIN: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
