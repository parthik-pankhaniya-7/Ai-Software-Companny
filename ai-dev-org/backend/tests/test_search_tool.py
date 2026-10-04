"""Tests for backend/app/tools/search_tool.py."""

from pathlib import Path
from unittest.mock import patch
import pytest

from app.memory import store
from app.tools import search_tool


@pytest.fixture
def tmp_search_data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Setup temporary DATA_DIR for isolated search tool tests."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    store.init_db()
    return tmp_path


def test_semantic_search_with_chroma(tmp_search_data: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test semantic_search with Chroma enabled."""
    monkeypatch.setenv("USE_CHROMA", "true")
    project_id = "proj-search-01"

    mock_hits = [
        {
            "ref_id": "adr-001",
            "kind": "architecture",
            "content": "Single process event pub/sub with asyncio.Queue",
            "score": 0.15,
        }
    ]

    with patch("app.memory.vectors.search", return_value=mock_hits) as mock_search:
        results = search_tool.semantic_search(project_id, "asyncio queue", k=3)
        mock_search.assert_called_once_with(project_id, query="asyncio queue", k=3)

        assert len(results) == 1
        assert results[0]["kind"] == "architecture"
        assert results[0]["ref_id"] == "adr-001"
        assert results[0]["snippet"] == "Single process event pub/sub with asyncio.Queue"
        assert results[0]["score"] == 0.15


def test_semantic_search_keyword_fallback(tmp_search_data: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test semantic_search keyword search on memory JSONL."""
    monkeypatch.setenv("USE_CHROMA", "false")
    project_id = "proj-search-02"

    store.add_memory(project_id, "pattern", "pat-01", "Use atomic write replacement via os.replace")
    store.add_memory(project_id, "rule", "sec-01", "Never log API keys or secrets")

    results = search_tool.semantic_search(project_id, "atomic write", k=2)

    assert len(results) >= 1
    assert results[0]["ref_id"] == "pat-01"
    assert "atomic write" in results[0]["snippet"].lower()
    assert results[0]["score"] > 0
    assert "kind" in results[0]
    assert "snippet" in results[0]


def test_semantic_search_empty_returns_empty(tmp_search_data: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test searching a project with no memories returns an empty list."""
    monkeypatch.setenv("USE_CHROMA", "false")
    results = search_tool.semantic_search("empty-proj", "anything", k=5)
    assert results == []
