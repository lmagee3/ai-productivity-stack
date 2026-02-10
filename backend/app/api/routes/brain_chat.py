from __future__ import annotations

import json
import os
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.database import SessionLocal
from app.core.llm import get_provider
from app.models.brain_decision import BrainDecision
from app.models.task import Task
from app.models.blackboard_task import BlackboardTask
from app.api.routes.ops import ops_summary
from app.api.routes.ops_next import ops_next

router = APIRouter(tags=["brain"])


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

    use_cloud = len(payload.message) > 2000 or "analyze" in payload.message.lower()
    route_to = "codex" if use_cloud else "local"

    prompt = (
        "You are the MAGE brain. Be concise and safe. Use the context to answer. "
        "Do not execute actions. Summarize and propose next steps.\n\n"
        f"User message: {payload.message}\n\n"
        f"Context: {json.dumps(context)}"
    )

    summary = provider.generate(prompt)

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
