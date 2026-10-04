"""Tests for backend/app/agents/pm.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.pm import run_pm
from app.models.agent import AgentInput


def test_run_pm_with_mocked_llm() -> None:
    sample_pm_payload = {
        "epics": ["Core System Architecture", "Data Layer & Persistence"],
        "features": ["Atomic JSON store", "LiteLLM Router integration"],
        "tasks": [
            {
                "id": "TASK-1",
                "title": "Build atomic store",
                "description": "Implement store.py with atomic tmp replace",
                "dependencies": [],
                "priority": "high",
                "acceptance_criteria": ["Atomic file write", "No SQLite"],
                "assigned_role": "developer",
            },
            {
                "id": "TASK-2",
                "title": "Create router module",
                "description": "Implement LiteLLM fallback to gemini-1.5-flash",
                "dependencies": ["TASK-1"],
                "priority": "medium",
                "acceptance_criteria": ["Retries on 429", "Logs to Langfuse"],
                "assigned_role": "developer",
            },
        ],
        "milestones": ["Milestone 1: Foundations", "Milestone 2: Agent Orchestration"],
        "risks": ["Dependency on external rate limits"],
    }

    mock_llm_result = {
        "text": json.dumps(sample_pm_payload),
        "model": "gemini/gemini-1.5-flash",
        "tokens_in": 150,
        "tokens_out": 110,
        "latency": 0.65,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="PM",
        objective="Decompose system into executable backlog",
        task="Create project plan based on CTO specification",
        context={
            "cto_artifacts": {
                "architecture": "Local-first multi-agent architecture",
                "brd": "Local privacy without cloud dependencies",
            }
        },
        constraints=["No cloud DB", "Follow fixed stack"],
        tools=[],
        expected_output="JSON project plan",
    )

    with patch("app.agents.pm.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_pm(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "doc"
        assert call_kwargs["complexity"] == "any"
        assert call_kwargs["json_mode"] is True
        assert "You are the Project Manager" in call_kwargs["system"]

        assert output.status == "ok"
        assert "PM plan synthesized" in output.summary
        assert len(output.artifacts["tasks"]) == 2
        assert output.artifacts["tasks"][0]["id"] == "TASK-1"
        assert output.artifacts["tasks"][0]["assigned_role"] == "developer"
        assert output.artifacts["tasks"][1]["dependencies"] == ["TASK-1"]
        assert len(output.artifacts["epics"]) == 2
        assert output.next_action == "team_lead"
        assert output.meta == mock_llm_result
