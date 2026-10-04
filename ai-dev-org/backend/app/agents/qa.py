"""QA/QC Verification Engineer agent.

Responsible for reviewing source code against acceptance criteria,
executing test assertions, detecting defects, and determining pass/fail readiness.
"""

from typing import Literal
from pydantic import BaseModel, Field

from app.models.agent import AgentInput, AgentOutput
from app.router.llm import call_llm

SYSTEM_PROMPT = """You are the QA/QC Verification Engineer. Audit the implemented code against the task requirements and acceptance criteria.
Return strict JSON with keys:
status ("pass" or "fail"),
test_cases (list of strings),
defects (list of objects with keys: severity, description, evidence),
evidence (string),
retest_required (boolean).

Rules:
- status must be strictly "pass" or "fail".
- severity must be "critical", "major", or "minor".
- If defects exist, status should be "fail" and retest_required must be true.
- If all acceptance criteria are met and no blocking defects exist, status is "pass" and retest_required is false.
- no markdown fences.
"""


class Defect(BaseModel):
    """Defect report entry."""
    severity: str = "minor"
    description: str
    evidence: str = ""


class QAOutput(BaseModel):
    """Structured artifact schema produced by the QA/QC agent."""
    status: Literal["pass", "fail"]
    test_cases: list[str] = Field(default_factory=list)
    defects: list[Defect] = Field(default_factory=list)
    evidence: str = ""
    retest_required: bool = False


def run_qa(inp: AgentInput) -> AgentOutput:
    """Execute QA audit and verification on the provided AgentInput and return AgentOutput."""
    prompt = (
        f"Objective: {inp.objective}\n"
        f"Task: {inp.task}\n"
        f"Context & Code Artifacts: {inp.context}\n"
        f"Constraints: {inp.constraints}\n"
        f"Acceptance Criteria: {inp.acceptance_criteria}"
    )

    result = call_llm(
        prompt=prompt,
        task_type="doc",
        complexity="any",
        system=SYSTEM_PROMPT,
        json_mode=True,
        project_id=inp.project_id or "default",
        agent="qa",
    )

    parsed = QAOutput.model_validate_json(result["text"])
    agent_status = "ok" if parsed.status == "pass" else "retry"
    next_action = "ai_engineer" if parsed.status == "pass" and not parsed.retest_required else "developer"
    summary = (
        f"QA audit completed: Status={parsed.status.upper()}, "
        f"{len(parsed.defects)} defects found, Retest={parsed.retest_required}."
    )

    return AgentOutput(
        status=agent_status,
        summary=summary,
        actions=[
            f"Executed {len(parsed.test_cases)} verification test cases",
            f"Logged {len(parsed.defects)} defects",
        ],
        artifacts=parsed.model_dump(),
        risks=[d.description for d in parsed.defects],
        validation={"passed": parsed.status == "pass", "evidence": parsed.evidence},
        next_action=next_action,
        meta=result,
    )
