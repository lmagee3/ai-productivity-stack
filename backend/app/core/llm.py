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
        self.openai_base_url = (settings.LOCAL_LLM_BASE_URL or "").rstrip("/") or None
        if self.openai_base_url and not self.openai_base_url.endswith("/v1"):
            self.openai_base_url = f"{self.openai_base_url}/v1"
        self.ollama_base_url = (settings.OLLAMA_BASE_URL or "").rstrip("/") or None
        self.model = settings.LOCAL_LLM_MODEL or settings.OLLAMA_MODEL or settings.LOCAL_FAST_MODEL
        self.fast_model = settings.LOCAL_FAST_MODEL or self.model
        self.deep_model = settings.LOCAL_DEEP_MODEL or self.model
        self.timeout = settings.LOCAL_LLM_TIMEOUT_S

    def generate(self, prompt: str) -> str:
        return self.generate_routed(prompt, complexity="fast")

    def generate_routed(self, prompt: str, complexity: str = "fast") -> str:
        model = self.deep_model if complexity == "deep" else self.fast_model
        return self._generate_with_model(prompt, model)

    def _generate_with_model(self, prompt: str, model: str) -> str:
        if not self.openai_base_url and not self.ollama_base_url:
            return self._stub_response(prompt)

        start_time = time.monotonic()
        errors: list[str] = []
        try:
            if self.openai_base_url:
                response = httpx.post(
                    f"{self.openai_base_url}/chat/completions",
                    json={
                        "model": model,
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
            errors.append(f"openai-compatible failed: {exc}")

        try:
            if self.ollama_base_url:
                response = httpx.post(
                    f"{self.ollama_base_url}/api/chat",
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False,
                        "options": {"temperature": 0.2},
                    },
                    timeout=self.timeout,
                )
                response.raise_for_status()
                data = response.json()
                content = data.get("message", {}).get("content")
                if content:
                    _record_latency(start_time)
                    _llm_state.last_llm_error = None
                    return content
        except Exception as exc:
            errors.append(f"ollama /api/chat failed: {exc}")

        try:
            if self.ollama_base_url:
                response = httpx.post(
                    f"{self.ollama_base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.2}},
                    timeout=self.timeout,
                )
                response.raise_for_status()
                data = response.json()
                content = data.get("response")
                if content:
                    _record_latency(start_time)
                    _llm_state.last_llm_error = None
                    return content
        except Exception as exc:
            errors.append(f"ollama /api/generate failed: {exc}")

        _record_latency(start_time)
        _record_error("; ".join(errors) if errors else "unknown local llm error")
        logger.warning("Local LLM request failed, falling back to stub: %s", errors)
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
