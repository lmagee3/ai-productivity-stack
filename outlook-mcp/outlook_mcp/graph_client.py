"""
Microsoft Graph API client.

Async HTTP client for all Graph API interactions.
Handles auth headers, error mapping, and retry logic.
"""

import asyncio
import json
from typing import Any, Optional

import httpx

from .auth import get_access_token

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# Retry config
MAX_RETRIES = 3
RETRY_BACKOFF = 1.0  # seconds


class GraphAPIError(Exception):
    """Structured error from Microsoft Graph API."""

    def __init__(self, status_code: int, message: str, code: str = ""):
        self.status_code = status_code
        self.code = code
        super().__init__(message)


async def graph_request(
    endpoint: str,
    method: str = "GET",
    params: Optional[dict] = None,
    json_body: Optional[dict] = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """
    Make an authenticated request to Microsoft Graph API.

    Args:
        endpoint: API path relative to v1.0 (e.g., "me/messages")
        method: HTTP method
        params: Query parameters
        json_body: JSON request body
        timeout: Request timeout in seconds

    Returns:
        Parsed JSON response as dict.

    Raises:
        GraphAPIError: On API errors with actionable messages.
    """
    token = get_access_token()
    url = f"{GRAPH_BASE}/{endpoint}"

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    params=params,
                    json=json_body,
                    timeout=timeout,
                )

                # Handle rate limiting with retry
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(retry_after)
                        continue
                    raise GraphAPIError(429, f"Rate limited. Try again in {retry_after}s.", "TooManyRequests")

                # Handle auth expiry — refresh and retry once
                if response.status_code == 401 and attempt == 0:
                    token = get_access_token()
                    continue

                # Raise on other errors
                if response.status_code >= 400:
                    _raise_graph_error(response)

                # Empty response (e.g., 204 No Content)
                if response.status_code == 204 or not response.content:
                    return {}

                return response.json()

        except httpx.TimeoutException:
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_BACKOFF * (attempt + 1))
                continue
            raise GraphAPIError(0, "Request timed out after multiple retries.", "Timeout")

        except httpx.ConnectError:
            raise GraphAPIError(0, "Cannot reach Microsoft Graph API. Check internet connection.", "ConnectionError")

    # Should not reach here, but just in case
    raise GraphAPIError(0, "Request failed after all retries.", "MaxRetriesExceeded")


def _raise_graph_error(response: httpx.Response) -> None:
    """Parse Graph API error response and raise a readable exception."""
    try:
        body = response.json()
        error = body.get("error", {})
        code = error.get("code", "Unknown")
        message = error.get("message", "Unknown error")
    except (json.JSONDecodeError, KeyError):
        code = "Unknown"
        message = response.text[:500]

    status = response.status_code
    error_map = {
        400: f"Bad request: {message}",
        401: "Authentication expired or invalid. Try restarting the server to re-authenticate.",
        403: f"Permission denied: {message}. Check your app's API permissions in Azure.",
        404: f"Not found: {message}. The email or folder may have been deleted or moved.",
        409: f"Conflict: {message}",
        500: "Microsoft Graph internal error. Try again in a moment.",
        503: "Microsoft Graph temporarily unavailable. Try again in a moment.",
    }

    human_message = error_map.get(status, f"Graph API error {status} ({code}): {message}")
    raise GraphAPIError(status, human_message, code)


def format_error(e: Exception) -> str:
    """Format any exception into a user-friendly error string."""
    if isinstance(e, GraphAPIError):
        return f"Error: {e}"
    if isinstance(e, httpx.TimeoutException):
        return "Error: Request timed out. Microsoft Graph may be slow — try again."
    if isinstance(e, httpx.ConnectError):
        return "Error: Cannot connect to Microsoft Graph. Check internet connection."
    return f"Error: {type(e).__name__}: {e}"
