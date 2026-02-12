from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class PolicyViolationError(Exception):
    pass


@dataclass
class PolicyDecision:
    allowed: bool
    code: str
    reason: str
    risk: str


def _expand(raw: str) -> Path:
    return Path(raw).expanduser().resolve()


def _allowed_roots() -> list[Path]:
    raw = get_settings().ALLOWED_SCAN_ROOTS or "~/Desktop,~/Documents,/Volumes,/"
    roots: list[Path] = []
    for item in raw.split(","):
        cleaned = item.strip()
        if cleaned:
            roots.append(_expand(cleaned))
    return roots


def _is_under(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def enforce_file_scan(paths: list[str]) -> PolicyDecision:
    if not paths:
        return PolicyDecision(False, "scan.paths_missing", "No scan paths provided.", "low")

    roots = _allowed_roots()
    for raw in paths:
        target = _expand(raw)
        if not any(_is_under(target, root) for root in roots):
            return PolicyDecision(
                False,
                "scan.path_denied",
                f"Path not allowed: {target}",
                "medium",
            )

    return PolicyDecision(True, "ok", "scan allowed", "low")


def enforce_tool_execution(tool_name: str, approved: bool) -> PolicyDecision:
    tool_policy = {
        "file.search": ("low", False),
        "files.scan": ("low", False),
        "email.fetch": ("low", False),
        "news.headlines": ("low", False),
        "ops.summary": ("low", False),
        "task.create": ("medium", True),
        "notify.send": ("high", True),
    }
    if tool_name not in tool_policy:
        return PolicyDecision(False, "tool.denied", f"Tool not allowed: {tool_name}", "high")

    risk, requires_approval = tool_policy[tool_name]
    if requires_approval and not approved:
        return PolicyDecision(False, "tool.approval_required", f"Approval required for {tool_name}", risk)

    return PolicyDecision(True, "ok", "tool allowed", risk)


def enforce_notification_send(provider: str, dry_run: bool, approved_network: bool, actor: str) -> PolicyDecision:
    if provider == "off":
        return PolicyDecision(True, "ok", "notifications disabled", "low")

    if provider != "ntfy":
        return PolicyDecision(False, "notify.provider_denied", f"Provider not allowed: {provider}", "medium")

    # Only allow real outbound sends from explicitly approved contexts.
    if not dry_run and not approved_network:
        return PolicyDecision(False, "notify.approval_required", "Notification send requires approval", "high")

    # Keep explicit test route allowed.
    if actor == "alerts_test" and not dry_run:
        return PolicyDecision(True, "ok", "alerts test allowed", "medium")

    return PolicyDecision(True, "ok", "notification allowed", "medium")


def require_allowed(decision: PolicyDecision) -> None:
    if not decision.allowed:
        raise PolicyViolationError(f"{decision.code}: {decision.reason}")
