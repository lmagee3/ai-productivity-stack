from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.api.routes.ops import ops_summary
from app.core.database import SessionLocal
from app.core.execution_policy import enforce_tool_execution, require_allowed
from app.models.task import Task
from app.services.notifications import notify_critical


class FileSearchInput(BaseModel):
    query: str = Field(..., min_length=1)


class OpsSummaryInput(BaseModel):
    pass


class TaskCreateInput(BaseModel):
    title: str = Field(..., min_length=1)
    due_date: datetime | None = None
    course: str | None = None
    url: str | None = None


class NotifySendInput(BaseModel):
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    click_url: str | None = None


def validate_tool_input(tool_name: str, input_json: str) -> dict[str, Any]:
    data = json.loads(input_json)
    if tool_name == "file.search":
        return FileSearchInput.model_validate(data).model_dump()
    if tool_name == "ops.summary":
        return OpsSummaryInput.model_validate(data).model_dump()
    if tool_name == "task.create":
        return TaskCreateInput.model_validate(data).model_dump()
    if tool_name == "notify.send":
        return NotifySendInput.model_validate(data).model_dump()
    raise ValueError("tool_not_allowed")


def execute_tool(tool_name: str, input_data: dict[str, Any], approved: bool = False) -> dict[str, Any]:
    require_allowed(enforce_tool_execution(tool_name, approved=approved))

    if tool_name == "file.search":
        return {"status": "error", "message": "file.search not enabled in v1.3"}
    if tool_name == "ops.summary":
        return ops_summary()
    if tool_name == "task.create":
        task = Task(
            title=input_data["title"],
            due_date=input_data.get("due_date"),
            course=input_data.get("course"),
            url=input_data.get("url"),
        )
        with SessionLocal() as session:
            session.add(task)
            session.commit()
            session.refresh(task)
        return {
            "id": task.id,
            "title": task.title,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "course": task.course,
            "url": task.url,
        }
    if tool_name == "notify.send":
        result = notify_critical(
            title=input_data["title"],
            message=input_data["message"],
            click_url=input_data.get("click_url"),
            dry_run=False,
            approved_network=approved,
            actor="tool",
        )
        return result.__dict__
    raise ValueError("tool_not_allowed")


def propose_actions_from_message(message: str) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    lowered = message.lower()
    if "summary" in lowered or "status" in lowered:
        actions.append({"tool_name": "ops.summary", "input": {}})
    if "notify" in lowered or "alert" in lowered:
        actions.append(
            {
                "tool_name": "notify.send",
                "input": {"title": "Test Alert", "message": "Notification requested"},
            }
        )
    if "task" in lowered or "assignment" in lowered:
        actions.append(
            {
                "tool_name": "task.create",
                "input": {"title": "New task from chat"},
            }
        )
    return actions


def validate_or_error(tool_name: str, input_json: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        data = validate_tool_input(tool_name, input_json)
        return data, None
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        return None, str(exc)
