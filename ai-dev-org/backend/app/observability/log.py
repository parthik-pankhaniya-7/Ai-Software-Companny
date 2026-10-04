"""Observability trace logging for LLM calls and agent activity.

Maintains append-only JSONL logs under LOG_DIR/langfuse.jsonl with automatic
log rotation when file size exceeds 50MB, without external SaaS dependencies.
"""

from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Any

from app.config import LOG_DIR

logger = logging.getLogger(__name__)

MAX_LOG_BYTES = 50 * 1024 * 1024  # 50 MB


def _resolve_paths() -> tuple[Path, Path]:
    """Resolve active log directory and log file based on app.config LOG_DIR."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return LOG_DIR, LOG_DIR / "langfuse.jsonl"


LOG_DIR, LOG_FILE = _resolve_paths()


def _rotate_if_needed(path: Path) -> None:
    """Rotate log file if size exceeds 50MB."""
    try:
        if path.exists() and path.stat().st_size >= MAX_LOG_BYTES:
            ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            rotated = path.with_name(f"langfuse_{ts}.jsonl")
            os.replace(path, rotated)
    except OSError as exc:
        logger.warning("Log rotation error: %s", exc)


def log_llm_call(
    project_id: str = "default",
    agent: str = "unknown",
    model: str = "",
    tokens_in: int = 0,
    tokens_out: int = 0,
    latency: float = 0.0,
    **extra: Any,
) -> None:
    """Append one JSON line record for an LLM call to langfuse.jsonl."""
    _, log_file = _resolve_paths()
    _rotate_if_needed(log_file)

    record: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "agent": agent,
        "model": model,
        "tokens_in": int(tokens_in),
        "tokens_out": int(tokens_out),
        "latency": float(latency),
    }

    # Scrub secrets and include safe extra metadata if provided
    for k, v in extra.items():
        k_lower = k.lower()
        if "key" not in k_lower and "secret" not in k_lower and "token" not in k_lower:
            record[k] = v

    line = json.dumps(record, ensure_ascii=False)
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError as exc:
        logger.warning("Failed to write observability log to %s: %s", log_file, exc)


def read_recent(limit: int = 500) -> list[dict]:
    """Read the most recent LLM call logs up to the specified limit."""
    _, log_file = _resolve_paths()
    if not log_file.exists():
        return []

    lines: list[str] = []
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped:
                    lines.append(stripped)
    except OSError as exc:
        logger.warning("Failed to read log file %s: %s", log_file, exc)
        return []

    recent_lines = lines[-limit:] if limit > 0 else []
    records: list[dict] = []
    for line_str in recent_lines:
        try:
            item = json.loads(line_str)
            if isinstance(item, dict):
                records.append(item)
        except json.JSONDecodeError as exc:
            logger.warning("Malformed log record in %s: %s", log_file, exc)
    return records
