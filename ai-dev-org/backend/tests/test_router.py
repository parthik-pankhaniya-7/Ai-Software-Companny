"""Tests for backend/app/router/llm.py."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest

from app.router import llm


def test_route_task_all_mappings() -> None:
    """Test all explicitly specified routing pairs."""
    assert llm.route_task("reasoning", "high") == "gemini/gemini-1.5-pro"
    assert llm.route_task("reasoning", "medium") == "gemini/gemini-1.5-pro"
    assert llm.route_task("reasoning", "low") == "gemini/gemini-1.5-flash"
    assert llm.route_task("coding", "high") == "gemini/gemini-1.5-pro"
    assert llm.route_task("coding", "low") == "gemini/gemini-2.0-flash"
    assert llm.route_task("doc", "any") == "gemini/gemini-1.5-flash"
    assert llm.route_task("doc", "medium") == "gemini/gemini-1.5-flash"
    assert llm.route_task("routing", "any") == "gemini/gemini-1.5-flash"
    assert llm.route_task("unknown", "none") == "gemini/gemini-1.5-flash"


def test_call_llm_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test standard call_llm success response with monkeypatched completion."""
    mock_response = SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content='{"status": "ok"}'))
        ],
        usage=SimpleNamespace(prompt_tokens=42, completion_tokens=18),
    )

    mock_litellm = MagicMock()
    mock_litellm.completion.return_value = mock_response

    logged_calls = []

    def mock_log(*args, **kwargs):
        logged_calls.append(kwargs)

    monkeypatch.setattr(llm, "HAS_LITELLM", True)
    monkeypatch.setattr(llm, "litellm", mock_litellm)
    monkeypatch.setattr(llm, "log_llm_call", mock_log)

    result = llm.call_llm(
        prompt="Synthesize architecture",
        task_type="reasoning",
        complexity="high",
        system="Act as CTO",
        json_mode=True,
    )

    assert result["text"] == '{"status": "ok"}'
    assert result["model"] == "gemini/gemini-1.5-pro"
    assert result["tokens_in"] == 42
    assert result["tokens_out"] == 18
    assert result["cost"] == 0.0
    assert result["latency"] >= 0.0

    # Verify litellm.completion args
    call_kwargs = mock_litellm.completion.call_args.kwargs
    assert call_kwargs["model"] == "gemini/gemini-1.5-pro"
    assert call_kwargs["response_format"] == {"type": "json_object"}
    assert len(call_kwargs["messages"]) == 2
    assert call_kwargs["messages"][0]["role"] == "system"

    # Verify observability call
    assert len(logged_calls) == 1
    assert logged_calls[0]["tokens_in"] == 42
    assert logged_calls[0]["tokens_out"] == 18


def test_call_llm_pro_fallback_after_2_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test fallback to gemini-1.5-flash after 2 consecutive pro failures."""
    success_response = SimpleNamespace(
        choices=[
            SimpleNamespace(message=SimpleNamespace(content="Recovered answer"))
        ],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
    )

    class RateLimit429(Exception):
        status_code = 429

    mock_litellm = MagicMock()
    # First 2 attempts fail with 429, 3rd attempt succeeds
    mock_litellm.completion.side_effect = [
        RateLimit429("Rate limit 429"),
        RateLimit429("Rate limit 429"),
        success_response,
    ]

    monkeypatch.setattr(llm, "HAS_LITELLM", True)
    monkeypatch.setattr(llm, "litellm", mock_litellm)
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)

    result = llm.call_llm(
        prompt="Solve complex algorithm",
        task_type="reasoning",
        complexity="high",
        max_retries=3,
    )

    assert result["text"] == "Recovered answer"
    assert result["model"] == "gemini/gemini-1.5-flash"
    assert mock_litellm.completion.call_count == 3

    # Check 3rd call used fallback model
    third_call_kwargs = mock_litellm.completion.call_args_list[2].kwargs
    assert third_call_kwargs["model"] == "gemini/gemini-1.5-flash"


def test_call_llm_exhausted_retries_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that exhausting retries raises the final exception."""
    class RateLimit429(Exception):
        status_code = 429

    mock_litellm = MagicMock()
    mock_litellm.completion.side_effect = RateLimit429("Quota exceeded")

    monkeypatch.setattr(llm, "HAS_LITELLM", True)
    monkeypatch.setattr(llm, "litellm", mock_litellm)
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)

    with pytest.raises(RateLimit429):
        llm.call_llm(
            prompt="Do something",
            task_type="coding",
            complexity="low",
            max_retries=3,
        )

    assert mock_litellm.completion.call_count == 3
