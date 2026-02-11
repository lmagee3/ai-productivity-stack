from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.notifications import notify_critical

router = APIRouter(tags=["alerts"])


class AlertTestRequest(BaseModel):
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    click_url: str | None = None


@router.post("/alerts/test")
def alerts_test(payload: AlertTestRequest) -> dict:
    result = notify_critical(
        title=payload.title,
        message=payload.message,
        click_url=payload.click_url,
        dry_run=False,
        approved_network=True,
        actor="alerts_test",
    )
    return {"status": "ok", "result": result.__dict__}
