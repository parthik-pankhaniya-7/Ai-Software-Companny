"""Tests for backend/app/memory/context.py."""

from pathlib import Path
from unittest.mock import patch
import pytest

from app.memory import context, store


@pytest.fixture
def setup_context_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Setup temporary DATA_DIR for isolated context tests."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    store.init_db()
    return tmp_path


def test_build_task_context_with_chroma(setup_context_env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test context assembly using mocked Chroma vector search."""
    monkeypatch.setenv("USE_CHROMA", "true")
    project_id = "proj-ctx-01"
    task_id = "task-ctx-101"

    store.save_project({
        "id": project_id,
        "requirement": "Build a resilient distributed AI dev organization.",
    })

    store.save_task(project_id, {
        "id": task_id,
        "title": "Implement LiteLLM Router",
        "description": "Route calls to Gemini models with fallback.",
        "acceptance_criteria": ["Retry 429", "Fallback to Flash after 2 Pro errors"],
    })

    mock_vector_hits = [
        {"ref_id": "adr-002", "kind": "adr", "content": "Use LiteLLM for routing", "score": 0.1},
    ]

    with patch("app.memory.vectors.search", return_value=mock_vector_hits):
        ctx = context.build_task_context(project_id, task_id, query="LiteLLM router")

        assert "=== PROJECT REQUIREMENT ===" in ctx
        assert "Build a resilient distributed AI dev organization." in ctx
        assert "=== ASSIGNED TASK [task-ctx-101] ===" in ctx
        assert "Implement LiteLLM Router" in ctx
        assert "=== ACCEPTANCE CRITERIA ===" in ctx
        assert "- Retry 429" in ctx
        assert "=== RELEVANT CONTEXT & MEMORY HITS ===" in ctx
        assert "Use LiteLLM for routing" in ctx


def test_build_task_context_keyword_fallback(setup_context_env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test context assembly with USE_CHROMA=false falling back to keyword search."""
    monkeypatch.setenv("USE_CHROMA", "false")
    project_id = "proj-kw-02"
    task_id = "task-kw-202"

    store.save_project({
        "id": project_id,
        "requirement": "Local JSON store only.",
    })

    store.save_task(project_id, {
        "id": task_id,
        "title": "Build store.py",
        "description": "Atomic file replace helper.",
        "acceptance_criteria": ["No database"],
    })

    store.add_memory(project_id, "decision", "adr-json", "All persistence stored in local JSON files.")

    ctx = context.build_task_context(project_id, task_id, query="persistence files")

    assert "Local JSON store only." in ctx
    assert "Build store.py" in ctx
    assert "No database" in ctx
    assert "All persistence stored in local JSON files." in ctx


def test_max_chars_truncation(setup_context_env: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that context is strictly bounded by MAX_CHARS."""
    project_id = "proj-large"
    task_id = "task-large"

    huge_requirement = "A" * (context.MAX_CHARS + 5000)
    store.save_project({
        "id": project_id,
        "requirement": huge_requirement,
    })

    ctx = context.build_task_context(project_id, task_id, query="any")
    assert len(ctx) == context.MAX_CHARS
