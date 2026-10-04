"""Router package for ai-dev-org."""

from .llm import MODEL_MAP, call_llm, route_task

__all__ = ["call_llm", "route_task", "MODEL_MAP"]
