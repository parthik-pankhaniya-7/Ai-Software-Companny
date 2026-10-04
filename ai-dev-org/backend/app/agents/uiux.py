"""UI/UX Designer agent.

Responsible for interface architecture, user flows, screen hierarchy,
shadcn/ui component definitions, loading/error/empty states, and responsive design guidelines.
"""

from pydantic import BaseModel, Field

from app.models.agent import AgentInput, AgentOutput
from app.router.llm import call_llm

SYSTEM_PROMPT = """You are the UI/UX Designer. Create the user interface specification, component architecture, and design tokens for the requested frontend tasks.
Return strict JSON with keys:
user_flows (list of strings),
screens (list of strings),
components (list of strings),
states (object with keys: loading, error, empty),
accessibility_notes (list of strings),
responsive_notes (list of strings),
wireframe_description (string).

Rules:
- Design must follow Tailwind CSS and shadcn/ui guidelines.
- states must detail loading, error, and empty state visual/behavioral specs.
- no markdown fences.
"""


class UIUXStates(BaseModel):
    """UI state specifications for asynchronous operations."""
    loading: str = ""
    error: str = ""
    empty: str = ""


class UIUXOutput(BaseModel):
    """Structured artifact schema produced by the UI/UX agent."""
    user_flows: list[str] = Field(default_factory=list)
    screens: list[str] = Field(default_factory=list)
    components: list[str] = Field(default_factory=list)
    states: UIUXStates = Field(default_factory=UIUXStates)
    accessibility_notes: list[str] = Field(default_factory=list)
    responsive_notes: list[str] = Field(default_factory=list)
    wireframe_description: str = ""


def run_uiux(inp: AgentInput) -> AgentOutput:
    """Execute UI/UX design specification on the provided AgentInput and return AgentOutput."""
    ui_tasks = inp.context.get("ui_tasks", inp.context.get("technical_plan", inp.context))
    prompt = (
        f"Objective: {inp.objective}\n"
        f"Task: {inp.task}\n"
        f"UI Tasks & Context: {ui_tasks}\n"
        f"Constraints: {inp.constraints}\n"
        f"Acceptance Criteria: {inp.acceptance_criteria}"
    )

    result = call_llm(
        prompt=prompt,
        task_type="reasoning",
        complexity="medium",
        system=SYSTEM_PROMPT,
        json_mode=True,
        project_id=inp.project_id or "default",
        agent="uiux",
    )

    parsed = UIUXOutput.model_validate_json(result["text"])
    summary = f"UI/UX specifications completed: {len(parsed.screens)} screens, {len(parsed.components)} components defined."

    return AgentOutput(
        status="ok",
        summary=summary,
        actions=[
            f"Designed {len(parsed.screens)} screens",
            f"Specified {len(parsed.components)} shadcn/ui components",
            "Defined loading, error, and empty states",
        ],
        artifacts=parsed.model_dump(),
        recommendations=parsed.accessibility_notes + parsed.responsive_notes,
        next_action="developer",
        meta=result,
    )
