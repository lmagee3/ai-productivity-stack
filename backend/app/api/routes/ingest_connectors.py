from __future__ import annotations

import re
import imaplib
from datetime import datetime, timezone
from html import unescape
from typing import Any, Literal
from email import message_from_bytes
from email.message import Message

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.priority import urgency_score

router = APIRouter(tags=["ingest"])

DUE_HINTS = ("due", "deadline", "submit", "assignment", "discussion", "quiz", "exam", "project")
NOISE_SUBJECT_HINTS = ("security alert", "new jobs for", "password", "sign-in", "login attempt")
ACADEMIC_HINTS = ("assignment", "discussion", "quiz", "exam", "module", "week", "canvas", "blackboard", "syllabus")
WORK_HINTS = ("action required", "invoice", "meeting", "proposal", "deliverable", "review")


class ProposedTask(BaseModel):
    title: str
    summary: str
    due_date: str | None = None
    priority: Literal["low", "medium", "high", "critical"]
    source: Literal["email", "web"]


class EmailIngestRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=255)
    from_email: str | None = None
    received_at: str | None = None
    body: str = Field(min_length=1, max_length=50000)
    url: str | None = None


class WebIngestRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    html: str | None = Field(default=None, max_length=200000)
    max_chars: int = Field(default=12000, ge=500, le=100000)


class IngestResponse(BaseModel):
    source: Literal["email", "web"]
    summary: str
    due_date: str | None = None
    priority: Literal["low", "medium", "high", "critical"] = "low"
    proposed_tasks: list[ProposedTask]
    dry_run: bool = True


class EmailFetchRequest(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)
    mailbox: str | None = None


class EmailFetchedItem(BaseModel):
    uid: str
    subject: str
    from_email: str | None = None
    received_at: str | None = None
    summary: str
    priority: Literal["low", "medium", "high", "critical"]
    due_date: str | None = None
    proposed_tasks: list[ProposedTask]


class EmailFetchResponse(BaseModel):
    source: Literal["email"] = "email"
    count: int
    mailbox: str
    dry_run: bool = True
    items: list[EmailFetchedItem]


def _parse_due_date(text: str) -> datetime | None:
    if not text:
        return None
    iso_match = re.search(r"\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b", text)
    if iso_match:
        year, month, day = map(int, iso_match.groups())
        try:
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return None

    us_match = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b", text)
    if us_match:
        month = int(us_match.group(1))
        day = int(us_match.group(2))
        year = int(us_match.group(3)) if us_match.group(3) else datetime.now(timezone.utc).year
        try:
            return datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _strip_html(html: str, max_chars: int) -> str:
    cleaned = re.sub(r"<script.*?>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<style.*?>.*?</style>", " ", cleaned, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", unescape(cleaned)).strip()
    return cleaned[:max_chars]


def _summarize(source: Literal["email", "web"], title: str, text: str, url: str | None) -> IngestResponse:
    due_dt = _parse_due_date(f"{title} {text}")
    urgency = urgency_score(due_dt)
    summary = f"{title} · priority {urgency.priority}"
    if due_dt:
        summary = f"{summary} · due {due_dt.date().isoformat()}"
    if not any(hint in f"{title} {text}".lower() for hint in DUE_HINTS):
        return IngestResponse(source=source, summary=summary, due_date=due_dt.date().isoformat() if due_dt else None, priority=urgency.priority, proposed_tasks=[])

    task_title = title if source == "email" else f"Review web item: {title}"
    task_summary = "Action likely required based on due/deadline signals."
    if url:
        task_summary = f"{task_summary} Source: {url}"

    task = ProposedTask(
        title=task_title[:255],
        summary=task_summary,
        due_date=due_dt.date().isoformat() if due_dt else None,
        priority=urgency.priority,
        source=source,
    )
    return IngestResponse(
        source=source,
        summary=summary,
        due_date=task.due_date,
        priority=task.priority,
        proposed_tasks=[task],
    )


def _csv_to_set(raw: str | None) -> set[str]:
    if not raw:
        return set()
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def _extract_domain(sender: str | None) -> str | None:
    if not sender:
        return None
    match = re.search(r"@([A-Za-z0-9.-]+\.[A-Za-z]{2,})", sender)
    if not match:
        return None
    return match.group(1).lower()


def _is_noise_email(subject: str, sender: str | None, settings: Any) -> bool:
    lowered = subject.lower()
    if any(hint in lowered for hint in NOISE_SUBJECT_HINTS):
        return True
    sender_l = (sender or "").lower()
    if "no-reply@accounts.google.com" in sender_l or "notify-noreply@google.com" in sender_l:
        return True

    deny_senders = _csv_to_set(settings.EMAIL_DENYLIST_SENDERS)
    if any(item in sender_l for item in deny_senders):
        return True

    deny_subjects = _csv_to_set(settings.EMAIL_DENYLIST_SUBJECTS)
    if any(item in lowered for item in deny_subjects):
        return True

    allow_domains = _csv_to_set(settings.EMAIL_ALLOWLIST_DOMAINS)
    if allow_domains:
        domain = _extract_domain(sender)
        if not domain or domain not in allow_domains:
            return True

    return False


def _priority_boost(subject: str, body: str, sender: str | None, current: Literal["low", "medium", "high", "critical"]) -> Literal["low", "medium", "high", "critical"]:
    if current in {"high", "critical"}:
        return current
    haystack = f"{subject} {body} {(sender or '')}".lower()
    if any(token in haystack for token in ACADEMIC_HINTS):
        return "high" if current == "medium" else "medium"
    if any(token in haystack for token in WORK_HINTS):
        return "medium" if current == "low" else current
    return current


def _extract_text_from_message(msg: Message, max_chars: int = 12000) -> str:
    if msg.is_multipart():
        parts: list[str] = []
        size = 0
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type not in {"text/plain", "text/html"}:
                continue
            payload = part.get_payload(decode=True) or b""
            charset = part.get_content_charset() or "utf-8"
            try:
                text = payload.decode(charset, errors="ignore")
            except Exception:
                text = payload.decode("utf-8", errors="ignore")
            if content_type == "text/html":
                text = _strip_html(text, max_chars)
            remaining = max_chars - size
            if remaining <= 0:
                break
            text = text[:remaining]
            parts.append(text)
            size += len(text)
        return "\n".join(parts)

    payload = msg.get_payload(decode=True) or b""
    charset = msg.get_content_charset() or "utf-8"
    try:
        text = payload.decode(charset, errors="ignore")
    except Exception:
        text = payload.decode("utf-8", errors="ignore")
    if msg.get_content_type() == "text/html":
        text = _strip_html(text, max_chars)
    return text[:max_chars]


@router.post("/ingest/email", response_model=IngestResponse)
def ingest_email(payload: EmailIngestRequest) -> IngestResponse:
    title = payload.subject.strip()
    text = payload.body.strip()
    return _summarize("email", title, text, payload.url)


@router.post("/ingest/web", response_model=IngestResponse)
def ingest_web(payload: WebIngestRequest) -> IngestResponse:
    html = payload.html
    if not html:
        try:
            with httpx.Client(timeout=6.0, follow_redirects=True) as client:
                response = client.get(payload.url)
                response.raise_for_status()
                html = response.text
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {exc}") from exc

    text = _strip_html(html, payload.max_chars)
    title_match = re.search(r"<title>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    title = unescape(title_match.group(1)).strip() if title_match else payload.url
    return _summarize("web", title, text, payload.url)


@router.post("/ingest/email/fetch", response_model=EmailFetchResponse)
def ingest_email_fetch(payload: EmailFetchRequest) -> EmailFetchResponse:
    settings = get_settings()
    if not settings.EMAIL_READ_ENABLED:
        raise HTTPException(status_code=403, detail="Email read connector is disabled")

    if not settings.EMAIL_IMAP_HOST or not settings.EMAIL_IMAP_USER or not settings.EMAIL_IMAP_PASSWORD:
        raise HTTPException(status_code=500, detail="Email IMAP settings are incomplete")

    mailbox = payload.mailbox or settings.EMAIL_IMAP_MAILBOX
    items: list[EmailFetchedItem] = []

    try:
        with imaplib.IMAP4_SSL(settings.EMAIL_IMAP_HOST, settings.EMAIL_IMAP_PORT) as conn:
            conn.login(settings.EMAIL_IMAP_USER, settings.EMAIL_IMAP_PASSWORD)
            status, _ = conn.select(mailbox, readonly=True)
            if status != "OK":
                raise HTTPException(status_code=400, detail=f"Unable to select mailbox: {mailbox}")

            status, data = conn.uid("search", None, "ALL")
            if status != "OK":
                raise HTTPException(status_code=400, detail="Unable to search mailbox")

            uids = [u for u in (data[0].decode("utf-8").split() if data and data[0] else []) if u]
            for uid in reversed(uids[-payload.limit:]):
                status, msg_data = conn.uid("fetch", uid, "(RFC822)")
                if status != "OK" or not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = message_from_bytes(raw)
                subject = str(msg.get("Subject", "(no subject)"))
                from_email = str(msg.get("From", "")) or None
                received_at = str(msg.get("Date", "")) or None
                body = _extract_text_from_message(msg)
                if _is_noise_email(subject, from_email, settings):
                    continue
                summarized = _summarize("email", subject, body, None)
                boosted_priority = _priority_boost(subject, body, from_email, summarized.priority)
                tasks = [
                    ProposedTask(
                        title=task.title,
                        summary=task.summary,
                        due_date=task.due_date,
                        priority=boosted_priority if task.priority in {"low", "medium"} else task.priority,
                        source=task.source,
                    )
                    for task in summarized.proposed_tasks
                ]
                items.append(
                    EmailFetchedItem(
                        uid=uid,
                        subject=subject,
                        from_email=from_email,
                        received_at=received_at,
                        summary=summarized.summary,
                        priority=boosted_priority,
                        due_date=summarized.due_date,
                        proposed_tasks=tasks,
                    )
                )
    except imaplib.IMAP4.error as exc:
        raise HTTPException(status_code=401, detail=f"IMAP auth/read error: {exc}") from exc

    return EmailFetchResponse(count=len(items), mailbox=mailbox, items=items)
