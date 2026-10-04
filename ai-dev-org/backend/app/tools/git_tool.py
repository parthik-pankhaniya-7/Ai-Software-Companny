"""Git integration tool for ai-dev-org.

Provides safe repository branch management, staging, committing, diff inspection,
and branch resolution. Auto-push, force options, and hard resets are strictly forbidden.
"""

from pathlib import Path
import subprocess
from typing import Any


def _run_git_cmd(repo_path: str | Path, args: list[str]) -> dict[str, Any]:
    """Execute a git command within the repo_path safely."""
    path_obj = Path(repo_path).resolve()
    if not path_obj.exists():
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"Repository directory '{path_obj}' does not exist.",
            "exit_code": 1,
        }

    # Strict safety checks
    for arg in args:
        arg_lower = arg.lower()
        if arg_lower in ("push", "--force", "-f", "--hard"):
            return {
                "ok": False,
                "stdout": "",
                "stderr": f"Forbidden git command/option: '{arg}'",
                "exit_code": 1,
            }

    cmd = ["git", *args]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(path_obj),
            capture_output=True,
            text=True,
            check=False,
        )
        return {
            "ok": proc.returncode == 0,
            "stdout": proc.stdout.strip(),
            "stderr": proc.stderr.strip(),
            "exit_code": proc.returncode,
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "stdout": "",
            "stderr": "git executable not found on system PATH.",
            "exit_code": 127,
        }
    except Exception as exc:
        return {
            "ok": False,
            "stdout": "",
            "stderr": str(exc),
            "exit_code": 1,
        }


def create_branch(repo_path: str | Path, name: str) -> dict[str, Any]:
    """Create and checkout a new local git branch."""
    if not name or name.startswith("-"):
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"Invalid branch name: '{name}'",
            "exit_code": 1,
        }
    return _run_git_cmd(repo_path, ["checkout", "-b", name])


def commit(repo_path: str | Path, message: str, files: list[str] | None = None) -> dict[str, Any]:
    """Stage specified files (or all changes) and create a commit."""
    if not message.strip():
        return {
            "ok": False,
            "stdout": "",
            "stderr": "Commit message cannot be empty.",
            "exit_code": 1,
        }

    # Stage files
    stage_args = ["add"] + (files if files else ["."])
    stage_res = _run_git_cmd(repo_path, stage_args)
    if not stage_res["ok"]:
        return stage_res

    # Commit
    return _run_git_cmd(repo_path, ["commit", "-m", message])


def diff(repo_path: str | Path) -> dict[str, Any]:
    """Retrieve working tree changes against HEAD."""
    return _run_git_cmd(repo_path, ["diff", "HEAD"])


def current_branch(repo_path: str | Path) -> dict[str, Any]:
    """Retrieve the name of the currently checked out branch."""
    res = _run_git_cmd(repo_path, ["branch", "--show-current"])
    if res["ok"] and not res["stdout"]:
        # Fallback for detached HEAD or older git versions
        res = _run_git_cmd(repo_path, ["rev-parse", "--abbrev-ref", "HEAD"])
    return res
