from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.blackboard_task import BlackboardTask
from app.models.notification import Notification
from app.models.task import Task

router = APIRouter(tags=["ops"])


@router.get("/ops/summary")
def ops_summary() -> dict:
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=24)

    with SessionLocal() as session:
        tasks_total = session.query(func.count(Task.id)).scalar() or 0
        tasks_overdue = (
            session.query(func.count(Task.id))
            .filter(Task.due_date.isnot(None))
            .filter(Task.due_date < now)
            .scalar()
            or 0
        )
        tasks_due_24h = (
            session.query(func.count(Task.id))
            .filter(Task.due_date.isnot(None))
            .filter(Task.due_date >= now)
            .filter(Task.due_date <= soon)
            .scalar()
            or 0
        )

        blackboard_total = session.query(func.count(BlackboardTask.id)).scalar() or 0
        blackboard_overdue = (
            session.query(func.count(BlackboardTask.id))
            .filter(BlackboardTask.due_date.isnot(None))
            .filter(BlackboardTask.due_date < now)
            .scalar()
            or 0
        )
        blackboard_due_24h = (
            session.query(func.count(BlackboardTask.id))
            .filter(BlackboardTask.due_date.isnot(None))
            .filter(BlackboardTask.due_date >= now)
            .filter(BlackboardTask.due_date <= soon)
            .scalar()
            or 0
        )

        recent_notifications = (
            session.query(Notification)
            .order_by(Notification.created_at.desc())
            .limit(5)
            .all()
        )

    return {
        "timestamp": now.isoformat(),
        "tasks": {
            "total": tasks_total,
            "overdue": tasks_overdue,
            "due_24h": tasks_due_24h,
        },
        "blackboard": {
            "total": blackboard_total,
            "overdue": blackboard_overdue,
            "due_24h": blackboard_due_24h,
        },
        "notifications": [
            {
                "id": n.id,
                "provider": n.provider,
                "title": n.title,
                "status": n.status,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in recent_notifications
        ],
    }
