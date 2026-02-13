from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class NotionTask(Base):
    """
    Synced task from Notion databases (Productivity Dashboard + Email Action Items).

    Primary key: notion_page_id (unique constraint).
    Indexes on (status, priority) and due_date for fast filtering.
    """
    __tablename__ = "notion_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Unique identifier from Notion
    notion_page_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Task content
    task_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="todo", nullable=False)
    domain: Mapped[str] = mapped_column(String(64), default="Personal", nullable=False)
    due_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    priority: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)

    # Metadata
    source_db: Mapped[str] = mapped_column(String(32), nullable=False)  # "productivity" or "email"
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)  # Email link
    notes: Mapped[str | None] = mapped_column(String(4096), nullable=True)  # Additional context

    # Timestamps
    notion_last_edited: Mapped[str] = mapped_column(String(32), nullable=False)  # ISO 8601 from Notion
    synced_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_notion_tasks_status_priority", "status", "priority"),
        Index("ix_notion_tasks_due_date", "due_date"),
        Index("ix_notion_tasks_domain", "domain"),
    )
