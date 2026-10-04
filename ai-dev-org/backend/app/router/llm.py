"""LLM Router and LiteLLM invocation layer for ai-dev-org.

Routes tasks to appropriate Gemini models according to task type and complexity,
handles retries, exponential backoff, fallback policies, and observability logging.
"""

import logging
import os
import time
from typing import Any

try:
    import litellm
    from litellm.exceptions import RateLimitError, Timeout
    HAS_LITELLM = True
except ImportError:
    litellm = None  # type: ignore
    RateLimitError = Exception  # type: ignore
    Timeout = Exception  # type: ignore
    HAS_LITELLM = False

try:
    from tenacity import (
        RetryError,
        Retrying,
        retry_if_exception,
        stop_after_attempt,
        wait_exponential,
    )
    HAS_TENACITY = True
except ImportError:
    HAS_TENACITY = False

try:
    from app.config import settings
except ImportError:
    class _Settings:
        @property
        def GEMINI_API_KEY(self) -> str:
            return os.environ.get("GEMINI_API_KEY", "")
    settings = _Settings()  # type: ignore

try:
    from app.observability.log import log_llm_call
except ImportError:
    def log_llm_call(*args: Any, **kwargs: Any) -> None:
        """Observability stub until app.observability.log is available."""
        pass

logger = logging.getLogger(__name__)

# Model map: (task_type, complexity) -> model
MODEL_MAP: dict[tuple[str, str], str] = {
    ("reasoning", "high"): "gemini/gemini-1.5-pro",
    ("reasoning", "medium"): "gemini/gemini-1.5-pro",
    ("reasoning", "low"): "gemini/gemini-1.5-flash",
    ("coding", "high"): "gemini/gemini-1.5-pro",
    ("coding", "low"): "gemini/gemini-2.0-flash",
    ("doc", "any"): "gemini/gemini-1.5-flash",
    ("routing", "any"): "gemini/gemini-1.5-flash",
}

FALLBACK_MODEL = "gemini/gemini-1.5-flash"


def route_task(task_type: str, complexity: str) -> str:
    """Resolve the target Gemini model based on task type and complexity."""
    t_clean = task_type.strip().lower()
    c_clean = complexity.strip().lower()

    if (t_clean, c_clean) in MODEL_MAP:
        return MODEL_MAP[(t_clean, c_clean)]

    if (t_clean, "any") in MODEL_MAP:
        return MODEL_MAP[(t_clean, "any")]

    return FALLBACK_MODEL


def _is_retryable_exception(exc: BaseException) -> bool:
    """Determine if the exception is an HTTP 429 rate limit or timeout."""
    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return True

    exc_name = type(exc).__name__.lower()
    exc_str = str(exc).lower()

    if "timeout" in exc_name or "timeout" in exc_str:
        return True
    if "ratelimit" in exc_name or "rate_limit" in exc_str or "429" in exc_str:
        return True

    return False


def call_llm(
    prompt: str,
    task_type: str,
    complexity: str = "medium",
    system: str = "",
    json_mode: bool = False,
    max_retries: int = 3,
) -> dict:
    """Execute LLM call via LiteLLM with retries, fallback, and observability.

    Returns:
        dict: {"text", "model", "tokens_in", "tokens_out", "latency", "cost"}
    """
    if not HAS_LITELLM or litellm is None:
        raise ImportError("litellm is required to execute LLM calls.")

    target_model = route_task(task_type, complexity)
    current_model = target_model
    pro_failure_count = 0

    api_key = getattr(settings, "GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")

    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = None
    start_time = time.perf_counter()

    for attempt in range(1, max_retries + 1):
        try:
            # Fallback to gemini-1.5-flash after 2 pro failures
            if pro_failure_count >= 2 and "pro" in current_model:
                logger.warning(
                    "Switching model from %s to %s after %d failures",
                    current_model,
                    FALLBACK_MODEL,
                    pro_failure_count,
                )
                current_model = FALLBACK_MODEL

            call_kwargs: dict[str, Any] = {
                "model": current_model,
                "messages": messages,
                "api_key": api_key,
            }

            if json_mode:
                call_kwargs["response_format"] = {"type": "json_object"}

            response = litellm.completion(**call_kwargs)
            break
        except Exception as exc:
            if "pro" in current_model:
                pro_failure_count += 1

            is_retryable = _is_retryable_exception(exc)
            if not is_retryable or attempt >= max_retries:
                logger.error(
                    "LLM call failed permanently on attempt %d with model %s: %s",
                    attempt,
                    current_model,
                    exc,
                )
                raise

            # Exponential backoff
            backoff_delay = min(2 ** (attempt - 1), 10)
            logger.warning(
                "LLM call attempt %d failed with retryable error (%s). Retrying in %ds...",
                attempt,
                exc,
                backoff_delay,
            )
            time.sleep(backoff_delay)

    latency = round(time.perf_counter() - start_time, 4)

    # Extract response text
    text = ""
    if response is not None:
        if hasattr(response, "choices") and response.choices:
            choice = response.choices[0]
            if hasattr(choice, "message"):
                text = getattr(choice.message, "content", "") or ""
            elif isinstance(choice, dict):
                text = choice.get("message", {}).get("content", "")
        elif isinstance(response, dict) and "choices" in response:
            text = response["choices"][0]["message"].get("content", "")

    # Extract token usage
    tokens_in = 0
    tokens_out = 0
    if response is not None:
        usage = getattr(response, "usage", None)
        if usage is not None:
            tokens_in = getattr(usage, "prompt_tokens", 0) or 0
            tokens_out = getattr(usage, "completion_tokens", 0) or 0
        elif isinstance(response, dict) and "usage" in response:
            tokens_in = response["usage"].get("prompt_tokens", 0) or 0
            tokens_out = response["usage"].get("completion_tokens", 0) or 0

    result = {
        "text": text,
        "model": current_model,
        "tokens_in": int(tokens_in),
        "tokens_out": int(tokens_out),
        "latency": latency,
        "cost": 0.0,
    }

    try:
        log_llm_call(
            task_type=task_type,
            complexity=complexity,
            model=current_model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency=latency,
            cost=0.0,
        )
    except Exception as log_exc:
        logger.warning("Observability logging failed: %s", log_exc)

    return result
