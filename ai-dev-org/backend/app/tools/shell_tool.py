"""Safe shell command execution tool for ai-dev-org.

Restricts execution to an explicit allowlist of development and inspection utilities
(pytest, ruff, mypy, ls, cat, echo) with enforced timeouts.
"""

import os
from pathlib import Path
import subprocess
from typing import Any

ALLOWLIST: set[str] = {"pytest", "ruff", "mypy", "ls", "cat", "echo"}


def run(cmd: list[str], timeout: int = 30, cwd: str | Path | None = None) -> dict[str, Any]:
    """Execute an allowlisted shell command.

    Args:
        cmd: List of command arguments (e.g., ['pytest', '-q']).
        timeout: Execution timeout in seconds (default 30).
        cwd: Optional working directory for execution.

    Returns:
        dict: {"ok": bool, "stdout": str, "stderr": str, "exit_code": int}
    """
    if not cmd or not isinstance(cmd, list):
        return {
            "ok": False,
            "stdout": "",
            "stderr": "Command must be a non-empty list of strings.",
            "exit_code": 1,
        }

    binary = Path(str(cmd[0])).name.lower()
    clean_binary = binary.removesuffix(".exe")

    if clean_binary not in ALLOWLIST:
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"Command '{cmd[0]}' is rejected. Allowlist: {', '.join(sorted(ALLOWLIST))}",
            "exit_code": 1,
        }

    work_dir = str(Path(cwd).resolve()) if cwd else None
    use_shell = os.name == "nt" and clean_binary in ("echo", "dir")

    try:
        proc = subprocess.run(
            cmd,
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=use_shell,
            check=False,
        )
        return {
            "ok": proc.returncode == 0,
            "stdout": proc.stdout.strip(),
            "stderr": proc.stderr.strip(),
            "exit_code": proc.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"Command '{cmd[0]}' timed out after {timeout} seconds.",
            "exit_code": 124,
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"Executable '{cmd[0]}' not found on system PATH.",
            "exit_code": 127,
        }
    except Exception as exc:
        return {
            "ok": False,
            "stdout": "",
            "stderr": str(exc),
            "exit_code": 1,
        }
