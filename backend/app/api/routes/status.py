import time
from fastapi import APIRouter
from app.core.automation_runtime import STATE
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
        "brain_execution_mode": settings.BRAIN_EXECUTION_MODE,
        "auto_scan_enabled": settings.AUTO_SCAN_ENABLED,
        "auto_email_sync_enabled": settings.AUTO_EMAIL_SYNC_ENABLED,
        "runtime": {
            "runtime_started_at": STATE.runtime_started_at,
            "runtime_heartbeat_at": STATE.runtime_heartbeat_at,
            "scan_last_run": STATE.scan_last_run,
            "scan_last_created": STATE.scan_last_created,
            "scan_last_error": STATE.scan_last_error,
            "email_last_run": STATE.email_last_run,
            "email_last_created": STATE.email_last_created,
            "email_last_error": STATE.email_last_error,
            "news_last_run": STATE.news_last_run,
            "news_last_error": STATE.news_last_error,
        },
        "last_llm_latency_ms": llm_state.last_llm_latency_ms,
        "last_llm_error": llm_state.last_llm_error,
    }
