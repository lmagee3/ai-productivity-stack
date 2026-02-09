from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.database import SessionLocal
from app.core.priority import urgency_score
from app.models.task import Task

router = APIRouter(tags=["ingest"])


class AssignmentIngestRequest(BaseModel):
    title: str = Field(..., min_length=1)
    due_date: datetime | None = None
    url: str | None = None
    course: str | None = None


class AssignmentIngestResponse(BaseModel):
    task: dict
    urgency_bucket: str


def urgency_bucket(due_date: datetime | None) -> str:
    if due_date is None:
        return "later"
    score = urgency_score(due_date)
    if score.priority == "critical":
        return "critical"
    now = datetime.now()
    if due_date.date() == now.date():
        return "today"
    if (due_date.date() - now.date()).days == 1:
        return "tomorrow"
    if (due_date.date() - now.date()).days <= 7:
        return "week"
    return "later"


@router.post("/ingest/assignment", response_model=AssignmentIngestResponse)
def ingest_assignment(payload: AssignmentIngestRequest) -> AssignmentIngestResponse:
    task = Task(
        title=payload.title,
        due_date=payload.due_date,
        url=payload.url,
        course=payload.course,
    )
    with SessionLocal() as session:
        session.add(task)
        session.commit()
        session.refresh(task)

    return AssignmentIngestResponse(
        task={
            "id": task.id,
            "title": task.title,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "url": task.url,
            "course": task.course,
            "status": task.status,
        },
        urgency_bucket=urgency_bucket(task.due_date),
    )
