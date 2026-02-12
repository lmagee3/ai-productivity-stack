from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.automation_runtime import run_email_sync_once, run_news_refresh_once, run_scan_once

router = APIRouter(tags=["runtime"])


class RuntimeTriggerRequest(BaseModel):
    job: Literal["scan", "email", "news", "all"] = "all"


@router.post("/runtime/trigger")
def runtime_trigger(payload: RuntimeTriggerRequest) -> dict:
    try:
        if payload.job in {"scan", "all"}:
            run_scan_once()
        if payload.job in {"email", "all"}:
            run_email_sync_once()
        if payload.job in {"news", "all"}:
            run_news_refresh_once()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"runtime trigger failed: {exc}") from exc
    return {"status": "ok", "job": payload.job}
