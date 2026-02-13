import re
import logging
from typing import Optional
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.notion_task import NotionTask

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

    async def query_database(self, db_id: str, title_property: str) -> list[dict]:
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
                        "property": title_property,
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
    ) -> Optional[NotionTask]:
        """
        Parse a Notion page into a normalized NotionTask.
        Returns None if parsing fails (partial task, missing required fields).
        """
        settings = get_settings()
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

            return NotionTask(
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
        emoji_pattern = r'^[\U0001F600-\U0001F9FF\U00002702-\U000027B0\U0000FE00-\U0000FE0F\s]+'
        cleaned = re.sub(emoji_pattern, '', name).strip()
        return cleaned if cleaned else name


async def sync_notion_tasks(db: Session) -> dict:
    """
    Orchestrate full sync: query both DBs, normalize, upsert.
    Returns metadata: {"synced": count, "errors": [...], "timestamp": "..."}
    """
    settings = get_settings()

    if not settings.NOTION_TOKEN:
        logger.error("NOTION_TOKEN not set")
        return {"synced": 0, "errors": ["NOTION_TOKEN not configured"], "timestamp": datetime.utcnow().isoformat()}

    service = NotionService(settings.NOTION_TOKEN)
    synced_count = 0
    errors = []

    # Sync both databases
    for db_name, db_id, title_prop in [
        ("productivity", settings.NOTION_PROD_DB_ID, "Task Name"),
        ("email", settings.NOTION_EMAIL_DB_ID, "Task"),
    ]:
        try:
            logger.info(f"Syncing {db_name} database...")
            pages = await service.query_database(db_id, title_prop)

            for page in pages:
                task = service.normalize_task(page, db_id)
                if task:
                    # Upsert: find by notion_page_id, update or insert
                    existing = db.query(NotionTask).filter_by(
                        notion_page_id=task.notion_page_id
                    ).first()

                    if existing:
                        # Update existing
                        existing.task_name = task.task_name
                        existing.status = task.status
                        existing.domain = task.domain
                        existing.due_date = task.due_date
                        existing.priority = task.priority
                        existing.source_db = task.source_db
                        existing.source_url = task.source_url
                        existing.notes = task.notes
                        existing.notion_last_edited = task.notion_last_edited
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
