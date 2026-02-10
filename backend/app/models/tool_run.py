from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class ToolRun(Base):
    __tablename__ = "tool_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(Integer)
    message_id: Mapped[int | None] = mapped_column(Integer)
    tool_name: Mapped[str] = mapped_column(String(64))
    input_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="proposed")
    result_json: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
