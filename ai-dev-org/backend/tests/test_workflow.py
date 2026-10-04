"""Tests for backend/app/graph/workflow.py."""

from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from app.graph import workflow
from app.graph.state import ProjectState
from app.models.agent import AgentOutput


@pytest.fixture
def tmp_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Configure DATA_DIR to a temporary directory."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    return tmp_path


def test_route_team_lead() -> None:
    """Verify team_lead conditional routing logic."""
    assert workflow.route_team_lead({"ui_needed": True}) == "uiux"
    assert workflow.route_team_lead({"ui_needed": False}) == "developer"
    assert workflow.route_team_lead({}) == "developer"


def test_route_qa() -> None:
    """Verify QA conditional routing on pass, fail, and retry limits."""
    # Pass -> proceed to AI engineer
    assert workflow.route_qa({"status": "pass", "retries": 0}) == "ai_engineer"

    # Fail with retries < 3 -> retry developer
    assert workflow.route_qa({"status": "fail", "retries": 0}) == "developer"
    assert workflow.route_qa({"status": "fail", "retries": 2}) == "developer"

    # Fail with retries >= 3 -> escalate to AI engineer / human
    assert workflow.route_qa({"status": "fail", "retries": 3}) == "ai_engineer"


def test_sequential_workflow_nodes(tmp_data_dir: Path) -> None:
    """Run simulated end-to-end workflow through all node wrappers with mocked agent functions."""
    project_id = "proj-workflow-test"
    initial_state: ProjectState = {
        "project_id": project_id,
        "requirement": "Build a real-time collaborative task board",
        "retries": 0,
        "history": [],
    }

    # 1. CTO Node
    mock_cto_out = AgentOutput(
        status="ok",
        artifacts={"brd": "Collab task board", "frd": "WS sync", "architecture": "FastAPI + React Flow"},
    )
    with patch("app.graph.workflow.run_cto", return_value=mock_cto_out):
        cto_delta = workflow.cto_node(initial_state)
        state_after_cto = {**initial_state, **cto_delta}
        assert state_after_cto["brd"] == "Collab task board"
        assert len(state_after_cto["history"]) == 1

    # 2. PM Node
    mock_pm_out = AgentOutput(
        status="ok",
        artifacts={"tasks": [{"id": "T1", "title": "Setup Canvas", "ui_needed": True}]},
    )
    with patch("app.graph.workflow.run_pm", return_value=mock_pm_out):
        pm_delta = workflow.pm_node(state_after_cto)
        state_after_pm = {**state_after_cto, **pm_delta}
        assert len(state_after_pm["tasks"]) == 1
        assert len(state_after_pm["history"]) == 2

    # 3. Team Lead Node
    mock_tl_out = AgentOutput(
        status="ok",
        artifacts={"technical_plan": [{"task_id": "T1", "ui_needed": True, "assigned_agent": "uiux"}]},
    )
    with patch("app.graph.workflow.run_team_lead", return_value=mock_tl_out):
        tl_delta = workflow.team_lead_node(state_after_pm)
        state_after_tl = {**state_after_pm, **tl_delta}
        assert state_after_tl["ui_needed"] is True
        assert workflow.route_team_lead(state_after_tl) == "uiux"

    # 4. UI/UX Node
    mock_uiux_out = AgentOutput(
        status="ok",
        artifacts={"screens": ["TaskBoard"], "components": ["Card", "Column"]},
    )
    with patch("app.graph.workflow.run_uiux", return_value=mock_uiux_out):
        uiux_delta = workflow.uiux_node(state_after_tl)
        state_after_uiux = {**state_after_tl, **uiux_delta}
        assert len(state_after_uiux["history"]) == 4

    # 5. Developer Node
    mock_dev_out = AgentOutput(
        status="ok",
        artifacts={"code_blocks": [{"path": "board.py", "code": "# Code"}]},
    )
    with patch("app.graph.workflow.run_developer", return_value=mock_dev_out):
        dev_delta = workflow.developer_node(state_after_uiux)
        state_after_dev = {**state_after_uiux, **dev_delta}
        assert len(state_after_dev["history"]) == 5

    # 6. QA Node
    mock_qa_out = AgentOutput(
        status="ok",
        artifacts={"status": "pass", "test_cases": ["Test 1"], "retest_required": False},
    )
    with patch("app.graph.workflow.run_qa", return_value=mock_qa_out):
        qa_delta = workflow.qa_node(state_after_dev)
        state_after_qa = {**state_after_dev, **qa_delta}
        assert state_after_qa["status"] == "pass"
        assert workflow.route_qa(state_after_qa) == "ai_engineer"

    # 7. AI Engineer Node
    mock_ai_out = AgentOutput(
        status="ok",
        artifacts={"decision": "proceed", "model": "gemini-2.0-flash", "token_budget": 4000},
    )
    with patch("app.graph.workflow.run_ai_engineer", return_value=mock_ai_out):
        ai_delta = workflow.ai_engineer_node(state_after_qa)
        final_state = {**state_after_qa, **ai_delta}
        assert final_state["status"] == "completed"
        assert len(final_state["history"]) == 7


def test_compiled_graph_end_to_end_if_installed(tmp_data_dir: Path) -> None:
    """Verify compiled LangGraph app execution when langgraph is available."""
    pytest.importorskip("langgraph")

    app = workflow.create_workflow()
    assert app is not None

    mock_out = AgentOutput(status="ok", artifacts={"status": "pass", "tasks": []})
    with patch("app.graph.workflow.run_cto", return_value=mock_out), \
         patch("app.graph.workflow.run_pm", return_value=mock_out), \
         patch("app.graph.workflow.run_team_lead", return_value=mock_out), \
         patch("app.graph.workflow.run_uiux", return_value=mock_out), \
         patch("app.graph.workflow.run_developer", return_value=mock_out), \
         patch("app.graph.workflow.run_qa", return_value=mock_out), \
         patch("app.graph.workflow.run_ai_engineer", return_value=mock_out):

        result = app.invoke(
            {"project_id": "proj-lg", "requirement": "Build full stack app", "retries": 0, "history": []},
            config={"configurable": {"thread_id": "thread-1"}},
        )
        assert result["status"] == "completed"
