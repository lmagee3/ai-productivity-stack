import time
from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter(tags=["status"])

START_TIME = time.monotonic()


@router.get("/status")
def status() -> dict:
    uptime_seconds = time.monotonic() - START_TIME
    settings = get_settings()
    return {
        "uptime": uptime_seconds,
        "env": settings.ENV,
        "db_status": "stub",
        "agent_count": 0,
        "queue_depth": 0,
    }
