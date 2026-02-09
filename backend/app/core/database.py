from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import Settings, get_settings


class Base(DeclarativeBase):
    pass


BASE_DIR = Path(__file__).resolve().parents[2]


def build_db_url(settings: Settings) -> str:
    db_path = Path(settings.DB_PATH)
    if not db_path.is_absolute():
        db_path = (BASE_DIR / db_path).resolve()
    return f"sqlite:///{db_path}"


@lru_cache
def get_engine():
    settings = get_settings()
    return create_engine(build_db_url(settings), future=True)


SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, autocommit=False)


def check_connection() -> bool:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
