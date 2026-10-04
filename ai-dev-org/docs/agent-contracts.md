# Agent Contracts Specification

This document defines the universal input and output schema for all agents in `ai-dev-org`, followed by the specific responsibilities and model policies for each agent role.

---

## Universal Input Contract (`AgentInput`)

Every agent invocation strictly receives the following schema:

| Field | Type | Description |
|---|---|---|
| `role` | `string` | The formal title and persona of the agent (e.g., `CTO`, `Developer`). |
| `objective` | `string` | High-level goal the agent is intended to achieve within the broader workflow. |
| `task` | `string` | Specific, bounded assignment to execute in the current step. |
| `required_context` | `dict` | Relevant upstream artifacts, memory snippets, project metadata, and file paths. |
| `constraints` | `list[string]` | Operational limitations, style rules, forbidden operations, and boundaries. |
| `available_tools` | `list[string]` | Whitelist of executable tool identifiers accessible during this step. |
| `expected_output` | `string` | Definition and structure of the artifact or answer expected upon return. |
| `acceptance_criteria` | `list[string]` | Specific conditions required for the step to be considered successful. |
| `authority_level` | `string` | Permission tier governing decisions (`advisory`, `planning`, `implementation`, `governance`). |
| `token_budget` | `int` | Maximum allowable prompt and completion token budget for this invocation. |
| `model_policy` | `string` | Policy key mapped via router (`reasoning/high`, `coding/low`, etc.). |

---

## Universal Output Contract (`AgentOutput`)

Every agent invocation strictly returns the following schema:

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Execution outcome status: `ok`, `retry`, `blocked`, or `escalate`. |
| `summary` | `string` | Concise synopsis (1–3 sentences) summarizing what was accomplished. |
| `actions_taken` | `list[string]` | Chronological record of steps and operations performed during execution. |
| `artifacts_created` | `dict` | Key-value pairs containing produced specifications, code diffs, or structured plans. |
| `questions` | `list[string]` | Unresolved ambiguities requiring clarification from upstream agents or human. |
| `risks` | `list[string]` | Technical, security, or architectural risks identified during execution. |
| `blockers` | `list[string]` | Impassable obstacles preventing full task completion without intervention. |
| `recommendations` | `list[string]` | Suggestions for downstream agents or future iterations. |
| `validation_result` | `dict` | Results of syntax checks, rule audits, or verification criteria checks. |
| `next_action` | `string` | Recommended next step or designated downstream agent in the graph. |

---

## Agent-Specific Specifications

### 1. Chief Technology Officer (CTO)
- **Role Identity**: System architect, security overseer, and technical governance authority.
- **Responsibility**: Reviews user requirements for technical feasibility, defines system boundaries, enforces architectural standards, selects paradigms, and resolves escalations.
- **Authority Level**: `governance`
- **Default Model Policy**: `reasoning/high` (`gemini/gemini-1.5-pro`)

### 2. Project Manager (PM)
- **Role Identity**: Requirements planner, backlog manager, and sprint organizer.
- **Responsibility**: Decomposes high-level architecture into granular implementation tickets, sequences milestones, defines strict acceptance criteria, and manages human review gates.
- **Authority Level**: `planning`
- **Default Model Policy**: `reasoning/high` (`gemini/gemini-1.5-pro`)

### 3. Team Lead
- **Role Identity**: Technical design coordinator and task distributor.
- **Responsibility**: Translates PM tickets into detailed component contracts, coordinates data structures between frontend and backend, verifies dependencies, and allocates work to developers and designers.
- **Authority Level**: `planning`
- **Default Model Policy**: `reasoning/high` (`gemini/gemini-1.5-pro`)

### 4. UI/UX Designer
- **Role Identity**: Interface architect and user experience specialist.
- **Responsibility**: Defines user flows, component hierarchies, design tokens, color schemes, wireframe structures, and accessibility requirements using Tailwind and shadcn/ui conventions.
- **Authority Level**: `advisory`
- **Default Model Policy**: `doc/any` (`gemini/gemini-1.5-flash`)

### 5. Developer
- **Role Identity**: Full-stack software implementation engineer.
- **Responsibility**: Implements source code across backend (FastAPI, LangGraph, LiteLLM) and frontend (Next.js 14, React Flow) adhering to contracts, style guidelines, and strict file isolation.
- **Authority Level**: `implementation`
- **Default Model Policy**: `coding/low` (`gemini/gemini-2.0-flash`) for standard components; `coding/high` (`gemini/gemini-1.5-pro`) for complex algorithms.

### 6. QA/QC Engineer
- **Role Identity**: Quality assurance auditor and verification engineer.
- **Responsibility**: Generates unit and integration test suites in `backend/tests/`, verifies linting and static typing, validates that outputs meet PM acceptance criteria, and triggers retries on failure.
- **Authority Level**: `implementation`
- **Default Model Policy**: `coding/low` (`gemini/gemini-2.0-flash`) for test execution/generation; `reasoning/low` (`gemini/gemini-1.5-flash`) for audit reviews.

### 7. AI Engineer
- **Role Identity**: Model routing evaluator and context optimization specialist.
- **Responsibility**: Evaluates context window consumption, monitors token budgets, tunes system prompts, evaluates embedding retrieval quality in ChromaDB/JSONL, and refines agent graph performance.
- **Authority Level**: `advisory`
- **Default Model Policy**: `reasoning/high` (`gemini/gemini-1.5-pro`)
