"""Tests for backend/app/agents/ai_engineer.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.ai_engineer import run_ai_engineer
from app.models.agent import AgentInput


def test_run_ai_engineer_proceed() -> None:
    sample_ai_payload = {
        "decision": "proceed",
        "model": "gemini/gemini-2.0-flash",
        "token_budget": 5000,
        "parallel": True,
        "retry": False,
        "escalate": False,
        "reason": "Token budget within safe limits and tasks can execute concurrently.",
    }

    mock_llm_result = {
        "text": json.dumps(sample_ai_payload),
        "model": "gemini/gemini-1.5-flash",
        "tokens_in": 110,
        "tokens_out": 60,
        "latency": 0.4,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="AI Engineer",
        objective="Optimize graph execution routing",
        task="Evaluate token limits and model routing for sprint execution",
        context={"task_count": 5},
        expected_output="JSON routing evaluation",
    )

    with patch("app.agents.ai_engineer.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_ai_engineer(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "routing"
        assert call_kwargs["complexity"] == "any"
        assert call_kwargs["json_mode"] is True

        assert output.status == "ok"
        assert output.artifacts["decision"] == "proceed"
        assert output.artifacts["model"] == "gemini/gemini-2.0-flash"
        assert output.artifacts["token_budget"] == 5000
        assert output.artifacts["parallel"] is True
        assert output.next_action == "done"
        assert output.meta == mock_llm_result


def test_run_ai_engineer_retry() -> None:
    sample_ai_payload = {
        "decision": "retry",
        "model": "gemini/gemini-1.5-pro",
        "token_budget": 8000,
        "parallel": False,
        "retry": True,
        "escalate": False,
        "reason": "Developer output context exceeded window; retry with pro model and larger budget.",
    }

    mock_llm_result = {
        "text": json.dumps(sample_ai_payload),
        "model": "gemini/gemini-1.5-flash",
        "tokens_in": 120,
        "tokens_out": 65,
        "latency": 0.45,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="AI Engineer",
        objective="Assess QA regression",
        task="Evaluate retry strategy for failed task",
        expected_output="JSON routing evaluation",
    )

    with patch("app.agents.ai_engineer.call_llm", return_value=mock_llm_result):
        output = run_ai_engineer(inp)

        assert output.status == "retry"
        assert output.artifacts["retry"] is True
        assert output.next_action == "developer"


def test_run_ai_engineer_escalate() -> None:
    sample_ai_payload = {
        "decision": "escalate",
        "model": "gemini/gemini-1.5-pro",
        "token_budget": 4000,
        "parallel": False,
        "retry": False,
        "escalate": True,
        "reason": "Max retries exceeded on developer agent; human intervention required.",
    }

    mock_llm_result = {
        "text": json.dumps(sample_ai_payload),
        "model": "gemini/gemini-1.5-flash",
        "tokens_in": 100,
        "tokens_out": 55,
        "latency": 0.35,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="AI Engineer",
        objective="Resolve cascading failure",
        task="Escalate blocked workflow",
        expected_output="JSON routing evaluation",
    )

    with patch("app.agents.ai_engineer.call_llm", return_value=mock_llm_result):
        output = run_ai_engineer(inp)

        assert output.status == "escalate"
        assert output.artifacts["escalate"] is True
        assert output.next_action == "human_escalation"
