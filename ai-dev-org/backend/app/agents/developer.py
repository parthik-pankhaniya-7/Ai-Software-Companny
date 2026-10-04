"""Senior Software Developer agent.

Responsible for writing clean, modular, production-ready source code
and comprehensive unit/integration test suites across backend and frontend stacks.
"""

from pydantic import BaseModel, Field

from app.models.agent import AgentInput, AgentOutput
from app.router.llm import call_llm

SYSTEM_PROMPT = """You are the Senior Software Developer. Implement full, production-ready code and comprehensive test suites for the assigned task.
Return strict JSON with keys:
code_blocks (list of objects with keys: path, language, code),
tests (list of objects with keys: path, language, code),
notes (string),
assumptions (list of strings).

Rules:
- path must be a repo-relative file path.
- language must be a recognized language identifier (e.g. python, typescript, json).
- code must be complete and valid; never leave '# TODO' placeholders or pseudo-code unless explicitly instructed.
- All backend code must adhere to PEP8, type annotations, and docstrings.
- All frontend code must use functional React components and Tailwind CSS.
- no markdown fences.
"""


class CodeBlock(BaseModel):
    """File path, language, and code content representation."""
    path: str
    language: str = "python"
    code: str


class DeveloperOutput(BaseModel):
    """Structured artifact schema produced by the Developer agent."""
    code_blocks: list[CodeBlock] = Field(default_factory=list)
    tests: list[CodeBlock] = Field(default_factory=list)
    notes: str = ""
    assumptions: list[str] = Field(default_factory=list)


def run_developer(inp: AgentInput) -> AgentOutput:
    """Execute code and test implementation on the provided AgentInput and return AgentOutput."""
    prompt = (
        f"Objective: {inp.objective}\n"
        f"Task: {inp.task}\n"
        f"Context: {inp.context}\n"
        f"Constraints: {inp.constraints}\n"
        f"Acceptance Criteria: {inp.acceptance_criteria}"
    )

    result = call_llm(
        prompt=prompt,
        task_type="coding",
        complexity="high",
        system=SYSTEM_PROMPT,
        json_mode=True,
    )

    parsed = DeveloperOutput.model_validate_json(result["text"])
    summary = f"Developer implemented {len(parsed.code_blocks)} code files and {len(parsed.tests)} test files for: {inp.task}"

    return AgentOutput(
        status="ok",
        summary=summary,
        actions=[
            f"Implemented {len(parsed.code_blocks)} code modules",
            f"Created {len(parsed.tests)} test suites",
        ],
        artifacts=parsed.model_dump(),
        recommendations=parsed.assumptions,
        next_action="qa",
        meta=result,
    )
