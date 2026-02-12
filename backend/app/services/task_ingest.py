from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from app.core.database import SessionLocal
from app.models.task import Task


def _parse_due_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def upsert_tasks_from_items(items: Iterable[dict], source: str) -> int:
    created = 0
    with SessionLocal() as session:
        for item in items:
            title = (item.get("title") or "").strip()
            if not title:
                continue
            due_date = _parse_due_date(item.get("due_date"))
            url = item.get("url")
            existing = (
                session.query(Task)
                .filter(Task.title == title)
                .filter(Task.due_date == due_date)
                .filter(Task.url == url)
                .first()
            )
            if existing:
                continue
            task = Task(title=title, due_date=due_date, url=url, course=source)
            session.add(task)
            created += 1
        session.commit()
    return created
