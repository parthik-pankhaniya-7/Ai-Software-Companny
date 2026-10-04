"""Local JSON and JSONL persistence store for ai-dev-org.

This module provides atomic file-based persistence for projects, tasks,
messages, memory, and LangGraph states using the Python standard library only.
"""

import datetime
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def _get_data_dir() -> Path:
    """Resolve data directory path from environment variable DATA_DIR or default."""
    data_dir_env = os.environ.get("DATA_DIR", "./data")
    return Path(data_dir_env).resolve()


def _atomic_write(path: Path, text: str) -> None:
    """Atomically write text to path using a temporary file and replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def init_db() -> None:
    """Initialize required storage directories under DATA_DIR."""
    data_dir = _get_data_dir()
    for subfolder in ("projects", "memory", "langgraph"):
        (data_dir / subfolder).mkdir(parents=True, exist_ok=True)


def save_project(project: dict) -> None:
    """Save a project dict to data/projects/<id>.json."""
    project_id = project.get("id") or project.get("project_id")
    if not project_id:
        raise ValueError("Project must contain an 'id' or 'project_id' key.")
    path = _get_data_dir() / "projects" / f"{project_id}.json"
    content = json.dumps(project, indent=2, ensure_ascii=False)
    _atomic_write(path, content)


def load_project(project_id: str) -> dict | None:
    """Load a project dict from data/projects/<id>.json."""
    path = _get_data_dir() / "projects" / f"{project_id}.json"
    if not path.exists():
        return None
    try:
        content = path.read_text(encoding="utf-8")
        data = json.loads(content)
        if isinstance(data, dict):
            return data
        logger.warning("Project file %s did not contain a JSON object", path)
        return None
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load project %s: %s", project_id, exc)
        return None


def list_projects() -> list[dict]:
    """List all projects found under data/projects/."""
    projects_dir = _get_data_dir() / "projects"
    if not projects_dir.exists():
        return []

    projects: list[dict] = []
    for file_path in sorted(projects_dir.glob("*.json")):
        if file_path.name.endswith(".tasks.json") or file_path.name.endswith(".tmp"):
            continue
        project = load_project(file_path.stem)
        if project is not None:
            projects.append(project)
    return projects


def save_task(project_id: str, task: dict) -> None:
    """Save or update a task under data/projects/<id>.tasks.json."""
    tasks_path = _get_data_dir() / "projects" / f"{project_id}.tasks.json"
    tasks = load_tasks(project_id)
    task_id = task.get("id") or task.get("task_id")

    if task_id:
        updated = False
        for i, existing in enumerate(tasks):
            existing_id = existing.get("id") or existing.get("task_id")
            if existing_id == task_id:
                tasks[i] = task
                updated = True
                break
        if not updated:
            tasks.append(task)
    else:
        tasks.append(task)

    _atomic_write(tasks_path, json.dumps(tasks, indent=2, ensure_ascii=False))


def load_tasks(project_id: str) -> list[dict]:
    """Load all tasks for a project from data/projects/<id>.tasks.json."""
    tasks_path = _get_data_dir() / "projects" / f"{project_id}.tasks.json"
    if not tasks_path.exists():
        project = load_project(project_id)
        if project and isinstance(project.get("tasks"), list):
            return list(project["tasks"])
        return []

    try:
        content = tasks_path.read_text(encoding="utf-8")
        data = json.loads(content)
        if isinstance(data, list):
            return data
        logger.warning("Tasks file %s did not contain a JSON list", tasks_path)
        return []
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load tasks for project %s: %s", project_id, exc)
        return []


def append_message(project_id: str, message: dict) -> None:
    """Append a message line to data/projects/<id>.messages.jsonl."""
    path = _get_data_dir() / "projects" / f"{project_id}.messages.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    msg_copy = dict(message)
    if "timestamp" not in msg_copy:
        msg_copy["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    line = json.dumps(msg_copy, ensure_ascii=False)
    with open(path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_messages(project_id: str) -> list[dict]:
    """Load all messages from data/projects/<id>.messages.jsonl."""
    path = _get_data_dir() / "projects" / f"{project_id}.messages.jsonl"
    if not path.exists():
        return []

    messages: list[dict] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    item = json.loads(line_str)
                    if isinstance(item, dict):
                        messages.append(item)
                except json.JSONDecodeError as exc:
                    logger.warning("Skipping malformed message line in %s: %s", path, exc)
    except OSError as exc:
        logger.warning("Failed to read messages file %s: %s", path, exc)
    return messages


def add_memory(project_id: str, kind: str, ref_id: str, content: str) -> None:
    """Append a memory item to data/memory/<id>.jsonl."""
    path = _get_data_dir() / "memory" / f"{project_id}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "project_id": project_id,
        "kind": kind,
        "ref_id": ref_id,
        "content": content,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    line = json.dumps(entry, ensure_ascii=False)
    with open(path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_memory(project_id: str) -> list[dict]:
    """Load all memory entries from data/memory/<id>.jsonl."""
    path = _get_data_dir() / "memory" / f"{project_id}.jsonl"
    if not path.exists():
        return []

    memories: list[dict] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    item = json.loads(line_str)
                    if isinstance(item, dict):
                        memories.append(item)
                except json.JSONDecodeError as exc:
                    logger.warning("Skipping malformed memory line in %s: %s", path, exc)
    except OSError as exc:
        logger.warning("Failed to read memory file %s: %s", path, exc)
    return memories


def save_lg_state(project_id: str, state: dict) -> None:
    """Save LangGraph state to data/langgraph/<id>.state.json."""
    path = _get_data_dir() / "langgraph" / f"{project_id}.state.json"
    content = json.dumps(state, indent=2, ensure_ascii=False)
    _atomic_write(path, content)


def load_lg_state(project_id: str) -> dict | None:
    """Load LangGraph state from data/langgraph/<id>.state.json."""
    path = _get_data_dir() / "langgraph" / f"{project_id}.state.json"
    if not path.exists():
        return None
    try:
        content = path.read_text(encoding="utf-8")
        data = json.loads(content)
        if isinstance(data, dict):
            return data
        logger.warning("LangGraph state file %s did not contain a JSON object", path)
        return None
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load LangGraph state for %s: %s", project_id, exc)
        return None
