# Notion Backend Integration Spec — For Codex

**Status**: Ready for Implementation
**Target**: FastAPI Backend (module_09)
**Audience**: Codex (OpenAI)
**Date Created**: Feb 13, 2026

---

## 1. Context

module_09 is a Tauri desktop app with a FastAPI backend (`app/` directory). Currently, the system has:
- Local SQLite database for caching
- Scheduler for automated jobs (file scans, email, news)
- Notion databases maintained manually by Lawrence

**Goal**: Wire Notion as a read-only data source. Sync two Notion databases into the local SQLite DB on a 4-hour interval. Expose tasks via REST API for the frontend (Mission Control dashboard) to consume.

**Non-scope**: Write-back to Notion, webhooks, vector embeddings, conflict resolution beyond "Notion wins on conflicts."

---

## 2. Notion API Details

**Base URL**: `https://api.notion.com/v1`

**Authentication**: Bearer token via environment variable
- Token name: `NOTION_TOKEN` (already defined in `config.py`)
- Expected format: `secret_XXXXXXXXXXXXX` (43+ characters)
- Source: Lawrence creates internal integration at `notion.so/my-integrations`

**Required Headers**:
```
Authorization: Bearer {NOTION_TOKEN}
Notion-Version: 2022-06-28
Content-Type: application/json
```

**Rate Limits**: 3 requests/second sustained. Sync jobs space requests 2+ seconds apart.

---

## 3. Database IDs & Properties

### 3.1 Productivity Dashboard
**Database ID**: `b1721831-1a6c-4f5e-9c41-5488941abd4c`

**Properties**:

| Property | Type | Extraction Pattern | Notes |
|----------|------|-------------------|-------|
| Task Name | title | `prop["title"][0]["plain_text"]` | Primary key. May have emoji prefix — strip it. |
| Status | status | `prop["status"]["name"]` | Values: Inbox, Doing, Blocked, Done |
| Domain | select | `prop["select"]["name"]` | Values: School, Personal, Kairos |
| Due Date | date | `prop["date"]["start"]` | ISO 8601 format. Nullable. |
| Priority | select | `prop["select"]["name"]` | Values: High, Medium, Low. Nullable = Medium. |

**⚠️ IMPORTANT**: There is a `Next Due Date` formula field — **IGNORE IT**. It returns a formula object, not a date. Only use `Due Date`.

---

### 3.2 Email Action Items
**Database ID**: `bc4d2a87-93fd-43ae-bc4c-d4bbefca5838`

**Properties**:

| Property | Type | Extraction Pattern | Notes |
|----------|------|-------------------|-------|
| Task | title | `prop["title"][0]["plain_text"]` | Primary key. May have emoji. |
| Status | status | `prop["status"]["name"]` | Values: To Reply, To Review, To Follow Up, Waiting on Response, In Progress, Completed, No Action Needed |
| Due Date | date | `prop["date"]["start"]` | ISO 8601 format. Nullable. |
| Priority | select | `prop["select"]["name"]` | Values: Critical, High, Medium, Low. |
| Source | rich_text | `prop["rich_text"][0]["plain_text"] if prop["rich_text"] else None` | Email sender or source label. |
| Notes | rich_text | `prop["rich_text"][0]["plain_text"] if prop["rich_text"] else None` | Context notes. |
| Email Link | url | `prop["url"]` | Direct mailto: or web link. |

---

## 4. Query Pattern

### Query Format

```
POST https://api.notion.com/v1/databases/{db_id}/query
```

**Headers**:
```
Authorization: Bearer {NOTION_TOKEN}
Notion-Version: 2022-06-28
Content-Type: application/json
```

**Request Body** (example — filter for non-empty task names):
```json
{
  "filter": {
    "property": "Task Name",
    "title": {
      "is_not_empty": true
    }
  },
  "sorts": [
    {
      "property": "last_edited_time",
      "direction": "descending"
    }
  ],
  "page_size": 100
}
```

**For Email DB**, use `"Task"` instead of `"Task Name"` in the filter property.

**Response Structure**:
```json
{
  "results": [
    {
      "id": "page-uuid",
      "last_edited_time": "2026-02-13T10:30:00.000Z",
      "properties": {
        "Task Name": { "id": "prop-id", "type": "title", "title": [...] },
        "Status": { "id": "prop-id", "type": "status", "status": {...} },
        ...
      }
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

---

## 5. Property Extraction & Normalization

### 5.1 Status Field Extraction

**⚠️ CRITICAL**: Both databases use `status` type, NOT `select`. The extraction differs:

```python
def extract_status(prop: dict) -> str | None:
    """
    Extract value from a 'status' type property.
    Returns the status name (e.g., "Inbox", "Doing", "Done").
    """
    st = prop.get("status")
    if st:
        return st.get("name")
    return None

# WRONG — this is for 'select' type, not 'status'
# value = prop.get("select", {}).get("name")
```

### 5.2 Title Extraction

```python
def extract_title(prop: dict) -> str:
    """Extract plain text from a title property."""
    titles = prop.get("title", [])
    if titles:
        return titles[0].get("plain_text", "")
    return ""
```

### 5.3 Status Normalization — Productivity DB

Map Notion status to internal normalized status:

| Notion Status | Normalized | Reason |
|--------------|-----------|--------|
| Inbox | `todo` | Unstarted tasks |
| Doing | `doing` | Active tasks |
| Blocked | `blocked` | Waiting on dependency |
| Done | `done` | Completed |

```python
PRODUCTIVITY_STATUS_MAP = {
    "Inbox": "todo",
    "Doing": "doing",
    "Blocked": "blocked",
    "Done": "done",
}
```

### 5.4 Status Normalization — Email DB

| Notion Status | Normalized | Reason |
|--------------|-----------|--------|
| To Reply | `todo` | Needs action |
| To Review | `todo` | Needs action |
| To Follow Up | `todo` | Needs action |
| Waiting on Response | `waiting` | Blocked by external party |
| In Progress | `doing` | Active |
| Completed | `done` | Done |
| No Action Needed | `done` | Done (no follow-up required) |

```python
EMAIL_STATUS_MAP = {
    "To Reply": "todo",
    "To Review": "todo",
    "To Follow Up": "todo",
    "Waiting on Response": "waiting",
    "In Progress": "doing",
    "Completed": "done",
    "No Action Needed": "done",
}
```

### 5.5 Priority Normalization

Both databases use the same priority scheme:

| Notion Priority | Normalized |
|----------------|-----------|
| Critical | `critical` |
| High | `high` |
| Medium | `medium` |
| Low | `low` |
| (missing/null) | `medium` (default) |

```python
PRIORITY_MAP = {
    "Critical": "critical",
    "High": "high",
    "Medium": "medium",
    "Low": "low",
}

def normalize_priority(notion_priority: str | None) -> str:
    return PRIORITY_MAP.get(notion_priority, "medium")
```

### 5.6 Task Name Cleaning

Some task names have emoji prefixes (e.g., `📧 Reply to recruiter`). Strip before storage:

```python
import re

def clean_task_name(name: str) -> str:
    """
    Remove leading emoji and whitespace from task name.
    Regex matches common emoji Unicode ranges.
    """
    # Unicode ranges for emoji
    emoji_pattern = r'^[\U0001F600-\U0001F9FF\U00002702-\U000027B0\U0000FE00-\U0000FE0F\s]+'
    cleaned = re.sub(emoji_pattern, '', name).strip()
    return cleaned if cleaned else name
```

---

## 6. Data Schema

### 6.1 Normalized Task Dataclass

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class NotionTask:
    """Normalized task from either Notion database."""
    notion_page_id: str           # Unique Notion page ID
    task_name: str                # Cleaned task name (emoji stripped)
    status: str                   # Normalized: todo, doing, blocked, waiting, done
    domain: str                   # Source domain: School, Personal, Kairos, Email
    due_date: Optional[str]       # ISO 8601 date string or None
    priority: str                 # Normalized: critical, high, medium, low
    source_db: str                # "productivity" or "email"
    source_url: Optional[str]     # Email Link (email DB only)
    notes: Optional[str]          # Notes field (email DB only)
    last_edited: str              # ISO 8601 timestamp from Notion
```

### 6.2 SQLAlchemy Model

```python
# File: app/models/notion_task.py

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func
from app.models.base import Base


class NotionTask(Base):
    """
    Synced task from Notion databases.
    Primary key: notion_page_id (unique constraint).
    Index on (status, priority, due_date) for fast filtering.
    """
    __tablename__ = "notion_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Unique identifier from Notion
    notion_page_id = Column(String(255), unique=True, nullable=False, index=True)

    # Task content
    task_name = Column(String(1024), nullable=False)
    status = Column(String(32), default="todo", nullable=False)  # todo, doing, blocked, waiting, done
    domain = Column(String(64), default="Personal", nullable=False)  # School, Personal, Kairos, Email
    due_date = Column(String(32), nullable=True)  # ISO 8601 date
    priority = Column(String(32), default="medium", nullable=False)  # critical, high, medium, low

    # Metadata
    source_db = Column(String(32), nullable=False)  # "productivity" or "email"
    source_url = Column(String(2048), nullable=True)  # Email link
    notes = Column(String(4096), nullable=True)  # Additional context

    # Timestamps
    notion_last_edited = Column(String(32), nullable=False)  # ISO 8601 from Notion
    synced_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_notion_tasks_status_priority", "status", "priority"),
        Index("ix_notion_tasks_due_date", "due_date"),
        Index("ix_notion_tasks_domain", "domain"),
    )
```

**Migration**:
```bash
alembic revision --autogenerate -m "add notion_tasks table"
alembic upgrade head
```

---

## 7. Backend Implementation

### 7.1 Notion Service Layer

```python
# File: app/services/notion_service.py

import httpx
import logging
from typing import Optional, List
from datetime import datetime
from app.config import settings
from app.models.notion_task import NotionTask as NotionTaskModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Status normalization maps
PRODUCTIVITY_STATUS_MAP = {
    "Inbox": "todo",
    "Doing": "doing",
    "Blocked": "blocked",
    "Done": "done",
}

EMAIL_STATUS_MAP = {
    "To Reply": "todo",
    "To Review": "todo",
    "To Follow Up": "todo",
    "Waiting on Response": "waiting",
    "In Progress": "doing",
    "Completed": "done",
    "No Action Needed": "done",
}

PRIORITY_MAP = {
    "Critical": "critical",
    "High": "high",
    "Medium": "medium",
    "Low": "low",
}


class NotionService:
    BASE_URL = "https://api.notion.com/v1"
    NOTION_VERSION = "2022-06-28"

    def __init__(self, token: str):
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": self.NOTION_VERSION,
            "Content-Type": "application/json",
        }

    async def query_database(self, db_id: str) -> List[dict]:
        """
        Query a Notion database for all non-empty tasks.
        Handles pagination internally.
        """
        tasks = []
        cursor = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                payload = {
                    "filter": {
                        "property": "Task Name" if db_id == settings.NOTION_PROD_DB_ID else "Task",
                        "title": {"is_not_empty": True},
                    },
                    "sorts": [{"property": "last_edited_time", "direction": "descending"}],
                    "page_size": 100,
                }

                if cursor:
                    payload["start_cursor"] = cursor

                try:
                    resp = await client.post(
                        f"{self.BASE_URL}/databases/{db_id}/query",
                        headers=self.headers,
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    tasks.extend(data.get("results", []))

                    if not data.get("has_more"):
                        break

                    cursor = data.get("next_cursor")
                except httpx.HTTPError as e:
                    logger.error(f"Notion query failed for DB {db_id}: {e}")
                    raise

        return tasks

    def normalize_task(
        self,
        page: dict,
        db_id: str,
    ) -> Optional[NotionTaskModel]:
        """
        Parse a Notion page into a normalized NotionTask.
        Returns None if parsing fails (partial task, missing required fields).
        """
        try:
            props = page.get("properties", {})
            notion_id = page.get("id")
            last_edited = page.get("last_edited_time")

            if not notion_id or not last_edited:
                return None

            # Determine source DB
            is_email_db = db_id == settings.NOTION_EMAIL_DB_ID
            source_db = "email" if is_email_db else "productivity"

            # Extract task name
            task_name_prop = props.get("Task" if is_email_db else "Task Name", {})
            task_name = self._extract_title(task_name_prop)
            if not task_name:
                logger.warning(f"Skipping page {notion_id}: empty task name")
                return None

            # Clean emoji
            task_name = self._clean_task_name(task_name)

            # Extract status
            status_prop = props.get("Status", {})
            status_raw = self._extract_status(status_prop)

            # Normalize status
            if is_email_db:
                status_map = EMAIL_STATUS_MAP
            else:
                status_map = PRODUCTIVITY_STATUS_MAP

            status = status_map.get(status_raw, "todo") if status_raw else "todo"

            # Extract domain (productivity DB only)
            domain = "Email" if is_email_db else "Personal"
            if not is_email_db:
                domain_prop = props.get("Domain", {})
                domain_raw = self._extract_select(domain_prop)
                domain = domain_raw if domain_raw else "Personal"

            # Extract due date
            due_date_prop = props.get("Due Date", {})
            due_date = self._extract_date(due_date_prop)

            # Extract priority
            priority_prop = props.get("Priority", {})
            priority_raw = self._extract_select(priority_prop)
            priority = PRIORITY_MAP.get(priority_raw, "medium") if priority_raw else "medium"

            # Extract source URL (email DB only)
            source_url = None
            if is_email_db:
                email_link_prop = props.get("Email Link", {})
                source_url = self._extract_url(email_link_prop)

            # Extract notes (email DB only)
            notes = None
            if is_email_db:
                notes_prop = props.get("Notes", {})
                notes = self._extract_rich_text(notes_prop)

            return NotionTaskModel(
                notion_page_id=notion_id,
                task_name=task_name,
                status=status,
                domain=domain,
                due_date=due_date,
                priority=priority,
                source_db=source_db,
                source_url=source_url,
                notes=notes,
                notion_last_edited=last_edited,
            )

        except Exception as e:
            logger.error(f"Failed to normalize page {page.get('id')}: {e}")
            return None

    # Property extraction helpers
    @staticmethod
    def _extract_title(prop: dict) -> str:
        titles = prop.get("title", [])
        return titles[0].get("plain_text", "") if titles else ""

    @staticmethod
    def _extract_status(prop: dict) -> Optional[str]:
        st = prop.get("status")
        return st.get("name") if st else None

    @staticmethod
    def _extract_select(prop: dict) -> Optional[str]:
        sel = prop.get("select")
        return sel.get("name") if sel else None

    @staticmethod
    def _extract_date(prop: dict) -> Optional[str]:
        date_obj = prop.get("date")
        return date_obj.get("start") if date_obj else None

    @staticmethod
    def _extract_url(prop: dict) -> Optional[str]:
        return prop.get("url")

    @staticmethod
    def _extract_rich_text(prop: dict) -> Optional[str]:
        rich_texts = prop.get("rich_text", [])
        return rich_texts[0].get("plain_text", "") if rich_texts else None

    @staticmethod
    def _clean_task_name(name: str) -> str:
        import re
        emoji_pattern = r'^[\U0001F600-\U0001F9FF\U00002702-\U000027B0\U0000FE00-\U0000FE0F\s]+'
        cleaned = re.sub(emoji_pattern, '', name).strip()
        return cleaned if cleaned else name


async def sync_notion_tasks(db: Session) -> dict:
    """
    Orchestrate full sync: query both DBs, normalize, upsert.
    Returns metadata: {"synced": count, "errors": [...], "timestamp": "..."}
    """
    if not settings.NOTION_TOKEN:
        logger.error("NOTION_TOKEN not set")
        return {"synced": 0, "errors": ["NOTION_TOKEN not configured"], "timestamp": datetime.utcnow().isoformat()}

    service = NotionService(settings.NOTION_TOKEN)
    synced_count = 0
    errors = []

    # Sync both databases
    for db_name, db_id in [
        ("productivity", settings.NOTION_PROD_DB_ID),
        ("email", settings.NOTION_EMAIL_DB_ID),
    ]:
        try:
            logger.info(f"Syncing {db_name} database...")
            pages = await service.query_database(db_id)

            for page in pages:
                task = service.normalize_task(page, db_id)
                if task:
                    # Upsert: find by notion_page_id, update or insert
                    existing = db.query(NotionTaskModel).filter_by(
                        notion_page_id=task.notion_page_id
                    ).first()

                    if existing:
                        # Update existing
                        for key, value in vars(task).items():
                            setattr(existing, key, value)
                        db.add(existing)
                    else:
                        # Insert new
                        db.add(task)

                    synced_count += 1

            db.commit()
            logger.info(f"✓ Synced {synced_count} tasks from {db_name}")

        except Exception as e:
            db.rollback()
            error_msg = f"{db_name} sync failed: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

    return {
        "synced": synced_count,
        "errors": errors,
        "timestamp": datetime.utcnow().isoformat(),
    }
```

### 7.2 API Routes

```python
# File: app/api/notion.py

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.notion_task import NotionTask as NotionTaskModel
from app.services.notion_service import sync_notion_tasks
from app.auth import verify_api_key
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/sync")
async def sync_notion(
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
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
    try:
        result = await sync_notion_tasks(db)
        return result
    except Exception as e:
        logger.error(f"Notion sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/tasks")
async def get_notion_tasks(
    status: str = Query(None, description="Filter by status: todo, doing, blocked, waiting, done"),
    domain: str = Query(None, description="Filter by domain: School, Personal, Kairos, Email"),
    priority: str = Query(None, description="Filter by priority: critical, high, medium, low"),
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
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
    query = db.query(NotionTaskModel)

    if status:
        query = query.filter(NotionTaskModel.status == status)
    if domain:
        query = query.filter(NotionTaskModel.domain == domain)
    if priority:
        query = query.filter(NotionTaskModel.priority == priority)

    # Default: exclude done tasks, sort by priority then due date
    if not status:
        query = query.filter(NotionTaskModel.status != "done")

    tasks = query.order_by(
        NotionTaskModel.priority.desc(),
        NotionTaskModel.due_date.asc(),
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
```

---

## 8. Scheduler Integration

```python
# File: app/automation/automation_runtime.py
# Add to existing scheduler setup

from app.services.notion_service import sync_notion_tasks
from sqlalchemy.orm import Session
from app.database import SessionLocal
import logging

logger = logging.getLogger(__name__)


async def run_notion_sync():
    """Scheduled job: sync Notion databases every 4 hours."""
    db = SessionLocal()
    try:
        result = await sync_notion_tasks(db)
        logger.info(f"Notion sync job completed: {result}")
    except Exception as e:
        logger.error(f"Notion sync job failed: {e}")
    finally:
        db.close()


# In the scheduler initialization (e.g., in main.py or scheduler config):

scheduler.add_job(
    run_notion_sync,
    trigger="interval",
    hours=4,  # 4-hour sync interval (configurable via settings.NOTION_SYNC_INTERVAL)
    id="notion_sync",
    name="Notion DB Sync",
    replace_existing=True,
)
```

---

## 9. Execution Policy & Configuration

### 9.1 Update Execution Policy

```python
# File: app/execution/execution_policy.py

SAFE_TOOLS = [
    "file.search",
    "files.scan",
    "email.fetch",
    "news.headlines",
    "ops.summary",
    "notion.sync",  # ADD THIS LINE
]
```

### 9.2 Environment Configuration

```python
# File: app/config.py
# Add these fields to the Settings class

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ... existing fields ...

    # Notion integration
    NOTION_TOKEN: str = ""  # secret_XXXXX... from notion.so/my-integrations
    NOTION_PROD_DB_ID: str = "b1721831-1a6c-4f5e-9c41-5488941abd4c"
    NOTION_EMAIL_DB_ID: str = "bc4d2a87-93fd-43ae-bc4c-d4bbefca5838"
    NOTION_SYNC_INTERVAL: int = 240  # minutes (4 hours)

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

### 9.3 .env Template

```bash
# Add to .env
NOTION_TOKEN=secret_your_token_here_from_notion_integrations
```

---

## 10. Main Router Registration

```python
# File: app/main.py
# In the FastAPI app initialization, add:

from app.api import notion

app = FastAPI(title="module_09 API")

# ... existing router includes ...

app.include_router(notion.router, prefix="/notion", tags=["notion"])
```

---

## 11. Testing

### 11.1 Manual Sync Test

```bash
# Trigger a sync
curl -X POST http://localhost:8000/notion/sync \
  -H "X-API-Key: $MODULE09_API_KEY" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "synced": 42,
#   "errors": [],
#   "timestamp": "2026-02-13T14:30:00.000000"
# }
```

### 11.2 Query Test

```bash
# Get all high-priority Kairos tasks
curl "http://localhost:8000/notion/tasks?domain=Kairos&priority=high" \
  -H "X-API-Key: $MODULE09_API_KEY"

# Get all todo items
curl "http://localhost:8000/notion/tasks?status=todo" \
  -H "X-API-Key: $MODULE09_API_KEY"

# Get email tasks only
curl "http://localhost:8000/notion/tasks?domain=Email" \
  -H "X-API-Key: $MODULE09_API_KEY"
```

### 11.3 Database Query Test

```python
# From a Python shell (in app context):
from app.database import SessionLocal
from app.models.notion_task import NotionTask

db = SessionLocal()
tasks = db.query(NotionTask).filter(NotionTask.status == "todo").all()
for t in tasks:
    print(f"{t.task_name} [{t.priority}] due {t.due_date}")
db.close()
```

---

## 12. Prerequisites — Lawrence Actions

Before Codex can implement, Lawrence must:

1. **Create Notion Integration**
   - Go to: `https://notion.so/my-integrations`
   - Click "Create new integration"
   - Name: `module_09-sync` or similar
   - Copy the **Internal Integration Token** (starts with `secret_`)

2. **Set Token in .env**
   ```bash
   export NOTION_TOKEN="secret_XXXXXXXXXXXXX"
   ```
   Or update `.env` file directly.

3. **Grant Database Access**
   - Open Notion → **Productivity Dashboard**
   - Click `...` (menu) → **Connections** → Add `module_09-sync` integration
   - Repeat for **Email Action Items** database

4. **Test Token**
   ```bash
   curl https://api.notion.com/v1/users/me \
     -H "Authorization: Bearer secret_XXXXXXXXXXXXX" \
     -H "Notion-Version: 2022-06-28"
   # Should return bot user info
   ```

---

## 13. Implementation Checklist

Codex, complete in this order:

- [ ] **Models**: Create `app/models/notion_task.py` with SQLAlchemy model
- [ ] **Migration**: Run `alembic revision --autogenerate -m "add notion_tasks table"`
- [ ] **Service**: Create `app/services/notion_service.py` with NotionService class and sync function
- [ ] **Routes**: Create `app/api/notion.py` with `/sync` and `/tasks` endpoints
- [ ] **Config**: Update `app/config.py` with Notion settings
- [ ] **Scheduler**: Wire sync job into `automation_runtime.py`
- [ ] **Policy**: Update `execution_policy.py` to include `notion.sync` in SAFE_TOOLS
- [ ] **Routes**: Register router in `app/main.py`
- [ ] **Testing**: Run manual curl tests above
- [ ] **Backbrief**: Write completion summary to `module_09/handoffs/CODEX_BACKBRIEF_NOTION.md`

---

## 14. Non-Scope (Do Not Build)

- ✗ Write-back to Notion (read-only only)
- ✗ Webhook listener (polling via scheduler)
- ✗ Vector embeddings or semantic search
- ✗ Conflict resolution beyond "last Notion edit wins"
- ✗ UI components (Claude Cowork owns frontend)
- ✗ Task creation from backend
- ✗ Archived page handling (ignore archived pages)

---

## 15. Questions for Codex

If unclear on any implementation detail:
1. Check the examples in sections 4–7
2. Refer to existing route patterns in `app/api/`
3. Ask for clarification via backbrief in `module_09/handoffs/`

**Handoff complete. Ready to build.**
