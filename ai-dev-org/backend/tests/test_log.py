"""Tests for backend/app/observability/log.py."""

from pathlib import Path
import pytest

from app.observability import log


@pytest.fixture
def tmp_log_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect LOG_DIR to a temporary directory for isolated tests."""
    monkeypatch.setenv("LOG_DIR", str(tmp_path))
    return tmp_path


def test_log_llm_call_and_read_recent(tmp_log_dir: Path) -> None:
    """Test logging an LLM call and reading it back."""
    # Ensure initially empty
    assert log.read_recent() == []

    # Log two distinct calls
    log.log_llm_call(
        project_id="proj-alpha",
        agent="cto",
        model="gemini/gemini-1.5-pro",
        tokens_in=150,
        tokens_out=80,
        latency=1.23,
    )

    log.log_llm_call(
        project_id="proj-alpha",
        agent="developer",
        model="gemini/gemini-2.0-flash",
        tokens_in=200,
        tokens_out=120,
        latency=0.65,
    )

    recent = log.read_recent()
    assert len(recent) == 2

    first = recent[0]
    assert first["project_id"] == "proj-alpha"
    assert first["agent"] == "cto"
    assert first["model"] == "gemini/gemini-1.5-pro"
    assert first["tokens_in"] == 150
    assert first["tokens_out"] == 80
    assert first["latency"] == 1.23
    assert "timestamp" in first

    second = recent[1]
    assert second["agent"] == "developer"
    assert second["tokens_out"] == 120


def test_read_recent_limit(tmp_log_dir: Path) -> None:
    """Test that read_recent respects the limit parameter."""
    for i in range(10):
        log.log_llm_call(
            project_id="proj-limit",
            agent=f"agent-{i}",
            model="gemini/gemini-1.5-flash",
            tokens_in=10 + i,
            tokens_out=5 + i,
            latency=0.1,
        )

    all_logs = log.read_recent(limit=10)
    assert len(all_logs) == 10

    limit_3 = log.read_recent(limit=3)
    assert len(limit_3) == 3
    # Check that it returns the most recent entries
    assert limit_3[0]["agent"] == "agent-7"
    assert limit_3[1]["agent"] == "agent-8"
    assert limit_3[2]["agent"] == "agent-9"


def test_secrets_scrubbed(tmp_log_dir: Path) -> None:
    """Test that API keys and secret parameters are never logged."""
    log.log_llm_call(
        project_id="proj-secure",
        agent="router",
        model="gemini/gemini-1.5-pro",
        tokens_in=50,
        tokens_out=25,
        latency=0.4,
        api_key="AIzaSySecretKey",
        secret_token="tok_12345",
        allowed_meta="safe_value",
    )

    records = log.read_recent()
    assert len(records) == 1
    rec = records[0]
    assert "api_key" not in rec
    assert "secret_token" not in rec
    assert rec.get("allowed_meta") == "safe_value"


def test_log_rotation_on_size_exceeded(tmp_log_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that log file rotates when size exceeds threshold."""
    # Temporarily set max bytes to a tiny value for test
    monkeypatch.setattr(log, "MAX_LOG_BYTES", 100)

    log.log_llm_call(
        project_id="p1",
        agent="a1",
        model="m1",
        tokens_in=10,
        tokens_out=10,
        latency=0.1,
    )

    # Next call should trigger rotation because log size > 100 bytes
    log.log_llm_call(
        project_id="p2",
        agent="a2",
        model="m2",
        tokens_in=20,
        tokens_out=20,
        latency=0.2,
    )

    # Check that a rotated file was created in tmp_log_dir
    rotated_files = list(tmp_log_dir.glob("langfuse_*.jsonl"))
    assert len(rotated_files) >= 1
