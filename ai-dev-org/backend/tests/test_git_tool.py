"""Tests for backend/app/tools/git_tool.py."""

from pathlib import Path
import shutil
import subprocess
import pytest

from app.tools import git_tool


@pytest.fixture
def git_repo(tmp_path: Path) -> Path:
    """Initialize a clean local git repository for testing."""
    if not shutil.which("git"):
        pytest.skip("git executable not found on system PATH")

    # Initialize repo
    subprocess.run(["git", "init"], cwd=str(tmp_path), capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@aidev.org"], cwd=str(tmp_path), capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "AI Dev Test"], cwd=str(tmp_path), capture_output=True, check=True)

    # Create initial commit so HEAD exists
    dummy_file = tmp_path / "init.txt"
    dummy_file.write_text("initialization", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=str(tmp_path), capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=str(tmp_path), capture_output=True, check=True)

    return tmp_path


def test_git_operations(git_repo: Path) -> None:
    """Test standard branch creation, committing, diffing, and current_branch inspection."""
    # 1. Test create_branch
    branch_res = git_tool.create_branch(git_repo, "feature/workflow-engine")
    assert branch_res["ok"] is True
    assert branch_res["exit_code"] == 0

    # 2. Test current_branch
    curr_res = git_tool.current_branch(git_repo)
    assert curr_res["ok"] is True
    assert curr_res["stdout"] == "feature/workflow-engine"

    # 3. Test commit
    code_file = git_repo / "main.py"
    code_file.write_text("print('hello')", encoding="utf-8")

    commit_res = git_tool.commit(git_repo, "Add main.py entry", ["main.py"])
    assert commit_res["ok"] is True
    assert commit_res["exit_code"] == 0

    # 4. Test diff
    code_file.write_text("print('hello world')", encoding="utf-8")
    diff_res = git_tool.diff(git_repo)
    assert diff_res["ok"] is True
    assert "hello world" in diff_res["stdout"]


def test_forbidden_safety_guards(git_repo: Path) -> None:
    """Verify that dangerous git operations are strictly forbidden."""
    res_push = git_tool._run_git_cmd(git_repo, ["push", "origin", "main"])
    assert res_push["ok"] is False
    assert "Forbidden" in res_push["stderr"]

    res_force = git_tool.create_branch(git_repo, "--force")
    assert res_force["ok"] is False

    res_hard = git_tool._run_git_cmd(git_repo, ["reset", "--hard", "HEAD~1"])
    assert res_hard["ok"] is False
    assert "Forbidden" in res_hard["stderr"]
