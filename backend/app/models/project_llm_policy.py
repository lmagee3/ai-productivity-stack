from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class ProjectLLMPolicy(Base):
    __tablename__ = "project_llm_policy"

    id: Mapped[int] = mapped_column(primary_key=True)
    project: Mapped[str] = mapped_column(String(128), unique=True)
    default_provider: Mapped[str] = mapped_column(String(64))
    allow_cloud: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
