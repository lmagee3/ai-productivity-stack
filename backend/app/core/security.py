from __future__ import annotations

from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from app.core.config import get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(api_key_header)) -> None:
    settings = get_settings()
    if not settings.API_KEY:
        raise HTTPException(status_code=500, detail="API key not configured")
    if api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
