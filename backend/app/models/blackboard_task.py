from __future__ import annotations

from datetime import datetime
from typing import Literal

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

Status = Literal["submitted", "not_submitted"]


class BlackboardTask(Base):
    __tablename__ = "blackboard_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    course: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(2048))
    status: Mapped[str] = mapped_column(String(32), default="not_submitted")
    points: Mapped[float | None] = mapped_column(Float)
    priority: Mapped[str] = mapped_column(String(16), default="low")
    urgency_score: Mapped[float] = mapped_column(Float, default=0.1)
    source: Mapped[str] = mapped_column(String(64), default="Blackboard")
