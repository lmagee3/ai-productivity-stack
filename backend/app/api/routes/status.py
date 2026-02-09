import time
from fastapi import APIRouter
from app.core.config import get_settings
from app.core.llm import get_llm_state

router = APIRouter(tags=["status"])

START_TIME = time.monotonic()


@router.get("/status")
def status() -> dict:
    uptime_seconds = time.monotonic() - START_TIME
    settings = get_settings()
    llm_state = get_llm_state()
    return {
        "uptime": uptime_seconds,
        "env": settings.ENV,
        "db_status": "stub",
        "agent_count": 0,
        "queue_depth": 0,
        "default_provider": settings.LLM_DEFAULT_PROVIDER,
        "last_llm_latency_ms": llm_state.last_llm_latency_ms,
        "last_llm_error": llm_state.last_llm_error,
    }
