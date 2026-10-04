"""Tests for backend/app/memory/vectors.py."""

from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from app.memory import vectors


@pytest.fixture
def tmp_chroma_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Configure DATA_DIR to use a temporary directory for tests."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    return tmp_path


def test_index_upsert_called(tmp_chroma_dir: Path) -> None:
    mock_collection = MagicMock()
    mock_client = MagicMock()
    mock_client.get_or_create_collection.return_value = mock_collection

    with patch.object(vectors, "_get_client", return_value=mock_client), \
         patch.object(vectors, "_get_embedding_function", return_value=MagicMock()):
        vectors.index("proj-alpha", "doc-1", "Authentication module", kind="spec")

        mock_collection.upsert.assert_called_once_with(
            ids=["doc-1"],
            documents=["Authentication module"],
            metadatas=[{"kind": "spec", "ref_id": "doc-1"}],
        )


def test_search_results_structure(tmp_chroma_dir: Path) -> None:
    mock_collection = MagicMock()
    mock_collection.count.return_value = 2
    mock_collection.query.return_value = {
        "ids": [["doc-1", "doc-2"]],
        "documents": [["Auth code", "Route code"]],
        "metadatas": [[{"kind": "code", "ref_id": "doc-1"}, {"kind": "code", "ref_id": "doc-2"}]],
        "distances": [[0.12, 0.45]],
    }
    mock_client = MagicMock()
    mock_client.get_or_create_collection.return_value = mock_collection

    with patch.object(vectors, "_get_client", return_value=mock_client), \
         patch.object(vectors, "_get_embedding_function", return_value=MagicMock()):
        results = vectors.search("proj-alpha", "authentication query", k=5)

        assert len(results) == 2
        assert results[0]["ref_id"] == "doc-1"
        assert results[0]["content"] == "Auth code"
        assert results[0]["kind"] == "code"
        assert results[0]["score"] == 0.12
        assert results[1]["ref_id"] == "doc-2"


def test_search_empty_returns_empty_list(tmp_chroma_dir: Path) -> None:
    mock_collection = MagicMock()
    mock_collection.count.return_value = 0
    mock_client = MagicMock()
    mock_client.get_or_create_collection.return_value = mock_collection

    with patch.object(vectors, "_get_client", return_value=mock_client):
        results = vectors.search("proj-alpha", "any query", k=5)
        assert results == []


def test_real_chromadb_if_installed(tmp_chroma_dir: Path) -> None:
    """Integration test executed when chromadb package is available."""
    pytest.importorskip("chromadb")
    vectors.index("proj-live", "live-1", "Local multi-agent architecture", kind="arch")
    results = vectors.search("proj-live", "architecture", k=1)
    assert len(results) == 1
    assert results[0]["ref_id"] == "live-1"
    assert "architecture" in results[0]["content"].lower()
