"""End-to-end multi-agent workflow test for ai-dev-org."""

import json
from pathlib import Path
from typing import Any
try:
    import pytest
except ImportError:
    pytest = None  # type: ignore

from app.graph import workflow
from app.graph.state import ProjectState
from app.memory.store import load_project, save_project


def _fixture(func: Any) -> Any:
    if pytest is not None and hasattr(pytest, "fixture"):
        return pytest.fixture(func)
    return func


@_fixture
def tmp_data_dir(tmp_path: Path, monkeypatch: Any) -> Path:
    """Configure DATA_DIR to a temporary directory for test isolation."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    (tmp_path / "projects").mkdir(parents=True, exist_ok=True)
    (tmp_path / "memory").mkdir(parents=True, exist_ok=True)
    (tmp_path / "langgraph").mkdir(parents=True, exist_ok=True)
    return tmp_path


def canned_call_llm(
    prompt: str = "",
    task_type: str = "reasoning",
    complexity: str = "medium",
    system: str | None = None,
    json_mode: bool = True,
    **kwargs: Any,
) -> dict[str, Any]:
    """Canned LLM mock dispatcher returning strict role-specific JSON output."""
    system_str = (system or "").lower()
    prompt_str = prompt.lower()

    if "cto" in system_str or "chief technology officer" in prompt_str:
        payload = {
            "brd": "Customer Wallet Business Requirements Document: Support user balance recharges, secure bank withdrawals, and PDF invoice generation.",
            "frd": "Customer Wallet Functional Requirements Document: Real-time balance calculations, transaction logging, responsive UI screens, and audit verification.",
            "architecture": "FastAPI + LangGraph backend, embedded ChromaDB vector memory, Next.js 14 App Router, and Tailwind CSS frontend.",
            "risks": ["Double spending during concurrent withdrawals", "Third-party payment gateway latency"],
            "nfr": ["Latency under 200ms", "Zero external database servers"],
            "acceptance_criteria": ["Wallet balance never negative", "Transaction history pagination"],
            "open_questions": [],
            "recommended_docs": ["PCI-DSS local guidelines", "FastAPI dependency injection"],
        }
    elif "project manager" in system_str or "pm" in system_str or "sprint decomposition" in prompt_str:
        payload = {
            "epics": ["Wallet Core", "Billing & Invoices", "Frontend Experience"],
            "features": ["Recharge", "Withdrawal", "Transaction History", "Invoice Export"],
            "tasks": [
                {
                    "id": "TASK-WALLET-01",
                    "title": "Implement Wallet Transaction Data Model & Endpoints",
                    "description": "Create atomic balance update logic and transaction history retrieval.",
                    "dependencies": [],
                    "priority": "high",
                    "acceptance_criteria": ["Recharge credits balance", "Withdrawal checks minimum balance"],
                    "assigned_role": "developer",
                },
                {
                    "id": "TASK-WALLET-02",
                    "title": "Build Responsive Wallet UI & Recharge Modal",
                    "description": "Design shadcn/ui components for dashboard, transaction table, and invoice downloader.",
                    "dependencies": ["TASK-WALLET-01"],
                    "priority": "high",
                    "acceptance_criteria": ["Mobile responsive layout", "Loading skeletons"],
                    "assigned_role": "uiux",
                },
            ],
            "milestones": ["M1: Backend API Complete", "M2: Responsive UI & Invoices Delivered"],
            "risks": ["Mobile viewport overflow on transaction tables"],
        }
    elif "team lead" in system_str or "technical implementation planning" in prompt_str:
        payload = {
            "technical_plan": [
                {
                    "task_id": "TASK-WALLET-01",
                    "technical_steps": ["Create wallet models", "Implement atomic debit/credit", "Add test cases"],
                    "files_to_touch": ["backend/app/models/wallet.py", "backend/app/api/wallet.py"],
                    "ui_needed": False,
                    "assigned_agent": "developer",
                },
                {
                    "task_id": "TASK-WALLET-02",
                    "technical_steps": ["Design wallet card", "Build transaction list", "Implement invoice drawer"],
                    "files_to_touch": ["frontend/app/wallet/page.tsx", "frontend/components/wallet/recharge-modal.tsx"],
                    "ui_needed": True,
                    "assigned_agent": "uiux",
                },
            ],
            "blockers": [],
            "dependencies": ["TASK-WALLET-01"],
        }
    elif "ui/ux" in system_str or "interface architecture" in prompt_str:
        payload = {
            "user_flows": ["User recharges wallet via modal", "User filters transaction history", "User downloads PDF invoice"],
            "screens": ["WalletOverviewScreen", "TransactionHistoryScreen", "InvoiceViewScreen"],
            "components": ["WalletBalanceCard", "RechargeModal", "TransactionTable", "InvoiceDownloadButton"],
            "states": {
                "loading": "Shimmer skeleton on wallet balance and recent activity list",
                "error": "Destructive banner with retry action for payment timeout",
                "empty": "Empty state illustration with 'Recharge Now' action button",
            },
            "accessibility_notes": ["WCAG AA compliance", "Aria-label on monetary inputs"],
            "responsive_notes": ["Mobile-first flexbox wrapping for action buttons", "Horizontal scroll for invoice tables"],
            "wireframe_description": "Dark glassmorphism card layout with emerald balance badge and interactive transaction drawers.",
        }
    elif "developer" in system_str or "source code" in prompt_str:
        payload = {
            "code_blocks": [
                {
                    "path": "backend/app/models/wallet.py",
                    "language": "python",
                    "code": "from pydantic import BaseModel\n\nclass Wallet(BaseModel):\n    user_id: str\n    balance: float = 0.0\n",
                },
                {
                    "path": "frontend/app/wallet/page.tsx",
                    "language": "typescript",
                    "code": "export default function WalletPage() { return <div>Wallet Dashboard</div>; }",
                },
            ],
            "tests": [
                {
                    "path": "backend/tests/test_wallet.py",
                    "language": "python",
                    "code": "def test_recharge():\n    assert True\n",
                },
            ],
            "notes": "Implemented wallet domain models, transaction routes, and frontend dashboard components.",
            "assumptions": ["Local-first persistence using ./data store."],
        }
    elif "qa" in system_str or "verification" in prompt_str:
        payload = {
            "status": "pass",
            "test_cases": [
                "test_wallet_initial_balance_zero",
                "test_recharge_successful_credit",
                "test_withdrawal_insufficient_funds_rejected",
                "test_transaction_history_ordering",
                "test_invoice_download_format",
                "test_responsive_mobile_viewport",
            ],
            "defects": [],
            "evidence": "All 6 verification test cases executed and passed with 100% assertion success.",
            "retest_required": False,
        }
    elif "ai engineer" in system_str or "model routing" in prompt_str:
        payload = {
            "decision": "proceed",
            "model": "gemini/gemini-1.5-pro",
            "token_budget": 4000,
            "parallel": False,
            "retry": False,
            "escalate": False,
            "reason": "Execution within token budget limits and all acceptance criteria verified.",
        }
    else:
        payload = {"status": "ok", "message": "Default canned output"}

    return {
        "text": json.dumps(payload),
        "model": "gemini/gemini-1.5-pro",
        "tokens_in": 120,
        "tokens_out": 240,
        "cost": 0.0,
        "latency": 0.05,
    }


def test_e2e_wallet_workflow(tmp_data_dir: Path, monkeypatch: Any) -> None:
    """Execute complete end-to-end wallet development workflow across all 7 specialized agents."""
    # Monkeypatch call_llm globally across all agent modules and router
    monkeypatch.setattr("app.router.llm.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.cto.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.pm.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.team_lead.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.uiux.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.developer.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.qa.call_llm", canned_call_llm)
    monkeypatch.setattr("app.agents.ai_engineer.call_llm", canned_call_llm)

    project_id = "proj-wallet-e2e-01"
    requirement = (
        "Build a customer wallet with recharge, withdrawal, transaction history, invoice, responsive UI"
    )

    # Initialize initial state
    state: ProjectState = {
        "project_id": project_id,
        "requirement": requirement,
        "status": "planning",
        "retries": 0,
        "history": [],
    }

    # Step 1: CTO Node execution
    cto_delta = workflow.cto_node(state)
    state = {**state, **cto_delta}
    assert state.get("brd") is not None, "CTO must create BRD"
    assert "Customer Wallet" in state["brd"]
    assert state.get("frd") is not None, "CTO must create FRD"
    assert "Real-time balance" in state["frd"]

    # Step 2: PM Node execution
    pm_delta = workflow.pm_node(state)
    state = {**state, **pm_delta}
    tasks = state.get("tasks", [])
    assert len(tasks) >= 2, "PM must create structured task breakdown"
    assert any("Wallet" in t["title"] for t in tasks)

    # Step 3: Team Lead Node execution
    tl_delta = workflow.team_lead_node(state)
    state = {**state, **tl_delta}
    assert state.get("ui_needed") is True, "Team Lead must detect UI requirement for wallet interface"
    next_node = workflow.route_team_lead(state)
    assert next_node == "uiux", "Routing after Team Lead must trigger UI/UX designer when ui_needed is True"

    # Step 4: UI/UX Node execution
    uiux_delta = workflow.uiux_node(state)
    state = {**state, **uiux_delta}
    assert len(state["history"]) == 4, "UI/UX output must be appended to execution history"

    # Step 5: Developer Node execution
    dev_delta = workflow.developer_node(state)
    state = {**state, **dev_delta}
    assert len(state["history"]) == 5, "Developer output must be appended to execution history"

    # Step 6: QA Node execution
    qa_delta = workflow.qa_node(state)
    state = {**state, **qa_delta}
    assert state.get("status") == "pass", "QA audit must pass verification"
    qa_route = workflow.route_qa(state)
    assert qa_route == "ai_engineer", "QA pass must route to AI Engineer"

    # Step 7: AI Engineer Node execution
    ai_delta = workflow.ai_engineer_node(state)
    state = {**state, **ai_delta}
    assert state.get("status") == "completed", "Final workflow execution status must be 'completed'"
    assert len(state["history"]) == 7, "All 7 specialized agent nodes must be recorded in history"

    # Persist Project and verify local JSON file existence
    project_record = {
        "id": project_id,
        "requirement": requirement,
        "status": state["status"],
        "phase": "delivery",
        "brd": state["brd"],
        "frd": state["frd"],
        "tasks": state["tasks"],
        "history": state["history"],
    }
    save_project(project_record)

    # Assert project JSON file exists on disk under temp data dir
    project_file = tmp_data_dir / "projects" / f"{project_id}.json"
    assert project_file.exists(), f"Project JSON file {project_file} must exist under temp data dir"

    # Verify loaded project content matches state
    loaded = load_project(project_id)
    assert loaded is not None
    assert loaded["id"] == project_id
    assert loaded["status"] == "completed"
    assert loaded["requirement"] == requirement
    assert len(loaded["tasks"]) >= 2
    assert "brd" in loaded and "frd" in loaded
