"""Tests for backend/app/tools/shell_tool.py."""

from unittest.mock import MagicMock, patch
import subprocess
import pytest

from app.tools import shell_tool


def test_allowlist_acceptance() -> None:
    """Test that allowlisted commands are permitted."""
    res = shell_tool.run(["echo", "hello ai-dev-org"])
    assert res["ok"] is True
    assert "hello ai-dev-org" in res["stdout"]
    assert res["exit_code"] == 0


def test_disallowed_command_rejection() -> None:
    """Test that non-allowlisted commands are strictly rejected."""
    forbidden_commands = [
        ["rm", "-rf", "/"],
        ["curl", "https://malicious.site"],
        ["wget", "http://example.com"],
        ["powershell", "-c", "whoami"],
        ["bash", "-c", "ls"],
        ["python", "script.py"],
    ]

    for cmd in forbidden_commands:
        res = shell_tool.run(cmd)
        assert res["ok"] is False
        assert "rejected" in res["stderr"].lower() or "allowlist" in res["stderr"].lower()
        assert res["exit_code"] == 1


def test_empty_command_rejection() -> None:
    """Test that empty or non-list command inputs are rejected."""
    res_empty = shell_tool.run([])
    assert res_empty["ok"] is False
    assert res_empty["exit_code"] == 1


def test_timeout_handling() -> None:
    """Test that TimeoutExpired is caught and returns standard code 124."""
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["pytest"], timeout=5)):
        res = shell_tool.run(["pytest"], timeout=5)
        assert res["ok"] is False
        assert res["exit_code"] == 124
        assert "timed out" in res["stderr"].lower()
