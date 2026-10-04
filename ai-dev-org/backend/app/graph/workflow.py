"""LangGraph workflow definition for ai-dev-org.

Orchestrates sequential and conditional execution of specialized agents
(CTO, PM, Team Lead, UI/UX, Developer, QA, AI Engineer) using MemorySaver checkpointer.
"""

from typing import Any

try:
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.graph import END, START, StateGraph
    HAS_LANGGRAPH = True
except ImportError:
    MemorySaver = None  # type: ignore
    StateGraph = None  # type: ignore
    START = "__start__"  # type: ignore
    END = "__end__"  # type: ignore
    HAS_LANGGRAPH = False

from app.agents.ai_engineer import run_ai_engineer
from app.agents.cto import run_cto
from app.agents.developer import run_developer
from app.agents.pm import run_pm
from app.agents.qa import run_qa
from app.agents.team_lead import run_team_lead
from app.agents.uiux import run_uiux
from app.graph.state import ProjectState
from app.memory.store import save_lg_state
from app.models.agent import AgentInput


def cto_node(state: ProjectState) -> dict[str, Any]:
    """Execute CTO architectural analysis."""
    inp = AgentInput(
        role="CTO",
        objective="System Architecture and Requirements Analysis",
        task=state.get("requirement", ""),
        context={"project_id": state.get("project_id", "")},
    )
    out = run_cto(inp)
    brd = out.artifacts.get("brd")
    frd = out.artifacts.get("frd")
    history_entry = {"agent": "cto", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {"brd": brd, "frd": frd, "history": updated_history}
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def pm_node(state: ProjectState) -> dict[str, Any]:
    """Execute PM task and epic planning."""
    inp = AgentInput(
        role="PM",
        objective="Sprint and Task Breakdown",
        task=state.get("requirement", ""),
        context={
            "project_id": state.get("project_id", ""),
            "brd": state.get("brd"),
            "frd": state.get("frd"),
        },
    )
    out = run_pm(inp)
    tasks = out.artifacts.get("tasks", [])
    history_entry = {"agent": "pm", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {"tasks": tasks, "history": updated_history}
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def team_lead_node(state: ProjectState) -> dict[str, Any]:
    """Execute Team Lead technical planning and UI requirement detection."""
    inp = AgentInput(
        role="Team Lead",
        objective="Technical Implementation Planning",
        task=state.get("requirement", ""),
        context={"tasks": state.get("tasks", [])},
    )
    out = run_team_lead(inp)
    technical_plan = out.artifacts.get("technical_plan", [])
    ui_needed = any(item.get("ui_needed", False) for item in technical_plan)
    history_entry = {"agent": "team_lead", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {"ui_needed": ui_needed, "history": updated_history}
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def route_team_lead(state: ProjectState) -> str:
    """Conditional edge from team_lead to uiux or developer."""
    return "uiux" if state.get("ui_needed", False) else "developer"


def uiux_node(state: ProjectState) -> dict[str, Any]:
    """Execute UI/UX design specifications."""
    inp = AgentInput(
        role="UI/UX",
        objective="Interface Architecture and Design Tokens",
        task=state.get("requirement", ""),
        context={"tasks": state.get("tasks", [])},
    )
    out = run_uiux(inp)
    history_entry = {"agent": "uiux", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {"history": updated_history}
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def developer_node(state: ProjectState) -> dict[str, Any]:
    """Execute Developer code and test implementation."""
    inp = AgentInput(
        role="Developer",
        objective="Source Code and Test Implementation",
        task=state.get("requirement", ""),
        context={
            "tasks": state.get("tasks", []),
            "retries": state.get("retries", 0),
            "feedback": state.get("feedback"),
        },
    )
    out = run_developer(inp)
    history_entry = {"agent": "developer", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {"history": updated_history}
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def qa_node(state: ProjectState) -> dict[str, Any]:
    """Execute QA/QC verification and audit."""
    inp = AgentInput(
        role="QA",
        objective="Code Quality and Acceptance Verification",
        task=state.get("requirement", ""),
        context={"history": state.get("history", [])},
    )
    out = run_qa(inp)
    qa_status = out.artifacts.get("status", "pass")
    current_retries = state.get("retries", 0)
    new_retries = current_retries + 1 if qa_status == "fail" else current_retries
    new_feedback = out.summary if qa_status == "fail" else None
    history_entry = {"agent": "qa", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {
        "status": qa_status,
        "retries": new_retries,
        "feedback": new_feedback,
        "history": updated_history,
    }
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def route_qa(state: ProjectState) -> str:
    """Conditional edge from QA: retry to developer if failed and retries < 3, else ai_engineer."""
    if state.get("status") == "fail" and state.get("retries", 0) < 3:
        return "developer"
    return "ai_engineer"


def ai_engineer_node(state: ProjectState) -> dict[str, Any]:
    """Execute AI Engineer optimization and final sign-off."""
    inp = AgentInput(
        role="AI Engineer",
        objective="Model Routing and Execution Evaluation",
        task=state.get("requirement", ""),
        context={"history": state.get("history", [])},
    )
    out = run_ai_engineer(inp)
    history_entry = {"agent": "ai_engineer", "output": out.model_dump()}

    updated_history = [*state.get("history", []), history_entry]
    delta = {"status": "completed", "history": updated_history}
    merged_state = {**state, **delta}
    save_lg_state(state.get("project_id", "default"), merged_state)
    return delta


def create_workflow() -> Any:
    """Build and compile the LangGraph StateGraph with MemorySaver."""
    if not HAS_LANGGRAPH or StateGraph is None or MemorySaver is None:
        return None

    graph = StateGraph(ProjectState)

    # Register Nodes
    graph.add_node("cto", cto_node)
    graph.add_node("pm", pm_node)
    graph.add_node("team_lead", team_lead_node)
    graph.add_node("uiux", uiux_node)
    graph.add_node("developer", developer_node)
    graph.add_node("qa", qa_node)
    graph.add_node("ai_engineer", ai_engineer_node)

    # Register Edges
    graph.add_edge(START, "cto")
    graph.add_edge("cto", "pm")
    graph.add_edge("pm", "team_lead")

    graph.add_conditional_edges(
        "team_lead",
        route_team_lead,
        {"uiux": "uiux", "developer": "developer"},
    )
    graph.add_edge("uiux", "developer")
    graph.add_edge("developer", "qa")

    graph.add_conditional_edges(
        "qa",
        route_qa,
        {"developer": "developer", "ai_engineer": "ai_engineer"},
    )
    graph.add_edge("ai_engineer", END)

    return graph.compile(checkpointer=MemorySaver())


# Export compiled graph instance
app = create_workflow()
