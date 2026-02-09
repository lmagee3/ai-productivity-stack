import os
import time
from fastapi import APIRouter

router = APIRouter(tags=["status"])

START_TIME = time.monotonic()


@router.get("/status")
def status() -> dict:
    uptime_seconds = time.monotonic() - START_TIME
    env = os.getenv("ENV", "dev")
    return {
        "uptime": uptime_seconds,
        "env": env,
        "db_status": "stub",
        "agent_count": 0,
        "queue_depth": 0,
    }
