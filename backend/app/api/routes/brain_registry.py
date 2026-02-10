from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.llm_registry import list_providers, recommend_provider

router = APIRouter(tags=["brain"])


class RecommendRequest(BaseModel):
    message: str = Field(..., min_length=1)
    project: str | None = None
    tokens: int | None = None


@router.get("/brain/providers")
def brain_providers() -> dict:
    return {"providers": list_providers()}


@router.post("/brain/recommend")
def brain_recommend(payload: RecommendRequest) -> dict:
    rec = recommend_provider(payload.message, payload.project, payload.tokens)
    return {
        "provider": rec.provider,
        "route_to": rec.route_to,
        "reason": rec.reason,
        "estimated_cost_usd": rec.estimated_cost_usd,
        "tokens": rec.tokens,
    }
