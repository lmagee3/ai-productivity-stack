from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.llm_provider import LLMProvider
from app.models.project_llm_policy import ProjectLLMPolicy


@dataclass
class Recommendation:
    provider: str
    route_to: str
    reason: str
    estimated_cost_usd: float
    tokens: int


PRICE_PER_1K = {
    "local": 0.0,
    "gpt": 0.02,
    "claude": 0.02,
    "codex": 0.02,
}


def list_providers() -> list[dict[str, Any]]:
    settings = get_settings()
    providers: list[dict[str, Any]] = []
    with SessionLocal() as session:
        rows = session.query(LLMProvider).order_by(LLMProvider.name).all()
        for row in rows:
            providers.append(
                {
                    "name": row.name,
                    "provider_type": row.provider_type,
                    "base_url": row.base_url,
                    "model": row.model,
                    "active": row.active,
                }
            )

    if not providers:
        providers.append(
            {
                "name": "local",
                "provider_type": "ollama",
                "base_url": settings.OLLAMA_BASE_URL or settings.LOCAL_LLM_BASE_URL,
                "model": settings.OLLAMA_MODEL or settings.LOCAL_LLM_MODEL,
                "active": True,
            }
        )
    return providers


def estimate_tokens(message: str, provided: int | None) -> int:
    if provided and provided > 0:
        return provided
    return max(1, len(message) // 4)


def estimate_cost(provider: str, tokens: int) -> float:
    rate = PRICE_PER_1K.get(provider, 0.0)
    return round((tokens / 1000) * rate, 6)


def recommend_provider(message: str, project: str | None = None, tokens: int | None = None) -> Recommendation:
    settings = get_settings()
    provider = settings.LLM_DEFAULT_PROVIDER
    allow_cloud = False

    if project:
        with SessionLocal() as session:
            policy = session.query(ProjectLLMPolicy).filter(ProjectLLMPolicy.project == project).first()
            if policy:
                provider = policy.default_provider
                allow_cloud = policy.allow_cloud

    approx_tokens = estimate_tokens(message, tokens)
    requires_cloud = approx_tokens > 1200 or "code" in message.lower() or "analyze" in message.lower()

    if allow_cloud and requires_cloud:
        provider = "gpt"
        route_to = "cloud"
        reason = "Complex or long input; cloud allowed by policy"
    else:
        route_to = "local"
        reason = "Default local routing"

    cost = estimate_cost(provider, approx_tokens)
    return Recommendation(
        provider=provider,
        route_to=route_to,
        reason=reason,
        estimated_cost_usd=cost,
        tokens=approx_tokens,
    )
