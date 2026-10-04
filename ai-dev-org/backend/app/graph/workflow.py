"""LangGraph workflow definition for ai-dev-org.

Orchestrates sequential and conditional execution of specialized agents
(CTO, PM, Team Lead, UI/UX, Developer, QA, AI Engineer) using MemorySaver checkpointer.
"""

import logging
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

from app.api import events
from app.agents.ai_engineer import run_ai_engineer
from app.agents.cto import run_cto
from app.agents.developer import run_developer
from app.agents.pm import run_pm
from app.agents.qa import run_qa
from app.agents.team_lead import run_team_lead
from app.agents.uiux import run_uiux
from app.config import LOG_DIR
from app.graph.state import ProjectState
from app.memory import store
from app.memory.store import save_lg_state
from app.models.agent import AgentInput

logger = logging.getLogger("app.graph.workflow")


async def _publish(project_id: str, event_type: str, **kwargs: Any) -> None:
    """Publish event payload to project event subscriber queue."""
    await events.publish(project_id, {"type": event_type, **kwargs})


async def cto_node(state: ProjectState) -> dict[str, Any]:
    """Execute CTO architectural analysis."""
    pid = state.get("project_id", "")
    logger.info("NODE_START cto project=%s", pid)
    await _publish(pid, "agent_started", agent="cto")
    try:
        inp = AgentInput(
            project_id=pid,
            role="CTO",
            objective="System Architecture and Requirements Analysis",
            task=state.get("requirement", ""),
            context={"project_id": pid},
        )
        result = run_cto(inp)
        await _publish(
            pid, "agent_completed", agent="cto",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END cto project=%s", pid)
        brd = result.artifacts.get("brd", "")
        frd = result.artifacts.get("frd", "")
        history_entry = {"agent": "cto", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {"brd": brd, "frd": frd, "history": updated_history}
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL cto project=%s", pid)
        await _publish(pid, "agent_failed", agent="cto", error=str(e))
        raise


async def pm_node(state: ProjectState) -> dict[str, Any]:
    """Execute PM task and epic planning."""
    pid = state.get("project_id", "")
    logger.info("NODE_START pm project=%s", pid)
    await _publish(pid, "agent_started", agent="pm")
    try:
        inp = AgentInput(
            project_id=pid,
            role="PM",
            objective="Sprint and Task Breakdown",
            task=state.get("requirement", ""),
            context={
                "project_id": pid,
                "brd": state.get("brd"),
                "frd": state.get("frd"),
            },
        )
        result = run_pm(inp)
        tasks = result.artifacts.get("tasks", [])
        await _publish(
            pid, "agent_completed", agent="pm",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END pm project=%s", pid)
        history_entry = {"agent": "pm", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {"tasks": tasks, "history": updated_history}
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL pm project=%s", pid)
        await _publish(pid, "agent_failed", agent="pm", error=str(e))
        raise


async def team_lead_node(state: ProjectState) -> dict[str, Any]:
    """Execute Team Lead technical planning and UI requirement detection."""
    pid = state.get("project_id", "")
    logger.info("NODE_START team_lead project=%s", pid)
    await _publish(pid, "agent_started", agent="team_lead")
    try:
        inp = AgentInput(
            project_id=pid,
            role="Team Lead",
            objective="Technical Implementation Planning",
            task=state.get("requirement", ""),
            context={"tasks": state.get("tasks", [])},
        )
        result = run_team_lead(inp)
        technical_plan = result.artifacts.get("technical_plan", [])
        ui_needed = any(item.get("ui_needed", False) for item in technical_plan)
        await _publish(
            pid, "agent_completed", agent="team_lead",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END team_lead project=%s", pid)
        history_entry = {"agent": "team_lead", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {"ui_needed": ui_needed, "history": updated_history}
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL team_lead project=%s", pid)
        await _publish(pid, "agent_failed", agent="team_lead", error=str(e))
        raise


def route_team_lead(state: ProjectState) -> str:
    """Conditional edge from team_lead to uiux or developer."""
    return "uiux" if state.get("ui_needed", False) else "developer"


async def uiux_node(state: ProjectState) -> dict[str, Any]:
    """Execute UI/UX design specifications."""
    pid = state.get("project_id", "")
    logger.info("NODE_START uiux project=%s", pid)
    await _publish(pid, "agent_started", agent="uiux")
    try:
        inp = AgentInput(
            project_id=pid,
            role="UI/UX",
            objective="Interface Architecture and Design Tokens",
            task=state.get("requirement", ""),
            context={"tasks": state.get("tasks", [])},
        )
        result = run_uiux(inp)
        await _publish(
            pid, "agent_completed", agent="uiux",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END uiux project=%s", pid)
        history_entry = {"agent": "uiux", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {"history": updated_history}
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL uiux project=%s", pid)
        await _publish(pid, "agent_failed", agent="uiux", error=str(e))
        raise


async def developer_node(state: ProjectState) -> dict[str, Any]:
    """Execute Developer code and test implementation."""
    pid = state.get("project_id", "")
    logger.info("NODE_START developer project=%s", pid)
    await _publish(pid, "agent_started", agent="developer")
    try:
        inp = AgentInput(
            project_id=pid,
            role="Developer",
            objective="Source Code and Test Implementation",
            task=state.get("requirement", ""),
            context={
                "tasks": state.get("tasks", []),
                "retries": state.get("retries", 0),
                "feedback": state.get("feedback"),
            },
        )
        result = run_developer(inp)
        await _publish(
            pid, "agent_completed", agent="developer",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END developer project=%s", pid)
        history_entry = {"agent": "developer", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {"history": updated_history}
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL developer project=%s", pid)
        await _publish(pid, "agent_failed", agent="developer", error=str(e))
        raise


async def qa_node(state: ProjectState) -> dict[str, Any]:
    """Execute QA/QC verification and audit."""
    pid = state.get("project_id", "")
    logger.info("NODE_START qa project=%s", pid)
    await _publish(pid, "agent_started", agent="qa")
    try:
        inp = AgentInput(
            project_id=pid,
            role="QA",
            objective="Code Quality and Acceptance Verification",
            task=state.get("requirement", ""),
            context={"history": state.get("history", [])},
        )
        result = run_qa(inp)
        qa_status = result.artifacts.get("status", "pass")
        current_retries = state.get("retries", 0)
        new_retries = current_retries + 1 if qa_status == "fail" else current_retries
        new_feedback = result.summary if qa_status == "fail" else None
        await _publish(
            pid, "agent_completed", agent="qa",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END qa project=%s", pid)
        history_entry = {"agent": "qa", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {
            "status": qa_status,
            "retries": new_retries,
            "feedback": new_feedback,
            "history": updated_history,
        }
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL qa project=%s", pid)
        await _publish(pid, "agent_failed", agent="qa", error=str(e))
        raise


def route_qa(state: ProjectState) -> str:
    """Conditional edge from QA: retry to developer if failed and retries < 3, else ai_engineer."""
    if state.get("status") == "fail" and state.get("retries", 0) < 3:
        return "developer"
    return "ai_engineer"


async def ai_engineer_node(state: ProjectState) -> dict[str, Any]:
    """Execute AI Engineer optimization and final sign-off."""
    pid = state.get("project_id", "")
    logger.info("NODE_START ai_engineer project=%s", pid)
    await _publish(pid, "agent_started", agent="ai_engineer")
    try:
        inp = AgentInput(
            project_id=pid,
            role="AI Engineer",
            objective="Model Routing and Execution Evaluation",
            task=state.get("requirement", ""),
            context={"history": state.get("history", [])},
        )
        result = run_ai_engineer(inp)
        await _publish(
            pid, "agent_completed", agent="ai_engineer",
            model=result.meta.get("model"),
            tokens_in=result.meta.get("tokens_in", 0),
            tokens_out=result.meta.get("tokens_out", 0),
            status=result.status,
        )
        logger.info("NODE_END ai_engineer project=%s", pid)
        history_entry = {"agent": "ai_engineer", "output": result.model_dump()}
        updated_history = [*state.get("history", []), history_entry]
        delta = {"status": "completed", "history": updated_history}
        merged_state = {**state, **delta}
        save_lg_state(pid or "default", merged_state)
        return delta
    except Exception as e:
        logger.exception("NODE_FAIL ai_engineer project=%s", pid)
        await _publish(pid, "agent_failed", agent="ai_engineer", error=str(e))
        raise


def create_workflow() -> Any:
    """Build and compile the LangGraph StateGraph with MemorySaver checkpointer."""
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

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# Export compiled graph instance
app = create_workflow()


async def run_workflow(project_id: str, requirement: str) -> None:
    """Execute the multi-agent graph end-to-end for a project and persist artifacts."""
    logger.info("WORKFLOW_START project=%s", project_id)
    await events.publish(project_id, {"type": "workflow_started", "requirement": requirement})
    try:
        initial: ProjectState = {
            "project_id": project_id,
            "requirement": requirement,
            "brd": "",
            "frd": "",
            "tasks": [],
            "status": "in_progress",
            "retries": 0,
            "history": [],
            "ui_needed": False,
        }
        config = {"configurable": {"thread_id": project_id}}
        if app is not None:
            final = await app.ainvoke(initial, config=config)
        else:
            final = initial
            cto_delta = await cto_node(final)
            final = {**final, **cto_delta}
            pm_delta = await pm_node(final)
            final = {**final, **pm_delta}
            tl_delta = await team_lead_node(final)
            final = {**final, **tl_delta}
            if route_team_lead(final) == "uiux":
                ui_delta = await uiux_node(final)
                final = {**final, **ui_delta}
            dev_delta = await developer_node(final)
            final = {**final, **dev_delta}
            qa_delta = await qa_node(final)
            final = {**final, **qa_delta}
            ai_delta = await ai_engineer_node(final)
            final = {**final, **ai_delta}

        project = store.load_project(project_id) or {"id": project_id}
        project["status"] = "completed"
        project["phase"] = "completed"
        project.pop("error", None)
        project["tasks"] = final.get("tasks", [])
        project["artifacts"] = {
            "brd": final.get("brd", ""),
            "frd": final.get("frd", ""),
        }
        store.save_project(project)
        await events.publish(project_id, {"type": "workflow_completed", "status": "completed"})
        logger.info("WORKFLOW_END project=%s", project_id)
    except Exception as e:
        logger.exception("WORKFLOW_FAIL project=%s", project_id)
        project = store.load_project(project_id) or {"id": project_id}
        project["status"] = "failed"
        project["phase"] = "error"
        project["error"] = str(e)
        store.save_project(project)
        await events.publish(project_id, {"type": "workflow_failed", "error": str(e)})
