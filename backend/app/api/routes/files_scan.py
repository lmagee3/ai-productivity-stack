from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.execution_policy import enforce_file_scan

router = APIRouter(tags=["tools"])

TEXT_EXTS = {
    "md",
    "txt",
    "py",
    "js",
    "ts",
    "tsx",
    "json",
    "yaml",
    "yml",
    "csv",
    "html",
    "css",
    "log",
}

DOC_EXTS = {"pdf", "docx"}

DUE_KEYWORDS = ["due", "deadline", "submit", "assignment", "discussion", "quiz", "module", "week"]
JUNK_MARKERS = ["~", "backup", "old", "copy", "final_final", ".tmp", ".bak"]


def expand_path(raw: str) -> Path:
    return Path(os.path.expanduser(raw)).resolve()


class ScanOptions(BaseModel):
    include_exts: list[str] = Field(default_factory=list)
    exclude_dirs: list[str] = Field(default_factory=lambda: ["node_modules", ".git", ".venv", "dist", "build", "__pycache__"])
    max_file_mb: float = 2.0
    read_text: bool = True
    max_chars: int = 12000


class ScanRequest(BaseModel):
    mode: Literal["selected", "scoped", "full"] = "scoped"
    paths: list[str]
    options: ScanOptions = ScanOptions()


class FileSignal(BaseModel):
    path: str
    reason: str
    due_date: str | None = None


class ProposedTask(BaseModel):
    title: str
    notes: str
    due_date: str | None
    urgency: Literal["critical", "today", "tomorrow", "week", "later"]
    priority: Literal["critical", "high", "medium", "low"] = "medium"
    source: Literal["files"] = "files"


class ScanResponse(BaseModel):
    scanned: int
    hot_files: list[dict[str, Any]]
    due_signals: list[FileSignal]
    stale_candidates: list[dict[str, Any]]
    junk_candidates: list[dict[str, Any]]
    proposed_tasks: list[ProposedTask]


def is_text_file(ext: str) -> bool:
    return ext in TEXT_EXTS


def extract_text(path: Path, ext: str, max_chars: int) -> str:
    if ext in TEXT_EXTS:
        try:
            with path.open("r", errors="ignore") as handle:
                return handle.read(max_chars)
        except OSError:
            return ""

    if ext == "pdf":
        try:
            from pypdf import PdfReader  # type: ignore

            reader = PdfReader(str(path))
            chunks: list[str] = []
            size = 0
            for page in reader.pages:
                text = page.extract_text() or ""
                if not text:
                    continue
                remaining = max_chars - size
                if remaining <= 0:
                    break
                text = text[:remaining]
                chunks.append(text)
                size += len(text)
            return "\n".join(chunks)
        except Exception:
            return ""

    if ext == "docx":
        try:
            from docx import Document  # type: ignore

            doc = Document(str(path))
            chunks: list[str] = []
            size = 0
            for para in doc.paragraphs:
                if not para.text:
                    continue
                remaining = max_chars - size
                if remaining <= 0:
                    break
                text = para.text[:remaining]
                chunks.append(text)
                size += len(text)
            return "\n".join(chunks)
        except Exception:
            return ""

    return ""


def parse_due_date(text: str) -> datetime | None:
    iso_match = re.search(r"\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b", text)
    if iso_match:
        year, month, day = map(int, iso_match.groups())
        try:
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return None

    us_match = re.search(r"\b(\d{1,2})[/-](\d{1,2})\b", text)
    if us_match:
        month, day = map(int, us_match.groups())
        year = datetime.now(timezone.utc).year
        try:
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return None

    month_match = re.search(
        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b",
        text,
        re.IGNORECASE,
    )
    if month_match:
        month_str, day_str = month_match.groups()
        month = [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
        ].index(month_str[:3].lower()) + 1
        day = int(day_str)
        year = datetime.now(timezone.utc).year
        try:
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return None

    return None


def urgency_bucket(due_date: datetime | None) -> str:
    if due_date is None:
        return "later"
    now = datetime.now(timezone.utc)
    if due_date < now:
        return "critical"
    delta = due_date.date() - now.date()
    if delta.days == 0:
        return "today"
    if delta.days == 1:
        return "tomorrow"
    if delta.days <= 7:
        return "week"
    return "later"


def urgency_rank(urgency: str) -> int:
    order = {"critical": 0, "today": 1, "tomorrow": 2, "week": 3, "later": 4}
    return order.get(urgency, 5)


def priority_from_urgency(urgency: str) -> str:
    if urgency == "critical":
        return "critical"
    if urgency in {"today", "tomorrow"}:
        return "high"
    if urgency == "week":
        return "medium"
    return "low"


def infer_deliverable(name: str, text: str) -> str:
    haystack = f"{name} {text}".lower()
    if "discussion" in haystack:
        return "discussion post"
    if "quiz" in haystack:
        return "quiz submission"
    if "exam" in haystack:
        return "exam prep"
    if "project" in haystack:
        return "project milestone"
    if "module" in haystack or "week" in haystack:
        return "weekly module deliverable"
    return "assignment deliverable"


def task_score(urgency: str, due_date: str | None, title: str) -> tuple[int, str, str]:
    return (urgency_rank(urgency), due_date or "9999-12-31", title.lower())


def scan_paths(paths: list[str], options: ScanOptions) -> tuple[int, list[dict[str, Any]], list[FileSignal], list[dict[str, Any]], list[dict[str, Any]], list[ProposedTask]]:
    scanned = 0
    hot_files: list[dict[str, Any]] = []
    due_signals: list[FileSignal] = []
    stale_candidates: list[dict[str, Any]] = []
    junk_candidates: list[dict[str, Any]] = []
    proposed_tasks: list[ProposedTask] = []

    include_exts = {ext.lower().lstrip(".") for ext in options.include_exts} if options.include_exts else None
    exclude_dirs = {d.lower() for d in options.exclude_dirs}
    size_limit = options.max_file_mb * 1024 * 1024

    now = datetime.now(timezone.utc)
    hot_cutoff = now - timedelta(days=7)
    stale_cutoff = now - timedelta(days=90)

    for raw in paths:
        base = expand_path(raw)
        if not base.exists():
            continue
        if base.is_file():
            file_paths = [base]
        else:
            file_paths = []
            for root, dirnames, filenames in os.walk(base):
                dirnames[:] = [d for d in dirnames if d.lower() not in exclude_dirs]
                for name in filenames:
                    file_paths.append(Path(root) / name)

        for path in file_paths:
            ext = path.suffix.lower().lstrip(".")
            if include_exts and ext not in include_exts:
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            if stat.st_size > size_limit:
                continue

            scanned += 1
            modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)

            if modified >= hot_cutoff:
                hot_files.append({"path": str(path), "modified_at": modified.isoformat()})
            if modified <= stale_cutoff:
                stale_candidates.append({"path": str(path), "modified_at": modified.isoformat()})

            name_lower = path.name.lower()
            if any(marker in name_lower for marker in JUNK_MARKERS):
                junk_candidates.append({"path": str(path), "reason": "name_match"})

            text_content = ""
            if options.read_text:
                text_content = extract_text(path, ext, options.max_chars)

            signal = None
            if any(keyword in name_lower for keyword in DUE_KEYWORDS) or any(
                keyword in text_content.lower() for keyword in DUE_KEYWORDS
            ):
                due_date = parse_due_date(text_content + " " + name_lower)
                signal = FileSignal(
                    path=str(path),
                    reason="keyword_match",
                    due_date=due_date.date().isoformat() if due_date else None,
                )
                due_signals.append(signal)

            if signal:
                due_dt = parse_due_date(text_content + " " + name_lower)
                urgency = urgency_bucket(due_dt)
                proposed_tasks.append(
                    ProposedTask(
                        title=f"Review {infer_deliverable(path.name, text_content)}",
                        notes="Due signal detected in scanned content.",
                        due_date=due_dt.date().isoformat() if due_dt else None,
                        urgency=urgency,
                        priority=priority_from_urgency(urgency),
                    )
                )

    proposed_tasks.sort(key=lambda task: task_score(task.urgency, task.due_date, task.title))
    due_signals.sort(key=lambda signal: (signal.due_date or "9999-12-31", signal.path.lower()))
    hot_files.sort(key=lambda item: item.get("modified_at", ""), reverse=True)
    stale_candidates.sort(key=lambda item: item.get("modified_at", ""))
    junk_candidates.sort(key=lambda item: str(item.get("path", "")).lower())

    return scanned, hot_files, due_signals, stale_candidates, junk_candidates, proposed_tasks


@router.post("/tools/files/scan", response_model=ScanResponse)
def files_scan(payload: ScanRequest) -> ScanResponse:
    decision = enforce_file_scan(payload.paths)
    if not decision.allowed:
        raise HTTPException(status_code=403, detail=f"{decision.code}: {decision.reason}")

    scanned, hot_files, due_signals, stale_candidates, junk_candidates, proposed_tasks = scan_paths(
        payload.paths,
        payload.options,
    )
    return ScanResponse(
        scanned=scanned,
        hot_files=hot_files,
        due_signals=due_signals,
        stale_candidates=stale_candidates,
        junk_candidates=junk_candidates,
        proposed_tasks=proposed_tasks,
    )
