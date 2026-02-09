from __future__ import annotations

import logging
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError

from app.core.llm import get_provider

logger = logging.getLogger(__name__)

router = APIRouter(tags=["brain"])


class DispatchRequest(BaseModel):
    content: str = Field(..., min_length=1)


class DispatchDecision(BaseModel):
    intent: str
    priority: Literal["low", "normal", "high", "urgent"]
    domain: str
    due_date: date | None = None
    summary: str
    suggested_actions: list[str]
    route_to: Literal["local", "codex", "claude", "gpt", "human"]


class DispatchResponse(BaseModel):
    decision: DispatchDecision
    human_approval_required: bool = True
    draft: dict[str, Any] | None = None


class DraftRequest(BaseModel):
    content: str = Field(..., min_length=1)


class DraftResponse(BaseModel):
    draft: str
    dry_run: bool = True


class NotionPatchRequest(BaseModel):
    content: str = Field(..., min_length=1)


class NotionPatchResponse(BaseModel):
    proposed_patch: str
    dry_run: bool = True


@router.post("/brain/dispatch", response_model=DispatchResponse)
def dispatch(payload: DispatchRequest) -> DispatchResponse:
    provider = get_provider()

    prompt = (
        "You are a dispatcher. Return strict JSON with keys: intent, priority, domain, "
        "due_date (optional, ISO-8601), summary, suggested_actions (array), route_to. "
        "Routes: local|codex|claude|gpt|human.\n\nInput:\n"
        f"{payload.content}"
    )

    raw = provider.generate_json(prompt)

    try:
        decision = DispatchDecision.model_validate(raw)
    except ValidationError as exc:
        logger.warning("Dispatcher validation failed", exc_info=exc)
        return DispatchResponse(
            decision=DispatchDecision(
                intent="review",
                priority="normal",
                domain="general",
                due_date=None,
                summary="Invalid model output; routed to human for review.",
                suggested_actions=["Review input", "Clarify required action"],
                route_to="human",
            ),
            human_approval_required=True,
            draft=None,
        )

    high_stakes_keywords = {"legal", "contract", "invoice", "payment", "bank", "security", "breach"}
    is_long = len(payload.content) > 2000
    is_high_stakes = any(keyword in payload.content.lower() for keyword in high_stakes_keywords)
    if (is_long or is_high_stakes) and decision.route_to == "local":
        decision.route_to = "codex"

    draft = {
        "note": "Draft generated in approval-first mode.",
    }

    return DispatchResponse(decision=decision, human_approval_required=True, draft=draft)


@router.post("/email/draft", response_model=DraftResponse)
def draft_email(payload: DraftRequest) -> DraftResponse:
    provider = get_provider()
    prompt = (
        "Draft a concise email reply. Do not send it. Return only the draft text.\n\n"
        f"{payload.content}"
    )
    draft = provider.generate(prompt)
    return DraftResponse(draft=draft, dry_run=True)


@router.post("/notion/patch", response_model=NotionPatchResponse)
def draft_notion_patch(payload: NotionPatchRequest) -> NotionPatchResponse:
    provider = get_provider()
    prompt = (
        "Propose a Notion patch in plain text. Do not apply changes. Return only the patch.\n\n"
        f"{payload.content}"
    )
    proposed = provider.generate(prompt)
    return NotionPatchResponse(proposed_patch=proposed, dry_run=True)
