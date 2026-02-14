from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.database import SessionLocal
from app.core.llm import get_provider
from app.core.config import get_settings
from app.models.brain_decision import BrainDecision
from app.models.task import Task
from app.models.blackboard_task import BlackboardTask
from app.api.routes.ops import ops_summary
from app.api.routes.ops_next import ops_next

router = APIRouter(tags=["brain"])

# Load MAGE system prompt once at module level
MAGE_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompts" / "mage_system.txt"
MAGE_SYSTEM_PROMPT = MAGE_PROMPT_PATH.read_text() if MAGE_PROMPT_PATH.exists() else "You are MAGE."


class BrainChatRequest(BaseModel):
    message: str = Field(..., min_length=1)


class ProposedAction(BaseModel):
    tool_name: str
    input: dict[str, Any]


class BrainChatResponse(BaseModel):
    intent: str
    route_to: str
    summary: str
    proposed_actions: list[ProposedAction]
    requires_approval: bool = True


def detect_intent(message: str) -> str:
    lowered = message.lower()
    if "next" in lowered:
        return "ops.next"
    if "summary" in lowered or "status" in lowered:
        return "ops.summary"
    if "task" in lowered or "assignment" in lowered:
        return "task.query"
    if "file" in lowered or "search" in lowered:
        return "file.search"
    return "general"


def file_search(query: str, root: str) -> list[str]:
    matches: list[str] = []
    for base, _, files in os.walk(root):
        for name in files:
            if query.lower() in name.lower():
                matches.append(os.path.join(base, name))
    return matches[:10]


@router.post("/brain/chat", response_model=BrainChatResponse)
def brain_chat(payload: BrainChatRequest) -> BrainChatResponse:
    settings = get_settings()
    provider = get_provider()
    intent = detect_intent(payload.message)

    proposed: list[ProposedAction] = []
    context: dict[str, Any] = {}

    if intent == "ops.summary":
        proposed.append(ProposedAction(tool_name="ops.summary", input={}))
        context["summary"] = ops_summary()
    elif intent == "ops.next":
        proposed.append(ProposedAction(tool_name="ops.next", input={}))
        context["next"] = ops_next()
    elif intent == "task.query":
        with SessionLocal() as session:
            tasks = session.query(Task).limit(10).all()
            blackboard = session.query(BlackboardTask).limit(10).all()
        context["tasks"] = [t.title for t in tasks]
        context["blackboard"] = [t.title for t in blackboard]
    elif intent == "file.search":
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
        context["files"] = file_search(payload.message, repo_root)

    wants_heavy_reasoning = (
        len(payload.message) > 1200
        or "analyze" in payload.message.lower()
        or "strategy" in payload.message.lower()
        or "architecture" in payload.message.lower()
    )
    use_cloud = wants_heavy_reasoning and settings.CLOUD_APPROVAL_REQUIRED
    route_to = settings.CLOUD_FALLBACK_PROVIDER if use_cloud else ("local_deep" if wants_heavy_reasoning else "local_fast")

    prompt = (
        f"{MAGE_SYSTEM_PROMPT}\n\n"
        f"## Current Context\n{json.dumps(context, indent=2)}\n\n"
        f"## User Request\n{payload.message}"
    )

    if hasattr(provider, "generate_routed"):
        complexity = "deep" if wants_heavy_reasoning else "fast"
        summary = provider.generate_routed(prompt, complexity=complexity)  # type: ignore[attr-defined]
    else:
        summary = provider.generate(prompt)

    if use_cloud:
        summary = (
            f"{summary}\n\nCloud escalation suggested to {settings.CLOUD_FALLBACK_PROVIDER}. "
            "Approval is required before any cloud call."
        )

    with SessionLocal() as session:
        decision = BrainDecision(
            message=payload.message,
            intent=intent,
            route_to=route_to,
            actions_json=json.dumps([p.model_dump() for p in proposed]),
        )
        session.add(decision)
        session.commit()

    return BrainChatResponse(
        intent=intent,
        route_to=route_to,
        summary=summary,
        proposed_actions=proposed,
        requires_approval=True,
    )
