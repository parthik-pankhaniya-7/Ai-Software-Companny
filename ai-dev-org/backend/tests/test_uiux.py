"""Tests for backend/app/agents/uiux.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.uiux import run_uiux
from app.models.agent import AgentInput


def test_run_uiux_with_mocked_llm() -> None:
    sample_uiux_payload = {
        "user_flows": [
            "User submits natural language requirement",
            "User views real-time multi-agent execution in React Flow graph",
            "User approves or modifies milestone plan",
        ],
        "screens": [
            "Project Dashboard (Main)",
            "Agent Workflow Canvas",
            "Artifacts & Logs Viewer",
        ],
        "components": [
            "WorkflowCanvas (React Flow)",
            "AgentNode (Custom React Flow node)",
            "LogStreamPanel (shadcn/ui ScrollArea)",
            "ApprovalModal (shadcn/ui Dialog)",
        ],
        "states": {
            "loading": "Pulsing glowing edge on active agent node with spinner indicator",
            "error": "Red destructive border with retry button and error alert banner",
            "empty": "Subtle placeholder canvas with 'Start by describing your project' callout",
        },
        "accessibility_notes": [
            "WCAG AAA color contrast ratios across dark mode surfaces",
            "Aria-live announcement regions for WebSocket agent status streams",
        ],
        "responsive_notes": [
            "Collapsible side drawer on viewports < 1024px",
            "Touch-pan controls enabled for React Flow canvas on mobile",
        ],
        "wireframe_description": "Three-column layout: Left sidebar for project tree, center for graph/code view, right for real-time logs.",
    }

    mock_llm_result = {
        "text": json.dumps(sample_uiux_payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 140,
        "tokens_out": 120,
        "latency": 0.85,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="UI/UX",
        objective="Design agent workflow canvas and dashboard",
        task="Create frontend UI specification for workflow dashboard",
        context={"ui_tasks": [{"id": "TASK-UI-01", "ui_needed": True}]},
        constraints=["Tailwind CSS", "shadcn/ui only", "React Flow"],
        tools=[],
        expected_output="JSON UI/UX spec",
    )

    with patch("app.agents.uiux.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_uiux(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "reasoning"
        assert call_kwargs["complexity"] == "medium"
        assert call_kwargs["json_mode"] is True
        assert "You are the UI/UX Designer" in call_kwargs["system"]

        assert output.status == "ok"
        assert len(output.artifacts["screens"]) == 3
        assert len(output.artifacts["components"]) == 4
        assert output.artifacts["states"]["loading"] == sample_uiux_payload["states"]["loading"]
        assert output.artifacts["states"]["error"] == sample_uiux_payload["states"]["error"]
        assert output.artifacts["states"]["empty"] == sample_uiux_payload["states"]["empty"]
        assert output.artifacts["wireframe_description"] == sample_uiux_payload["wireframe_description"]
        assert output.next_action == "developer"
        assert output.meta == mock_llm_result
