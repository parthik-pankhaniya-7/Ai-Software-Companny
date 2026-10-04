"""Chief Technology Officer (CTO) agent.

Responsible for high-level technical architecture, feasibility analysis,
business and functional requirements evaluation, risk analysis, and technical governance.
"""

from pydantic import BaseModel, Field

from app.models.agent import AgentInput, AgentOutput
from app.router.llm import call_llm

SYSTEM_PROMPT = """You are the CTO. Analyze the requirement and return strict JSON with keys:
brd (string or null), frd (string or null), architecture (string),
risks (list), nfr (list), acceptance_criteria (list),
open_questions (list), recommended_docs (list).

Rules:
- include brd if business context exists
- include frd if functional behavior exists
- include both when applicable
- no markdown fences
"""


class CTOOutput(BaseModel):
    """Structured artifact schema produced by the CTO agent."""
    brd: str | None = None
    frd: str | None = None
    architecture: str
    risks: list[str] = Field(default_factory=list)
    nfr: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    recommended_docs: list[str] = Field(default_factory=list)


def run_cto(inp: AgentInput) -> AgentOutput:
    """Execute CTO analysis on the provided AgentInput and return AgentOutput."""
    prompt = (
        f"Objective: {inp.objective}\n"
        f"Task: {inp.task}\n"
        f"Context: {inp.context}\n"
        f"Constraints: {inp.constraints}\n"
        f"Acceptance Criteria: {inp.acceptance_criteria}"
    )

    result = call_llm(
        prompt=prompt,
        task_type="reasoning",
        complexity="high",
        system=SYSTEM_PROMPT,
        json_mode=True,
        project_id=inp.project_id or "default",
        agent="cto",
    )

    parsed = CTOOutput.model_validate_json(result["text"])
    summary = f"CTO technical analysis completed for: {inp.task}"

    return AgentOutput(
        status="ok",
        summary=summary,
        actions=["Analyzed requirements", "Evaluated risks and NFRs", "Synthesized system architecture"],
        artifacts=parsed.model_dump(),
        questions=parsed.open_questions,
        risks=parsed.risks,
        recommendations=parsed.recommended_docs,
        meta=result,
    )
