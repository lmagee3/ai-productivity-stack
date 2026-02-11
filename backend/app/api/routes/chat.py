from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.database import SessionLocal
from app.core.execution_policy import enforce_tool_execution
from app.core.llm import get_provider
from app.models.chat import ChatMessage, ChatSession
from app.models.tool_run import ToolRun
from app.services.actions import execute_tool, propose_actions_from_message, validate_or_error

router = APIRouter(tags=["chat"])


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: int | None = None


class ProposedAction(BaseModel):
    id: int
    tool_name: str
    input: dict[str, Any]
    status: str


class ChatMessageResponse(BaseModel):
    session_id: int
    assistant_message: str
    proposed_actions: list[ProposedAction]


class ExecuteActionRequest(BaseModel):
    tool_run_id: int
    approved: bool


@router.post("/chat/message", response_model=ChatMessageResponse)
def chat_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    provider = get_provider()

    with SessionLocal() as session:
        if payload.session_id is None:
            chat_session = ChatSession()
            session.add(chat_session)
            session.commit()
            session.refresh(chat_session)
            session_id = chat_session.id
        else:
            session_id = payload.session_id

        user_msg = ChatMessage(session_id=session_id, role="user", content=payload.message)
        session.add(user_msg)
        session.commit()
        session.refresh(user_msg)

        assistant_text = provider.generate(
            "You are the module_09 assistant. Respond briefly and safely. "
            "This system can run read-only file scans via tools. "
            "Do not claim you cannot access local files; instead confirm the scan request "
            "or ask which folder to scan. Do not execute destructive actions.\n\n"
            + payload.message
        )
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=assistant_text)
        session.add(assistant_msg)
        session.commit()
        session.refresh(assistant_msg)

        proposed = propose_actions_from_message(payload.message)
        proposed_actions: list[ProposedAction] = []
        for action in proposed:
            tool_name = action["tool_name"]
            input_json = json.dumps(action["input"])
            tool_run = ToolRun(
                session_id=session_id,
                message_id=assistant_msg.id,
                tool_name=tool_name,
                input_json=input_json,
                status="proposed",
            )
            session.add(tool_run)
            session.commit()
            session.refresh(tool_run)
            proposed_actions.append(
                ProposedAction(
                    id=tool_run.id,
                    tool_name=tool_name,
                    input=action["input"],
                    status=tool_run.status,
                )
            )

    return ChatMessageResponse(
        session_id=session_id,
        assistant_message=assistant_text,
        proposed_actions=proposed_actions,
    )


@router.post("/actions/execute")
def execute_action(payload: ExecuteActionRequest) -> dict:
    with SessionLocal() as session:
        tool_run = session.get(ToolRun, payload.tool_run_id)
        if tool_run is None:
            return {"status": "error", "message": "tool_run_not_found"}

        if not payload.approved:
            tool_run.status = "rejected"
            session.commit()
            return {"status": "rejected", "tool_run_id": tool_run.id}

        if tool_run.status != "proposed":
            return {"status": "error", "message": "tool_run_not_proposed"}

        tool_run.status = "approved"
        session.commit()

        data, err = validate_or_error(tool_run.tool_name, tool_run.input_json)
        if err:
            tool_run.status = "error"
            tool_run.error = err
            session.commit()
            return {"status": "error", "message": err}

        decision = enforce_tool_execution(tool_run.tool_name, approved=payload.approved)
        if not decision.allowed:
            tool_run.status = "error"
            tool_run.error = f"{decision.code}: {decision.reason}"
            session.commit()
            return {"status": "error", "message": tool_run.error, "tool_run_id": tool_run.id}

        try:
            result = execute_tool(tool_run.tool_name, data or {}, approved=payload.approved)
            tool_run.status = "executed"
            tool_run.result_json = json.dumps(result)
            session.commit()
            return {"status": "executed", "result": result, "tool_run_id": tool_run.id}
        except Exception as exc:
            tool_run.status = "error"
            tool_run.error = str(exc)
            session.commit()
            return {"status": "error", "message": str(exc), "tool_run_id": tool_run.id}
