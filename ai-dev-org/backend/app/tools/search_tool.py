"""Semantic search tool for ai-dev-org.

Queries ChromaDB vector collections when USE_CHROMA is enabled,
or falls back to keyword matching over persistent JSONL memory logs.
"""

import logging
import os
from typing import Any

from app.memory import store, vectors

logger = logging.getLogger(__name__)


def _is_use_chroma() -> bool:
    """Check if ChromaDB is enabled via USE_CHROMA environment variable."""
    val = os.environ.get("USE_CHROMA", "true").strip().lower()
    return val in ("true", "1", "yes")


def _keyword_search_memory(project_id: str, query: str, k: int = 5) -> list[dict[str, Any]]:
    """Perform keyword matching fallback on project JSONL memory entries."""
    memories = store.load_memory(project_id)
    if not memories:
        return []

    query_tokens = set(query.lower().split())
    if not query_tokens:
        return [
            {
                "kind": item.get("kind", "memory"),
                "ref_id": item.get("ref_id", ""),
                "snippet": item.get("content", ""),
                "score": 0.0,
            }
            for item in memories[:k]
        ]

    scored: list[tuple[int, dict[str, Any]]] = []
    for item in memories:
        content = item.get("content", "").lower()
        ref_id = item.get("ref_id", "").lower()
        kind = item.get("kind", "").lower()
        text_corpus = f"{ref_id} {kind} {content}"

        match_count = sum(1 for token in query_tokens if token in text_corpus)
        if match_count > 0:
            scored.append((match_count, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        return [
            {
                "kind": item.get("kind", "memory"),
                "ref_id": item.get("ref_id", ""),
                "snippet": item.get("content", ""),
                "score": float(count),
            }
            for count, item in scored[:k]
        ]

    return [
        {
            "kind": item.get("kind", "memory"),
            "ref_id": item.get("ref_id", ""),
            "snippet": item.get("content", ""),
            "score": 0.0,
        }
        for item in memories[:k]
    ]


def semantic_search(project_id: str, query: str, k: int = 5) -> list[dict[str, Any]]:
    """Search for relevant snippets using Chroma vector search or keyword fallback.

    Args:
        project_id: Target project identifier.
        query: Semantic or keyword search string.
        k: Maximum number of results to return.

    Returns:
        list[dict]: List of objects with keys: {kind, ref_id, snippet, score}
    """
    if _is_use_chroma():
        try:
            hits = vectors.search(project_id, query, k=k)
            return [
                {
                    "kind": hit.get("kind", "doc"),
                    "ref_id": hit.get("ref_id", ""),
                    "snippet": hit.get("content", ""),
                    "score": float(hit.get("score", 0.0)),
                }
                for hit in hits
            ]
        except Exception as exc:
            logger.warning("Chroma search failed (%s); falling back to keyword search", exc)
            return _keyword_search_memory(project_id, query, k=k)

    return _keyword_search_memory(project_id, query, k=k)
