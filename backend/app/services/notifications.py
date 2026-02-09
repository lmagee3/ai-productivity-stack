from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.notification import Notification


@dataclass
class NotificationResult:
    status: str
    provider: str
    task_id: int | None


def notify_critical(
    title: str,
    message: str,
    click_url: str | None = None,
    task_id: int | None = None,
    dry_run: bool = True,
) -> NotificationResult:
    settings = get_settings()
    provider = settings.NOTIFY_PROVIDER

    if _is_deduped(task_id, title):
        return _log(provider, task_id, title, message, "deduped")

    if provider == "off":
        return _log(provider, task_id, title, message, "skipped")

    if provider != "ntfy":
        return _log(provider, task_id, title, message, "error")

    topic = settings.NTFY_TOPIC
    if not topic:
        return _log(provider, task_id, title, message, "error")

    if dry_run:
        return _log(provider, task_id, title, message, "dry_run")

    url = (settings.NTFY_URL or "https://ntfy.sh").rstrip("/")
    headers = {
        "Title": title,
        "Priority": "high",
        "Tags": "warning,books",
    }
    if click_url:
        headers["Click"] = click_url

    try:
        httpx.post(f"{url}/{topic}", data=message.encode("utf-8"), headers=headers, timeout=10)
        return _log(provider, task_id, title, message, "sent")
    except Exception:
        return _log(provider, task_id, title, message, "error")


def _is_deduped(task_id: int | None, title: str) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    with SessionLocal() as session:
        query = session.query(Notification).filter(Notification.created_at >= cutoff)
        if task_id is not None:
            query = query.filter(Notification.task_id == task_id)
        else:
            query = query.filter(Notification.title == title)
        query = query.filter(Notification.status == "sent")
        return query.first() is not None


def _log(provider: str, task_id: int | None, title: str, message: str, status: str) -> NotificationResult:
    topic = get_settings().NTFY_TOPIC if provider == "ntfy" else None
    with SessionLocal() as session:
        record = Notification(
            provider=provider,
            topic=topic,
            task_id=task_id,
            title=title,
            message=message,
            status=status,
        )
        session.add(record)
        session.commit()
    return NotificationResult(status=status, provider=provider, task_id=task_id)
