from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.api.routes.ops import ops_summary
from app.api.routes.news import get_headlines
from app.api.routes.files_scan import ScanOptions, scan_paths
from app.api.routes.ingest_connectors import EmailFetchRequest, ingest_email_fetch
from app.api.routes.web_search import web_search
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.execution_policy import enforce_file_scan, enforce_tool_execution, require_allowed
from app.models.task import Task
from app.services.notifications import notify_critical
from app.services.task_ingest import upsert_tasks_from_items


class FileSearchInput(BaseModel):
    query: str = Field(..., min_length=1)


class OpsSummaryInput(BaseModel):
    pass


class FilesScanInput(BaseModel):
    paths: list[str] = Field(default_factory=list)


class EmailFetchInput(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    mailbox: str | None = None


class TaskCreateInput(BaseModel):
    title: str = Field(..., min_length=1)
    due_date: datetime | None = None
    course: str | None = None
    url: str | None = None


class NotifySendInput(BaseModel):
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    click_url: str | None = None


class WebSearchInput(BaseModel):
    q: str = Field(..., min_length=2)
    limit: int = Field(default=5, ge=1, le=10)


def validate_tool_input(tool_name: str, input_json: str) -> dict[str, Any]:
    data = json.loads(input_json)
    if tool_name == "file.search":
        return FileSearchInput.model_validate(data).model_dump()
    if tool_name == "ops.summary":
        return OpsSummaryInput.model_validate(data).model_dump()
    if tool_name == "files.scan":
        return FilesScanInput.model_validate(data).model_dump()
    if tool_name == "email.fetch":
        return EmailFetchInput.model_validate(data).model_dump()
    if tool_name == "news.headlines":
        return {}
    if tool_name == "task.create":
        return TaskCreateInput.model_validate(data).model_dump()
    if tool_name == "notify.send":
        return NotifySendInput.model_validate(data).model_dump()
    if tool_name == "web.search":
        return WebSearchInput.model_validate(data).model_dump()
    raise ValueError("tool_not_allowed")


def execute_tool(tool_name: str, input_data: dict[str, Any], approved: bool = False) -> dict[str, Any]:
    require_allowed(enforce_tool_execution(tool_name, approved=approved))

    if tool_name == "file.search":
        return {"status": "error", "message": "file.search not enabled in v1.3"}
    if tool_name == "ops.summary":
        return ops_summary()
    if tool_name == "files.scan":
        settings = get_settings()
        paths = input_data.get("paths") or [p.strip() for p in settings.AUTO_SCAN_PATHS.split(",") if p.strip()] or ["~/Desktop"]
        require_allowed(enforce_file_scan(paths))
        scanned, hot_files, due_signals, stale_candidates, junk_candidates, proposed = scan_paths(paths, ScanOptions())
        created = upsert_tasks_from_items(
            [{"title": p.title, "due_date": p.due_date, "url": None} for p in proposed],
            source="files",
        )
        return {
            "status": "ok",
            "scanned": scanned,
            "created_tasks": created,
            "due_signals": len(due_signals),
            "hot_files": len(hot_files),
            "stale_candidates": len(stale_candidates),
            "junk_candidates": len(junk_candidates),
        }
    if tool_name == "email.fetch":
        response = ingest_email_fetch(EmailFetchRequest(limit=input_data.get("limit", 10), mailbox=input_data.get("mailbox")))
        proposed = []
        for item in response.items:
            for task in item.proposed_tasks:
                proposed.append({"title": task.title, "due_date": task.due_date, "url": None})
        created = upsert_tasks_from_items(proposed, source="email")
        return {"status": "ok", "emails": response.count, "created_tasks": created}
    if tool_name == "news.headlines":
        data = get_headlines(limit=12)
        return {"status": "ok", "headlines": len(data.headlines), "updated_at": data.updated_at}
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
    if tool_name == "web.search":
        result = web_search(q=input_data["q"], limit=input_data.get("limit", 5))
        return result.model_dump()
    raise ValueError("tool_not_allowed")


def propose_actions_from_message(message: str) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    lowered = message.lower()
    if "summary" in lowered or "status" in lowered:
        actions.append({"tool_name": "ops.summary", "input": {}})
    if "scan" in lowered or "folder" in lowered or "desktop" in lowered or "files" in lowered:
        actions.append({"tool_name": "files.scan", "input": {}})
    if "sync inbox" in lowered or "sync gmail" in lowered or "email sync" in lowered:
        actions.append({"tool_name": "email.fetch", "input": {}})
    if "headlines" in lowered or "news" in lowered:
        actions.append({"tool_name": "news.headlines", "input": {}})
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
    if "web search" in lowered or "search web" in lowered or "look up" in lowered:
        actions.append(
            {
                "tool_name": "web.search",
                "input": {"q": message, "limit": 5},
            }
        )
    return actions


def validate_or_error(tool_name: str, input_json: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        data = validate_tool_input(tool_name, input_json)
        return data, None
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        return None, str(exc)
