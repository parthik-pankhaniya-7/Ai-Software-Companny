"""Team Lead agent.

Responsible for converting PM tasks into a concrete technical execution plan,
defining file boundaries, technical implementation steps, UI requirement flags,
and coordinating developer and designer allocations.
"""

from pydantic import BaseModel, Field

from app.models.agent import AgentInput, AgentOutput
from app.router.llm import call_llm

SYSTEM_PROMPT = """You are the Team Lead. Convert project manager tasks into a detailed technical execution plan.
Return strict JSON with keys:
technical_plan (list of objects with keys: task_id, technical_steps, files_to_touch, ui_needed, assigned_agent),
blockers (list of strings),
dependencies (list of strings).

Rules:
- task_id must match the upstream PM task ID.
- technical_steps must be a list of concrete implementation steps.
- files_to_touch must be a list of repo-relative file paths.
- ui_needed must be a boolean indicating whether UI/UX design tokens/components are needed.
- assigned_agent must be one of: developer, uiux, qa, ai_engineer.
- no markdown fences.
"""


class TechnicalTaskPlan(BaseModel):
    """Detailed technical breakdown per PM task."""
    task_id: str
    technical_steps: list[str] = Field(default_factory=list)
    files_to_touch: list[str] = Field(default_factory=list)
    ui_needed: bool = False
    assigned_agent: str = "developer"


class TeamLeadOutput(BaseModel):
    """Structured artifact schema produced by the Team Lead agent."""
    technical_plan: list[TechnicalTaskPlan] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)


def run_team_lead(inp: AgentInput) -> AgentOutput:
    """Execute Team Lead technical planning on the provided AgentInput and return AgentOutput."""
    pm_tasks = inp.context.get("tasks", inp.context.get("pm_artifacts", inp.context))
    prompt = (
        f"Objective: {inp.objective}\n"
        f"Task: {inp.task}\n"
        f"PM Tasks & Context: {pm_tasks}\n"
        f"Constraints: {inp.constraints}\n"
        f"Acceptance Criteria: {inp.acceptance_criteria}"
    )

    result = call_llm(
        prompt=prompt,
        task_type="reasoning",
        complexity="medium",
        system=SYSTEM_PROMPT,
        json_mode=True,
    )

    parsed = TeamLeadOutput.model_validate_json(result["text"])
    has_ui = any(item.ui_needed for item in parsed.technical_plan)
    next_action = "uiux" if has_ui else "developer"
    summary = f"Team Lead generated technical plan with {len(parsed.technical_plan)} items (UI required: {has_ui})."

    return AgentOutput(
        status="ok",
        summary=summary,
        actions=[
            f"Planned {len(parsed.technical_plan)} technical task items",
            f"Identified {len(parsed.blockers)} blockers",
        ],
        artifacts=parsed.model_dump(),
        blockers=parsed.blockers,
        next_action=next_action,
        meta=result,
    )
