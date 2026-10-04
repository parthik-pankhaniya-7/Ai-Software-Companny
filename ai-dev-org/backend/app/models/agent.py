"""Pydantic v2 domain and agent models for ai-dev-org.

Defines core schemas for messages, tasks, projects, agent I/O contracts,
handoffs, approvals, and associated state enums.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any
import uuid

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Enumeration of possible task states."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class ProjectStatus(str, Enum):
    """Enumeration of project lifecycle states."""
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class MessageType(str, Enum):
    """Enumeration of communication message types."""
    TEXT = "text"
    TASK = "task"
    HANDOFF = "handoff"
    APPROVAL = "approval"
    SYSTEM = "system"
    ERROR = "error"


def _utc_now() -> datetime:
    """Helper to return timezone-aware UTC current time."""
    return datetime.now(timezone.utc)


class Message(BaseModel):
    """Message exchanged between agents or between agents and the system."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    task_id: str | None = None
    sender: str
    receiver: str
    type: MessageType = MessageType.TEXT
    priority: str = "normal"
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=_utc_now)


class Task(BaseModel):
    """Discrete unit of work allocated to an agent."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    title: str
    description: str = ""
    assigned_to: str | None = None
    status: TaskStatus = TaskStatus.PENDING
    dependencies: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    artifacts: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)


class Project(BaseModel):
    """Top-level project containing requirements, state, artifacts, and tasks."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requirement: str
    status: ProjectStatus = ProjectStatus.PLANNING
    phase: str = "initiation"
    artifacts: dict[str, Any] = Field(default_factory=dict)
    tasks: list[Task] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)


class AgentInput(BaseModel):
    """Universal input contract for agent execution."""
    role: str
    objective: str
    task: str
    context: dict[str, Any] = Field(default_factory=dict)
    constraints: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    expected_output: str
    acceptance_criteria: list[str] = Field(default_factory=list)
    token_budget: int = 4000
    model_policy: str = "reasoning/high"


class AgentOutput(BaseModel):
    """Universal output contract returned by agent execution."""
    status: str = "ok"
    summary: str = ""
    actions: list[str] = Field(default_factory=list)
    artifacts: dict[str, Any] = Field(default_factory=dict)
    questions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    validation: dict[str, Any] = Field(default_factory=dict)
    next_action: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class Handoff(BaseModel):
    """Transition record when work transfers between agents."""
    from_agent: str
    to_agent: str
    task_id: str
    artifacts: dict[str, Any] = Field(default_factory=dict)
    notes: str = ""
    timestamp: datetime = Field(default_factory=_utc_now)


class Approval(BaseModel):
    """Human or governance approval record for milestone gates."""
    task_id: str
    approver: str
    decision: str
    reason: str = ""
    timestamp: datetime = Field(default_factory=_utc_now)
