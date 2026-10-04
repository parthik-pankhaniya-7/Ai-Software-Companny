"""Tests for backend/app/agents/qa.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.qa import run_qa
from app.models.agent import AgentInput


def test_run_qa_pass() -> None:
    sample_qa_payload = {
        "status": "pass",
        "test_cases": [
            "Verify _atomic_write writes to .tmp and calls os.replace",
            "Verify load_project returns None for non-existent ID",
            "Verify all JSON files formatted with 2-space indent",
        ],
        "defects": [],
        "evidence": "All 3 unit test assertions passed without regression.",
        "retest_required": False,
    }

    mock_llm_result = {
        "text": json.dumps(sample_qa_payload),
        "model": "gemini/gemini-1.5-flash",
        "tokens_in": 130,
        "tokens_out": 70,
        "latency": 0.45,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="QA",
        objective="Verify backend persistence store implementation",
        task="Audit store.py against atomic write criteria",
        context={"code": "def _atomic_write(path, text): ..."},
        acceptance_criteria=["Atomic write", "No SQLite"],
        expected_output="JSON QA audit report",
    )

    with patch("app.agents.qa.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_qa(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "doc"
        assert call_kwargs["complexity"] == "any"
        assert call_kwargs["json_mode"] is True

        assert output.status == "ok"
        assert output.artifacts["status"] == "pass"
        assert len(output.artifacts["test_cases"]) == 3
        assert output.artifacts["retest_required"] is False
        assert output.validation["passed"] is True
        assert output.next_action == "ai_engineer"
        assert output.meta == mock_llm_result


def test_run_qa_fail_triggers_retest() -> None:
    sample_qa_payload = {
        "status": "fail",
        "test_cases": ["Verify SQLite is forbidden"],
        "defects": [
            {
                "severity": "critical",
                "description": "Found raw sqlite3 import in memory module",
                "evidence": "import sqlite3 on line 4",
            }
        ],
        "evidence": "Forbidden dependency rule violated.",
        "retest_required": True,
    }

    mock_llm_result = {
        "text": json.dumps(sample_qa_payload),
        "model": "gemini/gemini-1.5-flash",
        "tokens_in": 90,
        "tokens_out": 50,
        "latency": 0.35,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="QA",
        objective="Verify forbidden libraries",
        task="Audit memory module for SQLite",
        context={"code": "import sqlite3"},
        acceptance_criteria=["No SQLite"],
        expected_output="JSON QA audit report",
    )

    with patch("app.agents.qa.call_llm", return_value=mock_llm_result):
        output = run_qa(inp)

        assert output.status == "retry"
        assert output.artifacts["status"] == "fail"
        assert len(output.artifacts["defects"]) == 1
        assert output.artifacts["defects"][0]["severity"] == "critical"
        assert output.artifacts["retest_required"] is True
        assert output.validation["passed"] is False
        assert output.next_action == "developer"
