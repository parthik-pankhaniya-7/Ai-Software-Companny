"""Tests for backend/app/agents/team_lead.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.team_lead import run_team_lead
from app.models.agent import AgentInput


def test_run_team_lead_ui_required() -> None:
    sample_tl_payload = {
        "technical_plan": [
            {
                "task_id": "TASK-UI-01",
                "technical_steps": [
                    "Define React Flow custom nodes",
                    "Apply Tailwind glassmorphism tokens",
                    "Wire Zustand execution store",
                ],
                "files_to_touch": [
                    "frontend/components/graph/WorkflowCanvas.tsx",
                    "frontend/lib/store.ts",
                ],
                "ui_needed": True,
                "assigned_agent": "uiux",
            },
            {
                "task_id": "TASK-BE-02",
                "technical_steps": [
                    "Create FastAPI WebSocket endpoint in app/api/ws.py",
                    "Connect to in-process asyncio queue",
                ],
                "files_to_touch": ["backend/app/api/ws.py"],
                "ui_needed": False,
                "assigned_agent": "developer",
            },
        ],
        "blockers": [],
        "dependencies": ["FastAPI core setup", "Next.js App Router initialization"],
    }

    mock_llm_result = {
        "text": json.dumps(sample_tl_payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 160,
        "tokens_out": 95,
        "latency": 0.75,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="Team Lead",
        objective="Create technical implementation plan",
        task="Breakdown TASK-UI-01 and TASK-BE-02",
        context={"tasks": [{"id": "TASK-UI-01"}, {"id": "TASK-BE-02"}]},
        constraints=["Strict module isolation", "No global mutable state"],
        tools=[],
        expected_output="JSON technical plan",
    )

    with patch("app.agents.team_lead.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_team_lead(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "reasoning"
        assert call_kwargs["complexity"] == "medium"
        assert call_kwargs["json_mode"] is True
        assert "You are the Team Lead" in call_kwargs["system"]

        assert output.status == "ok"
        assert len(output.artifacts["technical_plan"]) == 2
        assert output.artifacts["technical_plan"][0]["ui_needed"] is True
        assert output.artifacts["technical_plan"][0]["assigned_agent"] == "uiux"
        assert output.next_action == "uiux"
        assert output.meta == mock_llm_result


def test_run_team_lead_no_ui() -> None:
    sample_tl_payload = {
        "technical_plan": [
            {
                "task_id": "TASK-STORE-01",
                "technical_steps": ["Implement store.py atomic write logic"],
                "files_to_touch": ["backend/app/memory/store.py"],
                "ui_needed": False,
                "assigned_agent": "developer",
            }
        ],
        "blockers": [],
        "dependencies": [],
    }

    mock_llm_result = {
        "text": json.dumps(sample_tl_payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 80,
        "tokens_out": 40,
        "latency": 0.35,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="Team Lead",
        objective="Plan backend memory module",
        task="Plan store.py implementation",
        expected_output="JSON",
    )

    with patch("app.agents.team_lead.call_llm", return_value=mock_llm_result):
        output = run_team_lead(inp)
        assert output.artifacts["technical_plan"][0]["ui_needed"] is False
        assert output.next_action == "developer"
