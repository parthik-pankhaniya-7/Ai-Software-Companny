"""Tests for backend/app/memory/store.py."""

from pathlib import Path
import pytest

from app.memory.store import (
    add_memory,
    append_message,
    init_db,
    list_projects,
    load_lg_state,
    load_memory,
    load_messages,
    load_project,
    load_tasks,
    save_lg_state,
    save_project,
    save_task,
)


@pytest.fixture(autouse=True)
def setup_tmp_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Point DATA_DIR to a temporary directory and clean up after."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    init_db()
    yield tmp_path


def test_project_round_trip() -> None:
    project_data = {
        "id": "proj-alpha",
        "name": "Project Alpha",
        "status": "active",
        "description": "A test project",
    }
    save_project(project_data)

    loaded = load_project("proj-alpha")
    assert loaded == project_data

    projects = list_projects()
    assert len(projects) == 1
    assert projects[0]["id"] == "proj-alpha"

    assert load_project("non-existent") is None


def test_task_round_trip() -> None:
    task_1 = {
        "id": "task-001",
        "title": "Setup repository structure",
        "status": "in_progress",
    }
    save_task("proj-alpha", task_1)

    tasks = load_tasks("proj-alpha")
    assert len(tasks) == 1
    assert tasks[0]["id"] == "task-001"
    assert tasks[0]["status"] == "in_progress"

    task_1_updated = {
        "id": "task-001",
        "title": "Setup repository structure",
        "status": "completed",
    }
    save_task("proj-alpha", task_1_updated)
    tasks_after_update = load_tasks("proj-alpha")
    assert len(tasks_after_update) == 1
    assert tasks_after_update[0]["status"] == "completed"

    task_2 = {
        "id": "task-002",
        "title": "Write store tests",
        "status": "pending",
    }
    save_task("proj-alpha", task_2)
    tasks_all = load_tasks("proj-alpha")
    assert len(tasks_all) == 2


def test_message_round_trip() -> None:
    msg_1 = {
        "sender": "CTO",
        "role": "agent",
        "text": "System architecture design initiated.",
    }
    append_message("proj-alpha", msg_1)

    msg_2 = {
        "sender": "PM",
        "role": "agent",
        "text": "Breakdown ready for review.",
    }
    append_message("proj-alpha", msg_2)

    messages = load_messages("proj-alpha")
    assert len(messages) == 2
    assert messages[0]["sender"] == "CTO"
    assert messages[0]["text"] == "System architecture design initiated."
    assert "timestamp" in messages[0]
    assert messages[1]["sender"] == "PM"


def test_memory_round_trip() -> None:
    add_memory(
        project_id="proj-alpha",
        kind="decision",
        ref_id="adr-001",
        content="Use JSON files instead of relational database.",
    )
    add_memory(
        project_id="proj-alpha",
        kind="constraint",
        ref_id="sec-002",
        content="Never commit secrets or tokens.",
    )

    memories = load_memory("proj-alpha")
    assert len(memories) == 2
    assert memories[0]["kind"] == "decision"
    assert memories[0]["ref_id"] == "adr-001"
    assert "created_at" in memories[0]
    assert memories[1]["kind"] == "constraint"


def test_langgraph_state_round_trip() -> None:
    state_data = {
        "current_step": "developer",
        "retries": 1,
        "artifacts": {"code": "def hello(): pass"},
    }
    save_lg_state("proj-alpha", state_data)

    loaded = load_lg_state("proj-alpha")
    assert loaded == state_data

    assert load_lg_state("non-existent") is None
