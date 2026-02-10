from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

Priority = Literal["low", "medium", "high", "critical"]


@dataclass
class UrgencyResult:
    score: float
    priority: Priority


def urgency_score(due_date: datetime | None) -> UrgencyResult:
    if due_date is None:
        return UrgencyResult(score=0.1, priority="low")

    now = datetime.now(timezone.utc)
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)

    delta = due_date - now
    hours = delta.total_seconds() / 3600

    if hours < 0:
        return UrgencyResult(score=1.0, priority="critical")
    if hours <= 24:
        return UrgencyResult(score=0.9, priority="high")
    if hours <= 72:
        return UrgencyResult(score=0.7, priority="high")
    if hours <= 168:
        return UrgencyResult(score=0.5, priority="medium")
    return UrgencyResult(score=0.2, priority="low")
