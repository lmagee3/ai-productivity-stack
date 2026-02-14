from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(tags=["tools"])


class SearchResult(BaseModel):
    title: str
    snippet: str
    url: str


class WebSearchResponse(BaseModel):
    provider: str
    query: str
    results: list[SearchResult]
    stale: bool = False
    updated_at: str


def _search_duckduckgo(query: str, limit: int) -> list[SearchResult]:
    with httpx.Client(timeout=8.0, follow_redirects=True) as client:
        response = client.get("https://api.duckduckgo.com/", params={"q": query, "format": "json", "no_html": 1})
        response.raise_for_status()
        payload = response.json()

    rows: list[SearchResult] = []
    items = payload.get("RelatedTopics", []) or []
    for item in items:
        if "Topics" in item:
            for topic in item.get("Topics", []):
                if topic.get("FirstURL") and topic.get("Text"):
                    rows.append(SearchResult(title=topic["Text"][:120], snippet=topic["Text"], url=topic["FirstURL"]))
        elif item.get("FirstURL") and item.get("Text"):
            rows.append(SearchResult(title=item["Text"][:120], snippet=item["Text"], url=item["FirstURL"]))
        if len(rows) >= limit:
            break
    return rows[:limit]


def _search_searxng(query: str, limit: int, base_url: str) -> list[SearchResult]:
    with httpx.Client(timeout=8.0, follow_redirects=True) as client:
        response = client.get(
            f"{base_url.rstrip('/')}/search",
            params={"q": query, "format": "json", "safesearch": 1},
        )
        response.raise_for_status()
        payload = response.json()
    return [
        SearchResult(
            title=item.get("title", "")[:180],
            snippet=item.get("content", ""),
            url=item.get("url", ""),
        )
        for item in (payload.get("results") or [])[:limit]
        if item.get("url")
    ]


def _search_brave(query: str, limit: int, api_key: str) -> list[SearchResult]:
    with httpx.Client(timeout=8.0, follow_redirects=True) as client:
        response = client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": limit},
            headers={"Accept": "application/json", "X-Subscription-Token": api_key},
        )
        response.raise_for_status()
        payload = response.json()
    items = payload.get("web", {}).get("results", [])
    return [
        SearchResult(
            title=item.get("title", "")[:180],
            snippet=item.get("description", ""),
            url=item.get("url", ""),
        )
        for item in items[:limit]
        if item.get("url")
    ]


@router.get("/tools/web-search", response_model=WebSearchResponse)
def web_search(
    q: str = Query(..., min_length=2),
    limit: int = Query(default=5, ge=1, le=10),
) -> WebSearchResponse:
    settings = get_settings()
    provider = settings.WEB_SEARCH_PROVIDER.lower().strip()
    rows: list[SearchResult] = []
    stale = False

    try:
        if provider == "brave" and settings.BRAVE_SEARCH_API_KEY:
            rows = _search_brave(q, limit, settings.BRAVE_SEARCH_API_KEY)
            provider_name = "brave"
        elif provider == "searxng" and settings.SEARXNG_BASE_URL:
            rows = _search_searxng(q, limit, settings.SEARXNG_BASE_URL)
            provider_name = "searxng"
        else:
            rows = _search_duckduckgo(q, limit)
            provider_name = "duckduckgo"
    except Exception:
        rows = []
        stale = True
        provider_name = provider or "duckduckgo"

    return WebSearchResponse(
        provider=provider_name,
        query=q,
        results=rows,
        stale=stale,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
