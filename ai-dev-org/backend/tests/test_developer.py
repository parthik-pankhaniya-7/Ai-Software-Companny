"""Tests for backend/app/agents/developer.py."""

import json
from unittest.mock import patch
import pytest

pydantic = pytest.importorskip("pydantic")

from app.agents.developer import run_developer
from app.models.agent import AgentInput


def test_run_developer_with_mocked_llm() -> None:
    sample_dev_payload = {
        "code_blocks": [
            {
                "path": "backend/app/api/events.py",
                "language": "python",
                "code": "import asyncio\n\nqueue: asyncio.Queue = asyncio.Queue()\n\nasync def publish(event: dict) -> None:\n    await queue.put(event)\n",
            },
            {
                "path": "frontend/lib/ws.ts",
                "language": "typescript",
                "code": "export function connectWebSocket(url: string, onMessage: (data: any) => void) {\n  const ws = new WebSocket(url);\n  ws.onmessage = (e) => onMessage(JSON.parse(e.data));\n  return ws;\n}\n",
            },
        ],
        "tests": [
            {
                "path": "backend/tests/test_events.py",
                "language": "python",
                "code": "import pytest\nfrom app.api.events import publish, queue\n\n@pytest.mark.asyncio\nasync def test_publish():\n    await publish({'type': 'ping'})\n    assert queue.qsize() == 1\n",
            }
        ],
        "notes": "Implemented in-process async queue and frontend WS wrapper without external dependencies.",
        "assumptions": [
            "FastAPI runs in a single process",
            "WebSocket clients handle reconnection on disconnect",
        ],
    }

    mock_llm_result = {
        "text": json.dumps(sample_dev_payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 180,
        "tokens_out": 220,
        "latency": 1.15,
        "cost": 0.0,
    }

    inp = AgentInput(
        role="Developer",
        objective="Implement event queue and frontend client",
        task="Implement in-process events and frontend websocket connection",
        context={"task_id": "TASK-EVENTS-01"},
        constraints=["No Redis", "Single process only", "PEP8"],
        tools=[],
        expected_output="JSON code blocks and tests",
    )

    with patch("app.agents.developer.call_llm", return_value=mock_llm_result) as mock_call:
        output = run_developer(inp)

        mock_call.assert_called_once()
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["task_type"] == "coding"
        assert call_kwargs["complexity"] == "high"
        assert call_kwargs["json_mode"] is True
        assert "You are the Senior Software Developer" in call_kwargs["system"]

        assert output.status == "ok"
        assert len(output.artifacts["code_blocks"]) == 2
        assert output.artifacts["code_blocks"][0]["path"] == "backend/app/api/events.py"
        assert output.artifacts["code_blocks"][0]["language"] == "python"
        assert output.artifacts["code_blocks"][1]["path"] == "frontend/lib/ws.ts"
        assert output.artifacts["code_blocks"][1]["language"] == "typescript"
        assert len(output.artifacts["tests"]) == 1
        assert output.artifacts["notes"] == sample_dev_payload["notes"]
        assert output.next_action == "qa"
        assert output.meta == mock_llm_result
