"""Tests for backend/app/models/agent.py."""

from datetime import datetime, timezone
import pytest

pydantic = pytest.importorskip("pydantic")

from app.models.agent import (
    AgentInput,
    AgentOutput,
    Approval,
    Handoff,
    Message,
    MessageType,
    Project,
    ProjectStatus,
    Task,
    TaskStatus,
)


def test_instantiation_1_message() -> None:
    """Sample instantiation 1: Message."""
    msg = Message(
        id="msg-101",
        project_id="proj-core",
        task_id="task-01",
        sender="CTO",
        receiver="PM",
        type=MessageType.TASK,
        priority="high",
        payload={"instruction": "Prepare sprint backlog for review"},
    )
    assert msg.id == "msg-101"
    assert msg.sender == "CTO"
    assert msg.type == MessageType.TASK
    assert msg.priority == "high"
    assert msg.payload["instruction"] == "Prepare sprint backlog for review"
    dump = msg.model_dump()
    assert isinstance(dump, dict)
    assert dump["project_id"] == "proj-core"


def test_instantiation_2_task() -> None:
    """Sample instantiation 2: Task."""
    task = Task(
        id="task-202",
        project_id="proj-core",
        title="Implement memory store",
        description="Write store.py using atomic file replacements",
        assigned_to="developer",
        status=TaskStatus.IN_PROGRESS,
        dependencies=["task-201"],
        acceptance_criteria=["Atomic write", "No SQL database"],
        artifacts={"file": "backend/app/memory/store.py"},
    )
    assert task.id == "task-202"
    assert task.status == TaskStatus.IN_PROGRESS
    assert len(task.acceptance_criteria) == 2
    assert "task-201" in task.dependencies
    assert task.artifacts["file"] == "backend/app/memory/store.py"


def test_instantiation_3_project() -> None:
    """Sample instantiation 3: Project with nested tasks."""
    task = Task(
        id="task-301",
        project_id="proj-ai-dev",
        title="Architect agent graphs",
        assigned_to="cto",
        status=TaskStatus.COMPLETED,
    )
    project = Project(
        id="proj-ai-dev",
        requirement="Build a local-first multi-agent developer system",
        status=ProjectStatus.IN_PROGRESS,
        phase="development",
        artifacts={"architecture_doc": "docs/architecture.md"},
        tasks=[task],
    )
    assert project.id == "proj-ai-dev"
    assert project.status == ProjectStatus.IN_PROGRESS
    assert len(project.tasks) == 1
    assert project.tasks[0].id == "task-301"
    dumped = project.model_dump()
    assert dumped["tasks"][0]["status"] == "completed"


def test_instantiation_4_agent_io() -> None:
    """Sample instantiation 4: AgentInput and AgentOutput."""
    inp = AgentInput(
        role="Developer",
        objective="Implement models package",
        task="Create agent.py with Pydantic v2 schemas",
        context={"specs": "Message, Task, Project"},
        constraints=["Pydantic v2 only", "PEP8"],
        tools=["file_writer"],
        expected_output="Valid Pydantic models with enums",
        acceptance_criteria=["Compiles", "Exports all schemas"],
        token_budget=3000,
        model_policy="coding/low",
    )
    assert inp.role == "Developer"
    assert inp.model_policy == "coding/low"

    out = AgentOutput(
        status="ok",
        summary="Models implemented successfully",
        actions=["Created agent.py", "Added test suite"],
        artifacts={"models": ["Message", "Task", "Project", "AgentInput", "AgentOutput"]},
        recommendations=["Run mypy verification"],
        validation={"passed": True},
        next_action="handoff_to_qa",
    )
    assert out.status == "ok"
    assert len(out.artifacts["models"]) == 5
    assert out.validation["passed"] is True


def test_instantiation_5_handoff_and_approval() -> None:
    """Sample instantiation 5: Handoff and Approval."""
    handoff = Handoff(
        from_agent="Developer",
        to_agent="QA",
        task_id="task-404",
        artifacts={"test_file": "backend/tests/test_models.py"},
        notes="All unit schemas defined and tested.",
    )
    assert handoff.from_agent == "Developer"
    assert handoff.to_agent == "QA"
    assert handoff.artifacts["test_file"] == "backend/tests/test_models.py"

    approval = Approval(
        task_id="task-404",
        approver="Human Lead",
        decision="approved",
        reason="Test suite covers all model fields and serializations",
    )
    assert approval.approver == "Human Lead"
    assert approval.decision == "approved"
    assert isinstance(approval.timestamp, datetime)
