from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

from app.core.database import SessionLocal
from app.models.blackboard_task import BlackboardTask
from app.models.task import Task

router = APIRouter(tags=["ops"])


def urgency_bucket(due_date: datetime | None) -> str:
    if due_date is None:
        return "later"
    now = datetime.now(timezone.utc)
    due = due_date if due_date.tzinfo else due_date.replace(tzinfo=timezone.utc)
    delta_days = (due.date() - now.date()).days
    if due < now:
        return "critical"
    if delta_days == 0:
        return "today"
    if delta_days == 1:
        return "tomorrow"
    if delta_days <= 7:
        return "week"
    return "later"


def priority_rank(priority: str) -> int:
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "urgent": 0}
    return order.get(priority, 9)


def urgency_rank(urgency: str) -> int:
    order = {"critical": 0, "today": 1, "tomorrow": 2, "week": 3, "later": 4}
    return order.get(urgency, 9)


def build_reason(urgency: str, due_at: datetime | None, priority: str | None) -> str:
    if urgency == "critical":
        return "Overdue; immediate attention"
    if urgency == "today":
        return "Due today; keep it moving"
    if urgency == "tomorrow":
        return "Due tomorrow; short runway"
    if urgency == "week":
        return "Due this week; plan ahead"
    if due_at is None:
        return "No due date; lower urgency"
    return f"Due soon; priority {priority or 'normal'}"


def normalize_dt(value: datetime | None) -> datetime:
    if value is None:
        return datetime.max.replace(tzinfo=timezone.utc)
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@router.get("/ops/next")
def ops_next() -> dict[str, Any]:
    items: list[dict[str, Any]] = []

    with SessionLocal() as session:
        for task in session.query(Task).all():
            due_at = task.due_date
            urgency = urgency_bucket(due_at)
            items.append(
                {
                    "id": f"task:{task.id}",
                    "title": task.title,
                    "source": "manual",
                    "due_at": due_at.isoformat() if due_at else None,
                    "urgency": urgency,
                    "priority": "low",
                    "reason": build_reason(urgency, due_at, "low"),
                    "_sort_due": normalize_dt(due_at),
                }
            )

        for task in session.query(BlackboardTask).all():
            due_at = task.due_date
            urgency = urgency_bucket(due_at)
            items.append(
                {
                    "id": f"blackboard:{task.id}",
                    "title": task.title,
                    "source": "blackboard",
                    "due_at": due_at.isoformat() if due_at else None,
                    "urgency": urgency,
                    "priority": task.priority,
                    "reason": build_reason(urgency, due_at, task.priority),
                    "_sort_due": normalize_dt(due_at),
                }
            )

    if not items:
        return {"next": None, "alternates": []}

    items.sort(
        key=lambda item: (
            urgency_rank(item["urgency"]),
            item["_sort_due"],
            priority_rank(str(item.get("priority") or "low")),
        )
    )

    next_item = items[0]
    alternates = items[1:3]

    def strip(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item["id"],
            "title": item["title"],
            "source": item["source"],
            "due_at": item["due_at"],
            "urgency": item["urgency"],
            "reason": item["reason"],
        }

    return {"next": strip(next_item), "alternates": [strip(a) for a in alternates]}
