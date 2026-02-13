from __future__ import annotations

import logging
from fastapi import APIRouter, Query, HTTPException

from app.core.database import SessionLocal
from app.models.notion_task import NotionTask
from app.services.notion_sync import sync_notion_tasks

logger = logging.getLogger(__name__)

router = APIRouter(tags=["notion"])


@router.post("/notion/sync")
async def sync_notion() -> dict:
    """
    Manually trigger a Notion sync.
    Queries both databases, normalizes, upserts.

    Response:
    {
      "synced": 42,
      "errors": [],
      "timestamp": "2026-02-13T14:30:00.000000"
    }
    """
    with SessionLocal() as db:
        try:
            result = await sync_notion_tasks(db)
            return result
        except Exception as e:
            logger.error(f"Notion sync error: {e}")
            raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/notion/tasks")
def get_notion_tasks(
    status: str | None = Query(None, description="Filter by status: todo, doing, blocked, waiting, done"),
    domain: str | None = Query(None, description="Filter by domain: School, Personal, Kairos, Email"),
    priority: str | None = Query(None, description="Filter by priority: critical, high, medium, low"),
    source_db: str | None = Query(None, description="Filter by source: productivity, email"),
) -> dict:
    """
    Get tasks from local Notion cache.
    Filters are optional and combined with AND logic.

    Response:
    {
      "tasks": [
        {
          "id": 1,
          "notion_page_id": "...",
          "task_name": "Reply to recruiter",
          "status": "todo",
          "domain": "Personal",
          "due_date": "2026-02-15",
          "priority": "high",
          "source_db": "email",
          "source_url": "mailto:recruiter@...",
          "notes": "...",
          "synced_at": "2026-02-13T14:30:00"
        },
        ...
      ],
      "total": 5
    }
    """
    with SessionLocal() as db:
        query = db.query(NotionTask)

        if status:
            query = query.filter(NotionTask.status == status)
        if domain:
            query = query.filter(NotionTask.domain == domain)
        if priority:
            query = query.filter(NotionTask.priority == priority)
        if source_db:
            query = query.filter(NotionTask.source_db == source_db)

        # Default: exclude done tasks, sort by priority then due date
        if not status:
            query = query.filter(NotionTask.status != "done")

        tasks = query.order_by(
            NotionTask.priority.desc(),
            NotionTask.due_date.asc(),
        ).all()

        return {
            "tasks": [
                {
                    "id": t.id,
                    "notion_page_id": t.notion_page_id,
                    "task_name": t.task_name,
                    "status": t.status,
                    "domain": t.domain,
                    "due_date": t.due_date,
                    "priority": t.priority,
                    "source_db": t.source_db,
                    "source_url": t.source_url,
                    "notes": t.notes,
                    "synced_at": t.synced_at.isoformat() if t.synced_at else None,
                }
                for t in tasks
            ],
            "total": len(tasks),
        }
