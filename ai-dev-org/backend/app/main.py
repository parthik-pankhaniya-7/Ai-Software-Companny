"""FastAPI backend server for ai-dev-org.

Provides REST and WebSocket endpoints for project management, agent graph execution,
task tracking, human approval governance, and observability telemetry.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import os
from typing import Any
from uuid import uuid4
import uuid

from fastapi import BackgroundTasks, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.api import events
from app.config import LOG_DIR
from app.graph.workflow import (
    run_workflow,
    cto_node,
    pm_node,
    team_lead_node,
    uiux_node,
    developer_node,
    qa_node,
    ai_engineer_node,
    route_team_lead,
    route_qa,
)
from app.graph.state import ProjectState
from app.memory import store
from app.memory.store import (
    init_db,
    list_projects,
    load_project,
    save_project,
    save_task,
    load_tasks,
    append_message,
    load_messages,
    save_lg_state,
    load_lg_state,
    load_memory,
    _get_data_dir,
)
from app.models.agent import Approval, Message, MessageType, Project, ProjectStatus, Task, TaskStatus
from app.observability.log import read_recent
from app.tools import git_tool, shell_tool

logger = logging.getLogger("app.main")



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize local JSON persistence directories on startup."""
    init_db()
    yield


app = FastAPI(
    title="ai-dev-org Backend",
    description="Local-first Multi-Agent AI Software Development Organization API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Configuration
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request & Response Schemas
class CreateProjectRequest(BaseModel):
    requirement: str


class ApproveRequest(BaseModel):
    task_id: str
    decision: str  # "approve" | "reject" | "escalate"
    reason: str = ""
    approver: str = "Human Operator"


async def run_project_workflow_bg(project_id: str, requirement: str) -> None:
    """Execute the multi-agent graph in background and publish lifecycle updates."""
    state: ProjectState = {
        "project_id": project_id,
        "requirement": requirement,
        "status": "in_progress",
        "retries": 0,
        "history": [],
    }

    try:
        # 1. CTO Step
        await events.publish(project_id, {
            "type": "agent_start",
            "agent": "cto",
            "role": "CTO",
            "task": "Architectural feasibility & BRD/FRD synthesis",
            "status": "running",
            "model": "gemini/gemini-1.5-pro",
        })
        cto_delta = cto_node(state)
        state = {**state, **cto_delta}
        await events.publish(project_id, {
            "type": "agent_finish",
            "agent": "cto",
            "role": "CTO",
            "status": "completed",
            "summary": "CTO architectural analysis delivered BRD & FRD.",
            "artifacts": {"brd": state.get("brd"), "frd": state.get("frd")},
        })

        # 2. PM Step
        await events.publish(project_id, {
            "type": "agent_start",
            "agent": "pm",
            "role": "PM",
            "task": "Decomposing epics, features, and engineering tasks",
            "status": "running",
            "model": "gemini/gemini-1.5-pro",
        })
        pm_delta = pm_node(state)
        state = {**state, **pm_delta}
        pm_tasks = state.get("tasks", [])
        for t in pm_tasks:
            save_task(project_id, t)

        await events.publish(project_id, {
            "type": "agent_finish",
            "agent": "pm",
            "role": "PM",
            "status": "completed",
            "summary": f"PM created {len(pm_tasks)} engineering backlog tickets.",
        })

        # 3. Team Lead Step
        await events.publish(project_id, {
            "type": "agent_start",
            "agent": "team_lead",
            "role": "Team Lead",
            "task": "Synthesizing technical plan and UI flag detection",
            "status": "running",
            "model": "gemini/gemini-1.5-pro",
        })
        tl_delta = team_lead_node(state)
        state = {**state, **tl_delta}
        ui_needed = state.get("ui_needed", False)

        await events.publish(project_id, {
            "type": "agent_finish",
            "agent": "team_lead",
            "role": "Team Lead",
            "status": "completed",
            "summary": f"Team Lead finalized technical plan (UI required: {ui_needed}).",
        })

        # 4. UI/UX Step (if needed)
        if route_team_lead(state) == "uiux":
            await events.publish(project_id, {
                "type": "agent_start",
                "agent": "uiux",
                "role": "UI/UX",
                "task": "Designing interface components and wireframe tokens",
                "status": "running",
                "model": "gemini/gemini-1.5-flash",
            })
            uiux_delta = uiux_node(state)
            state = {**state, **uiux_delta}
            await events.publish(project_id, {
                "type": "agent_finish",
                "agent": "uiux",
                "role": "UI/UX",
                "status": "completed",
                "summary": "UI/UX Designer produced wireframe design system.",
            })

        # 5. Developer Step
        await events.publish(project_id, {
            "type": "agent_start",
            "agent": "developer",
            "role": "Developer",
            "task": "Writing source code modules and unit test suites",
            "status": "running",
            "model": "gemini/gemini-2.0-flash",
        })
        dev_delta = developer_node(state)
        state = {**state, **dev_delta}
        await events.publish(project_id, {
            "type": "agent_finish",
            "agent": "developer",
            "role": "Developer",
            "status": "completed",
            "summary": "Developer implemented core code and test blocks.",
        })

        # 6. QA Step
        await events.publish(project_id, {
            "type": "agent_start",
            "agent": "qa",
            "role": "QA",
            "task": "Auditing implementation against acceptance criteria",
            "status": "running",
            "model": "gemini/gemini-2.0-flash",
        })
        qa_delta = qa_node(state)
        state = {**state, **qa_delta}
        await events.publish(project_id, {
            "type": "agent_finish",
            "agent": "qa",
            "role": "QA",
            "status": "completed",
            "summary": f"QA verification audit outcome: {state.get('status', 'pass')}.",
        })

        # 7. AI Engineer Step
        await events.publish(project_id, {
            "type": "agent_start",
            "agent": "ai_engineer",
            "role": "AI Engineer",
            "task": "Evaluating model routing budgets and final delivery",
            "status": "running",
            "model": "gemini/gemini-1.5-pro",
        })
        ai_delta = ai_engineer_node(state)
        state = {**state, **ai_delta}

        # Update Project in Store
        proj_data = load_project(project_id) or {}
        proj_data["status"] = "completed"
        proj_data["phase"] = "completed"
        proj_data["artifacts"] = {
            "brd": state.get("brd"),
            "frd": state.get("frd"),
            "architecture": "FastAPI + LangGraph + Next.js 14 local-first stack",
        }
        proj_data["tasks"] = load_tasks(project_id)
        save_project(proj_data)

        await events.publish(project_id, {
            "type": "agent_finish",
            "agent": "ai_engineer",
            "role": "AI Engineer",
            "status": "completed",
            "summary": "AI Engineer completed final token optimization and delivery.",
        })
    except Exception as exc:
        logger.exception("Error during background workflow for %s: %s", project_id, exc)
        await events.publish(project_id, {
            "type": "error",
            "status": "failed",
            "message": str(exc),
        })


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "app": "ai-dev-org"}


@app.get("/projects")
async def get_projects() -> list[dict[str, Any]]:
    """List all projects."""
    return list_projects()


@app.post("/projects")
async def create_project(req: CreateProjectRequest) -> dict[str, Any]:
    """Create a new project and trigger background multi-agent graph execution."""
    project_id = f"proj-{uuid4().hex[:8]}"
    now_str = datetime.now(timezone.utc).isoformat()
    project = {
        "id": project_id,
        "requirement": req.requirement,
        "status": "in_progress",
        "phase": "initiation",
        "tasks": [],
        "artifacts": {},
        "created_at": now_str,
        "updated_at": now_str,
    }
    store.save_project(project)
    asyncio.create_task(run_workflow(project["id"], project["requirement"]))
    logger.info("PROJECT_CREATED id=%s", project["id"])

    append_message(project_id, {
        "sender": "System",
        "receiver": "All",
        "type": "system",
        "text": f"Project {project_id} initialized with requirement: {req.requirement}",
    })

    return {"project_id": project["id"], "project": project}


@app.get("/projects/{project_id}")
async def get_project(project_id: str) -> dict[str, Any]:
    """Get project details, tasks, and artifacts."""
    project = load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project["tasks"] = load_tasks(project_id)
    return project


@app.post("/projects/{project_id}/approve")
async def approve_project_step(project_id: str, req: ApproveRequest) -> dict[str, Any]:
    """Process a human governance decision (Approve/Reject/Escalate)."""
    project = load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    approval = Approval(
        task_id=req.task_id,
        approver=req.approver,
        decision=req.decision,
        reason=req.reason,
    )

    msg_payload = {
        "sender": req.approver,
        "receiver": "All",
        "type": "approval",
        "text": f"Human Decision: {req.decision.upper()} for Task {req.task_id}. Note: {req.reason or 'None'}",
        "payload": approval.model_dump(),
    }
    append_message(project_id, msg_payload)
    await events.publish(project_id, msg_payload)

    return {"status": "ok", "approval": approval.model_dump()}


@app.get("/tasks")
async def get_tasks(project_id: str = "") -> list[dict[str, Any]]:
    """Get tasks for a project."""
    if not project_id:
        return []
    return load_tasks(project_id)


@app.get("/messages")
async def get_messages(project_id: str = "") -> list[dict[str, Any]]:
    """Get message history for a project."""
    if not project_id:
        return []
    return load_messages(project_id)


@app.get("/logs")
async def get_logs(limit: int = 200) -> list[dict[str, Any]]:
    """Get observability LLM call traces."""
    return read_recent(limit=limit)


@app.get("/memory")
async def get_memory(project_id: str = "") -> list[dict[str, Any]]:
    """Retrieve memory entries from data/memory/*.jsonl."""
    if project_id:
        return load_memory(project_id)

    mem_dir = _get_data_dir() / "memory"
    if not mem_dir.exists():
        return []

    all_memories: list[dict[str, Any]] = []
    for f in mem_dir.glob("*.jsonl"):
        all_memories.extend(load_memory(f.stem))
    return all_memories


@app.get("/tools")
async def get_tools_status() -> dict[str, Any]:
    """Retrieve git branch status and allowlisted shell tools."""
    git_info = git_tool.current_branch(".")
    return {
        "git": {
            "branch": git_info.get("stdout", "main") or "main",
            "status": "active" if git_info.get("ok") else "clean",
            "safe_mode": True,
            "forbidden_commands": ["push", "--force", "-f", "--hard"],
        },
        "shell": {
            "allowlist": sorted(list(shell_tool.ALLOWLIST)),
            "timeout_seconds": 30,
            "status": "active",
        },
    }


@app.websocket("/ws/{project_id}")
@app.websocket("/ws/projects/{project_id}")
async def ws_project(websocket: WebSocket, project_id: str):
    await websocket.accept()
    q = events.subscribe(project_id)
    try:
        while True:
            event = await q.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        events.unsubscribe(project_id, q)
