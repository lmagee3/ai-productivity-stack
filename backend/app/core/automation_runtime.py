from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from app.api.routes.files_scan import ScanOptions, scan_paths
from app.api.routes.ingest_connectors import EmailFetchRequest, ingest_email_fetch
from app.api.routes.news import get_headlines
from app.core.config import get_settings
from app.core.execution_policy import enforce_file_scan
from app.services.task_ingest import upsert_tasks_from_items


@dataclass
class RuntimeState:
    runtime_started_at: str | None = None
    runtime_heartbeat_at: str | None = None
    scan_last_run: str | None = None
    email_last_run: str | None = None
    news_last_run: str | None = None
    scan_last_error: str | None = None
    email_last_error: str | None = None
    news_last_error: str | None = None
    scan_last_created: int = 0
    email_last_created: int = 0


STATE = RuntimeState()
_THREAD: threading.Thread | None = None
_STOP = threading.Event()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _scan_paths_from_settings() -> list[str]:
    raw = get_settings().AUTO_SCAN_PATHS
    return [item.strip() for item in raw.split(",") if item.strip()]


def _run_scan() -> None:
    settings = get_settings()
    paths = _scan_paths_from_settings()
    decision = enforce_file_scan(paths)
    if not decision.allowed:
        STATE.scan_last_error = f"{decision.code}: {decision.reason}"
        return
    _, _, _, _, _, proposed = scan_paths(paths, ScanOptions())
    created = upsert_tasks_from_items(
        [{"title": p.title, "due_date": p.due_date, "url": None} for p in proposed],
        source="files",
    )
    STATE.scan_last_created = created
    STATE.scan_last_run = _now_iso()
    STATE.scan_last_error = None


def _run_email_sync() -> None:
    settings = get_settings()
    response = ingest_email_fetch(EmailFetchRequest(limit=settings.AUTO_EMAIL_SYNC_LIMIT, mailbox=None))
    proposed = []
    for item in response.items:
        for task in item.proposed_tasks:
            proposed.append({"title": task.title, "due_date": task.due_date, "url": None})
    created = upsert_tasks_from_items(proposed, source="email")
    STATE.email_last_created = created
    STATE.email_last_run = _now_iso()
    STATE.email_last_error = None


def _run_news_refresh() -> None:
    get_headlines(limit=12)
    STATE.news_last_run = _now_iso()
    STATE.news_last_error = None


def _loop() -> None:
    STATE.runtime_started_at = _now_iso()
    next_scan = 0.0
    next_email = 0.0
    next_news = 0.0
    while not _STOP.is_set():
        settings = get_settings()
        STATE.runtime_heartbeat_at = _now_iso()
        now = time.time()
        if settings.AUTO_SCAN_ENABLED and now >= next_scan:
            try:
                _run_scan()
            except Exception as exc:
                STATE.scan_last_error = str(exc)
            next_scan = now + max(1, settings.AUTO_SCAN_INTERVAL_MIN) * 60

        if settings.AUTO_EMAIL_SYNC_ENABLED and now >= next_email:
            try:
                _run_email_sync()
            except Exception as exc:
                STATE.email_last_error = str(exc)
            next_email = now + max(1, settings.AUTO_EMAIL_SYNC_INTERVAL_MIN) * 60

        if now >= next_news:
            try:
                _run_news_refresh()
            except Exception as exc:
                STATE.news_last_error = str(exc)
            next_news = now + max(1, settings.AUTO_NEWS_REFRESH_MIN) * 60

        _STOP.wait(5)


def run_scan_once() -> None:
    _run_scan()


def run_email_sync_once() -> None:
    _run_email_sync()


def run_news_refresh_once() -> None:
    _run_news_refresh()


def start_runtime() -> None:
    global _THREAD
    if _THREAD and _THREAD.is_alive():
        return
    _STOP.clear()
    # Kick once at startup so status reflects activity quickly.
    try:
        _run_news_refresh()
    except Exception as exc:
        STATE.news_last_error = str(exc)
    settings = get_settings()
    if settings.AUTO_SCAN_ENABLED:
        try:
            _run_scan()
        except Exception as exc:
            STATE.scan_last_error = str(exc)
    if settings.AUTO_EMAIL_SYNC_ENABLED:
        try:
            _run_email_sync()
        except Exception as exc:
            STATE.email_last_error = str(exc)
    _THREAD = threading.Thread(target=_loop, daemon=True, name="module09-runtime")
    _THREAD.start()


def stop_runtime() -> None:
    _STOP.set()
