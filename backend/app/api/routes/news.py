from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(tags=["news"])

FEEDS: list[tuple[str, str]] = [
    ("Reuters World", "https://feeds.reuters.com/reuters/worldNews"),
    ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
    ("TechCrunch", "https://techcrunch.com/feed/"),
]

FALLBACK_HEADLINES = [
    {"title": "Markets remain range-bound ahead of key macro data", "source": "system", "url": "", "published_at": None},
    {"title": "AI tooling continues shift toward local-first workflows", "source": "system", "url": "", "published_at": None},
    {"title": "Operational discipline beats feature sprawl in early-stage products", "source": "system", "url": "", "published_at": None},
]


class Headline(BaseModel):
    title: str
    source: str
    url: str
    published_at: str | None = None


class HeadlineResponse(BaseModel):
    updated_at: str
    headlines: list[Headline]
    stale: bool = False


def _parse_items(feed_name: str, xml_text: str, max_items: int) -> list[dict[str, Any]]:
    root = ElementTree.fromstring(xml_text)
    items: list[dict[str, Any]] = []
    for item in root.findall(".//item")[:max_items]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip() or None
        if title:
            items.append(
                {
                    "title": title,
                    "source": feed_name,
                    "url": link,
                    "published_at": pub_date,
                }
            )
    return items


@router.get("/news/headlines", response_model=HeadlineResponse)
def get_headlines(limit: int = Query(default=12, ge=3, le=30)) -> HeadlineResponse:
    headlines: list[dict[str, Any]] = []
    per_feed = max(1, limit // len(FEEDS))

    for feed_name, url in FEEDS:
        try:
            with httpx.Client(timeout=3.5, follow_redirects=True) as client:
                response = client.get(url)
                response.raise_for_status()
                headlines.extend(_parse_items(feed_name, response.text, per_feed))
        except Exception:
            continue

    updated_at = datetime.now(timezone.utc).isoformat()
    if not headlines:
        return HeadlineResponse(updated_at=updated_at, headlines=FALLBACK_HEADLINES, stale=True)

    return HeadlineResponse(updated_at=updated_at, headlines=headlines[:limit], stale=False)

