"""AI Engineer agent.

Responsible for model routing evaluation, token budget optimization,
context window tuning, prompt engineering analysis, and graph orchestration parameters.
"""

from pydantic import BaseModel, Field

from app.models.agent import AgentInput, AgentOutput
from app.router.llm import call_llm

SYSTEM_PROMPT = """You are the AI Engineer. Evaluate model routing policies, context window budgets, token allocations, parallelization opportunities, and system prompts.
Return strict JSON with keys:
decision (string),
model (string),
token_budget (integer),
parallel (boolean),
retry (boolean),
escalate (boolean),
reason (string).

Rules:
- decision must summarize the evaluation (e.g. "proceed", "retry", "escalate", "complete").
- model must be a valid Gemini identifier (e.g. "gemini/gemini-1.5-pro", "gemini/gemini-1.5-flash", "gemini/gemini-2.0-flash").
- token_budget must be a realistic integer token ceiling.
- parallel indicates whether subtasks can run concurrently.
- retry indicates if a prior agent step must be retried with revised parameters.
- escalate indicates if human intervention is necessary.
- no markdown fences.
"""


class AIEngineerOutput(BaseModel):
    """Structured artifact schema produced by the AI Engineer agent."""
    decision: str
    model: str
    token_budget: int = 4000
    parallel: bool = False
    retry: bool = False
    escalate: bool = False
    reason: str = ""


def run_ai_engineer(inp: AgentInput) -> AgentOutput:
    """Execute AI Engineer optimization/evaluation and return AgentOutput."""
    prompt = (
        f"Objective: {inp.objective}\n"
        f"Task: {inp.task}\n"
        f"Context & Upstream Artifacts: {inp.context}\n"
        f"Constraints: {inp.constraints}\n"
        f"Acceptance Criteria: {inp.acceptance_criteria}"
    )

    result = call_llm(
        prompt=prompt,
        task_type="routing",
        complexity="any",
        system=SYSTEM_PROMPT,
        json_mode=True,
    )

    parsed = AIEngineerOutput.model_validate_json(result["text"])

    if parsed.escalate:
        agent_status = "escalate"
        next_action = "human_escalation"
    elif parsed.retry:
        agent_status = "retry"
        next_action = "developer"
    else:
        agent_status = "ok"
        next_action = "done"

    summary = (
        f"AI Engineer evaluation: Decision={parsed.decision}, Model={parsed.model}, "
        f"Budget={parsed.token_budget}, Next={next_action}."
    )

    return AgentOutput(
        status=agent_status,
        summary=summary,
        actions=[
            f"Evaluated model policy ({parsed.model})",
            f"Set token budget to {parsed.token_budget}",
            f"Determined parallel execution: {parsed.parallel}",
        ],
        artifacts=parsed.model_dump(),
        recommendations=[parsed.reason] if parsed.reason else [],
        next_action=next_action,
        meta=result,
    )
