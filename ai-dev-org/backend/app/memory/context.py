"""Context assembly engine for ai-dev-org.

Aggregates project requirements, task definitions, acceptance criteria,
and semantic vector hits (or JSONL keyword fallback) into bounded agent prompt contexts.
"""

import logging
import os
from typing import Any

from app.memory import store, vectors

logger = logging.getLogger(__name__)

MAX_CHARS: int = 12000


def _is_use_chroma() -> bool:
    """Check if ChromaDB vector search is enabled in environment."""
    val = os.environ.get("USE_CHROMA", "true").strip().lower()
    return val in ("true", "1", "yes")


def _keyword_search_memory(project_id: str, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Perform keyword matching fallback on project JSONL memory entries."""
    memories = store.load_memory(project_id)
    if not memories or not query.strip():
        return memories[:limit] if memories else []

    query_tokens = set(query.lower().split())
    scored: list[tuple[int, dict[str, Any]]] = []

    for item in memories:
        content = item.get("content", "").lower()
        ref_id = item.get("ref_id", "").lower()
        kind = item.get("kind", "").lower()
        text_corpus = f"{ref_id} {kind} {content}"

        score = sum(1 for token in query_tokens if token in text_corpus)
        if score > 0:
            scored.append((score, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    if scored:
        return [
            {
                "ref_id": item.get("ref_id", ""),
                "content": item.get("content", ""),
                "kind": item.get("kind", "memory"),
                "score": score,
            }
            for score, item in scored[:limit]
        ]
    return [
        {
            "ref_id": item.get("ref_id", ""),
            "content": item.get("content", ""),
            "kind": item.get("kind", "memory"),
            "score": 0.0,
        }
        for item in memories[:limit]
    ]


def build_task_context(project_id: str, task_id: str, query: str) -> str:
    """Assemble bounded task execution context from store and vector/keyword search.

    Args:
        project_id: Target project identifier.
        task_id: Active task identifier.
        query: Semantic or keyword search query for retrieving memory/artifacts.

    Returns:
        str: Assembled context string truncated to MAX_CHARS.
    """
    # 1. Load project
    project = store.load_project(project_id) or {}
    requirement = project.get("requirement") or project.get("description", "No requirement specified.")

    # 2. Load task
    tasks = store.load_tasks(project_id)
    target_task: dict[str, Any] = {}
    for t in tasks:
        if t.get("id") == task_id or t.get("task_id") == task_id:
            target_task = t
            break

    task_title = target_task.get("title", f"Task {task_id}")
    task_desc = target_task.get("description", "No description provided.")
    acceptance_criteria = target_task.get("acceptance_criteria", [])

    # 3. Retrieve relevant memory hits
    hits: list[dict[str, Any]] = []
    if _is_use_chroma():
        try:
            hits = vectors.search(project_id, query=query, k=5)
        except Exception as exc:
            logger.warning("Chroma search failed (%s); falling back to keyword search", exc)
            hits = _keyword_search_memory(project_id, query=query, limit=5)
    else:
        hits = _keyword_search_memory(project_id, query=query, limit=5)

    # 4. Assemble context sections
    sections: list[str] = [
        f"=== PROJECT REQUIREMENT ===\n{requirement}",
        f"\n=== ASSIGNED TASK [{task_id}] ===\nTitle: {task_title}\nDescription: {task_desc}",
    ]

    if acceptance_criteria:
        ac_lines = "\n".join(f"- {ac}" for ac in acceptance_criteria)
        sections.append(f"\n=== ACCEPTANCE CRITERIA ===\n{ac_lines}")

    if hits:
        hit_lines: list[str] = []
        for i, hit in enumerate(hits, 1):
            ref = hit.get("ref_id", f"hit-{i}")
            kind = hit.get("kind", "doc")
            content = hit.get("content", "")
            score = hit.get("score", 0.0)
            hit_lines.append(f"[{i}] ({kind}) {ref} (score: {score:.2f}):\n{content}")
        sections.append(f"\n=== RELEVANT CONTEXT & MEMORY HITS ===\n" + "\n\n".join(hit_lines))

    assembled = "\n".join(sections).strip()

    # 5. Enforce MAX_CHARS bound
    if len(assembled) > MAX_CHARS:
        assembled = assembled[:MAX_CHARS]

    return assembled
