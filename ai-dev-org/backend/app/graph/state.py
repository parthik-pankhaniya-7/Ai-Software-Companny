"""LangGraph state schema for ai-dev-org.

Defines the TypedDict representation of project execution state,
retained and updated across the multi-agent graph nodes.
"""

from typing import Any, TypedDict


class ProjectState(TypedDict, total=False):
    """Complete multi-agent execution state for a project."""
    project_id: str
    requirement: str
    brd: str | None
    frd: str | None
    tasks: list[dict[str, Any]]
    current_task: dict[str, Any] | None
    status: str
    feedback: str | None
    retries: int
    history: list[dict[str, Any]]
    ui_needed: bool
