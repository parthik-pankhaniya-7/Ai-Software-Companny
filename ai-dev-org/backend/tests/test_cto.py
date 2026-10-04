"""Tests for backend/app/agents/cto.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.cto import run_cto
from app.models.agent import AgentInput


def test_run_cto_with_mocked_llm() -> None:
    sample_cto_payload = {
        "brd": "Automate local software development workflows with zero cloud lock-in.",
        "frd": "FastAPI service exposing task endpoints and streaming events via WebSocket.",
        "architecture": "Local Python 3.11 service with LangGraph agent loop and JSON file store.",
        "risks": ["Gemini 429 quota exhaustion", "Long execution contexts"],
        "nfr": ["Zero telemetry outside repo", "Sub-100ms endpoint response"],
        "acceptance_criteria": ["All tests pass", "Clean static types"],
        "open_questions": ["ChromaDB local vector threshold"],
        "recommended_docs": ["docs/architecture.md", "docs/agent-contracts.md"],
    }

    mock_llm_result = {
        "text": json.dumps(sample_cto_payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 120,
        "tokens_out": 85,
        "latency": 0.95,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="CTO",
        objective="Architect local multi-agent system",
        task="Create architecture specification for ai-dev-org",
        context={"project_id": "proj-dev-01"},
        constraints=["No cloud DB", "Gemini only"],
        tools=[],
        expected_output="CTO architectural breakdown JSON",
        acceptance_criteria=["Strict JSON", "Covers BRD and FRD"],
        token_budget=4000,
        model_policy="reasoning/high",
    )

    with patch("app.agents.cto.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_cto(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "reasoning"
        assert call_kwargs["complexity"] == "high"
        assert call_kwargs["json_mode"] is True
        assert "You are the CTO" in call_kwargs["system"]

        assert output.status == "ok"
        assert "CTO technical analysis completed" in output.summary
        assert output.artifacts["architecture"] == sample_cto_payload["architecture"]
        assert output.artifacts["brd"] == sample_cto_payload["brd"]
        assert output.artifacts["frd"] == sample_cto_payload["frd"]
        assert output.risks == sample_cto_payload["risks"]
        assert output.recommendations == sample_cto_payload["recommended_docs"]
        assert output.meta == mock_llm_result


def test_run_cto_nullable_brd_frd() -> None:
    sample_minimal_payload = {
        "brd": None,
        "frd": None,
        "architecture": "Minimal pipeline architecture",
        "risks": [],
        "nfr": [],
        "acceptance_criteria": [],
        "open_questions": [],
        "recommended_docs": [],
    }

    mock_llm_result = {
        "text": json.dumps(sample_minimal_payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 50,
        "tokens_out": 30,
        "latency": 0.4,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="CTO",
        objective="Analyze simple script",
        task="Evaluate utility script",
        expected_output="JSON",
    )

    with patch("app.agents.cto.call_llm", return_value=mock_llm_result):
        output = run_cto(inp)
        assert output.artifacts["brd"] is None
        assert output.artifacts["frd"] is None
        assert output.artifacts["architecture"] == "Minimal pipeline architecture"
