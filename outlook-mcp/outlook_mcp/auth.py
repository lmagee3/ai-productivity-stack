"""
MSAL authentication for Microsoft Graph API.

Uses device code flow for first-time auth (headless/terminal friendly),
then silent token refresh via persisted cache for subsequent runs.
"""

import json
import os
import sys
import msal

SCOPES = ["Mail.Read", "Mail.ReadWrite", "Mail.Send", "User.Read"]
CACHE_FILE = os.path.expanduser("~/.outlook-mcp-token-cache.json")

# Personal Microsoft accounts use /consumers authority
AUTHORITY = "https://login.microsoftonline.com/consumers"


def _get_client_id() -> str:
    """Get client ID from environment."""
    client_id = os.environ.get("OUTLOOK_CLIENT_ID")
    if not client_id:
        raise RuntimeError(
            "OUTLOOK_CLIENT_ID environment variable not set. "
            "Register an app at https://entra.microsoft.com and set the client ID."
        )
    return client_id


def _load_cache() -> msal.SerializableTokenCache:
    """Load token cache from disk."""
    cache = msal.SerializableTokenCache()
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            cache.deserialize(f.read())
    return cache


def _save_cache(cache: msal.SerializableTokenCache) -> None:
    """Persist token cache to disk if changed."""
    if cache.has_state_changed:
        with open(CACHE_FILE, "w") as f:
            f.write(cache.serialize())


def _get_msal_app(cache: msal.SerializableTokenCache) -> msal.PublicClientApplication:
    """Create MSAL public client application."""
    return msal.PublicClientApplication(
        client_id=_get_client_id(),
        authority=AUTHORITY,
        token_cache=cache,
    )


def get_access_token() -> str:
    """
    Get a valid access token for Microsoft Graph API.

    First attempts silent token acquisition from cache.
    Falls back to device code flow if no cached token exists.

    Returns:
        str: A valid Bearer access token.

    Raises:
        RuntimeError: If authentication fails.
    """
    cache = _load_cache()
    app = _get_msal_app(cache)

    # Try silent auth first (cached token or refresh token)
    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            _save_cache(cache)
            return result["access_token"]

    # Fall back to device code flow
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        raise RuntimeError(f"Device flow initiation failed: {json.dumps(flow, indent=2)}")

    # Print instructions for the user
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"  OUTLOOK MCP — First-time authentication required", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"  1. Open: {flow['verification_uri']}", file=sys.stderr)
    print(f"  2. Enter code: {flow['user_code']}", file=sys.stderr)
    print(f"  3. Sign in with your Microsoft account", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)

    # Block until user completes auth (timeout from flow, usually 15 min)
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" in result:
        _save_cache(cache)
        return result["access_token"]

    error = result.get("error_description", result.get("error", "Unknown error"))
    raise RuntimeError(f"Authentication failed: {error}")


def clear_token_cache() -> bool:
    """Remove cached tokens, forcing re-authentication on next use."""
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
        return True
    return False
