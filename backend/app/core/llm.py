from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    name: str

    def generate(self, prompt: str) -> str: ...

    def generate_json(self, prompt: str) -> dict[str, Any]: ...


@dataclass
class LLMState:
    last_llm_latency_ms: float | None = None
    last_llm_error: str | None = None


_llm_state = LLMState()


def get_llm_state() -> LLMState:
    return _llm_state


def _record_latency(start_time: float) -> None:
    _llm_state.last_llm_latency_ms = (time.monotonic() - start_time) * 1000


def _record_error(error: Exception | str) -> None:
    _llm_state.last_llm_error = str(error)


class LocalProvider:
    name = "local"

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.LOCAL_LLM_BASE_URL
        self.model = settings.LOCAL_LLM_MODEL or "gemma"
        self.timeout = settings.LOCAL_LLM_TIMEOUT_S

    def generate(self, prompt: str) -> str:
        if not self.base_url:
            return self._stub_response(prompt)

        start_time = time.monotonic()
        try:
            response = httpx.post(
                f"{self.base_url.rstrip('/')}/v1/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "Return only the requested output."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            _record_latency(start_time)
            _llm_state.last_llm_error = None
            return content
        except Exception as exc:
            _record_latency(start_time)
            _record_error(exc)
            logger.warning("Local LLM request failed, falling back to stub", exc_info=exc)
            return self._stub_response(prompt)

    def generate_json(self, prompt: str) -> dict[str, Any]:
        raw = self.generate(prompt)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return self._stub_json(prompt)

    def _stub_response(self, prompt: str) -> str:
        return """Here is a draft response based on the provided input.\n\n(Stub: connect LOCAL_LLM_BASE_URL for model output.)"""

    def _stub_json(self, prompt: str) -> dict[str, Any]:
        return {
            "intent": "summarize",
            "priority": "normal",
            "domain": "general",
            "due_date": None,
            "course": None,
            "source": "manual",
            "confidence": 0.0,
            "summary": "Stub response generated without a local model.",
            "suggested_actions": ["Review input", "Decide next steps"],
            "route_to": "human",
        }


def get_provider() -> LLMProvider:
    settings = get_settings()
    if settings.LLM_DEFAULT_PROVIDER == "local":
        return LocalProvider()
    return LocalProvider()
