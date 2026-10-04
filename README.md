# ai-dev-org — Autonomous Multi-Agent AI Software Organization

A local-first, single-process multi-agent software engineering studio powered exclusively by the **Google Gemini API** via **LiteLLM**. 

`ai-dev-org` coordinates a hierarchy of 7 specialized autonomous AI agents (CTO, PM, Team Lead, UI/UX Designer, Full-Stack Developer, QA Engineer, AI Engineer) to take natural language requirements from concept to production-ready code, complete specifications, unit test suites, and interactive UI artifacts.

---

## 🌟 Key Features & Architecture

- **Local-First & Zero Server Database**:
  - No SQLite, PostgreSQL, Redis, or MongoDB required.
  - All project states, tasks, messages, and memory are atomically persisted as JSON and JSONL files under `./data`.
  - Embedded vector memory powered by persistent **ChromaDB** under `./data/chroma`.
- **Pure Gemini Model Matrix**:
  - **`gemini/gemini-1.5-pro`**: High-complexity reasoning, system architecture, task planning, and evaluation.
  - **`gemini/gemini-2.0-flash`**: High-speed source code implementation, test verification, and fast execution.
  - **`gemini/gemini-1.5-flash`**: Interface wireframing, design tokens, documentation, and automatic failover fallback.
- **Human-in-the-Loop Governance**:
  - Interactive approval cards for milestone gates: **Approve**, **Reject**, and **Escalate**.
  - Configurable governance gate policies stored in client `localStorage`.
- **Real-Time Streaming**:
  - In-process event streaming via native `asyncio.Queue` and WebSockets (`/ws/projects/{id}`).
  - Instant UI reflection of active agent tasks, token consumption, and handoffs.
- **Modern Next.js 14 Studio**:
  - Built with TypeScript, Tailwind CSS, shadcn/ui components, TanStack Query, Zustand, and **React Flow**.

---

## 🤖 7 Specialized Autonomous Agent Roles

| Agent Persona | Role Responsibility | Default Model Policy | Primary Artifacts Produced |
|---|---|---|---|
| **Chief Technology Officer (CTO)** | System architecture, technical feasibility, security boundaries, and architectural governance. | `gemini/gemini-1.5-pro` (`reasoning/high`) | **BRD**, **FRD**, System Architecture |
| **Product Manager (PM)** | Sprint planning, feature breakdown, milestone scheduling, and ticket acceptance criteria. | `gemini/gemini-1.5-pro` (`reasoning/high`) | Epics, Features, Granular Task Backlog |
| **Engineering Team Lead** | Technical task mapping, file allocation, dependency checks, and UI requirement detection. | `gemini/gemini-1.5-pro` (`reasoning/high`) | Technical Implementation Plans, File Boundaries |
| **UI/UX Designer** | Interface architecture, design tokens, component hierarchies, loading/error states, and wireframes. | `gemini/gemini-1.5-flash` (`doc/any`) | Component Specs, Screen Wireframes |
| **Full-Stack Developer** | Source code implementation across frontend and backend, adherence to contracts and PEP8. | `gemini/gemini-2.0-flash` (`coding/high`) | Multi-file Code Blocks, Implementation Files |
| **QA / QC Engineer** | Unit/integration test suites, syntax audits, acceptance validation, defect logging, and retry triggers. | `gemini/gemini-2.0-flash` (`coding/low`) | Unit Test Suites, QA Audit Pass/Fail Reports |
| **AI Engineer** | Token budget allocation, model routing optimization, context window tuning, and delivery sign-off. | `gemini/gemini-1.5-pro` (`reasoning/high`) | Token Telemetry, Routing Decisions |

---

## 🔑 How to Generate & Configure Your Gemini API Key

`ai-dev-org` uses the **Google Gemini API** (free tier available with 0.00 operational cost).

### Step 1: Generate Your API Key
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click on the **"Get API key"** button in the top left navigation.
4. Click **"Create API key"** (select a Google Cloud project or create a new default one).
5. Copy the generated key (starts with `AIzaSy...`).

### Step 2: Configure the Environment File
In the project root, navigate to `backend/` and create or edit your `.env` file:

```bash
# In backend/.env
GEMINI_API_KEY="AIzaSyYourGeneratedGeminiKeyHere"

# Optional settings
DATA_DIR="./data"
LOG_DIR="./logs"
FRONTEND_URL="http://localhost:3000"
```

> [!IMPORTANT]
> **Strict Security Policy**: Your API key is read strictly by the backend server and is **never** sent to or rendered in client browsers (Rule #3: Zero-exposure masking).

---

## 📦 Prerequisites

- **Python**: Version 3.11 or higher
- **Node.js**: Version 18.17.0 or higher
- **npm**: Version 9 or higher
- **Git**

---

## 🚀 Quick Start (Single-Command Launch)

### On Linux / macOS (POSIX Bash)
```bash
# Make script executable and run:
chmod +x scripts/dev.sh
./scripts/dev.sh
```

### On Windows (PowerShell)
```powershell
# Run the automated Windows launcher:
.\scripts\dev.ps1
```

Both servers will start concurrently:
- **Backend API**: [http://localhost:8000](http://localhost:8000) (Interactive Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs))
- **Frontend Studio**: [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Manual Step-by-Step Setup

If you prefer to configure and run the backend and frontend separately:

### 1. Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create isolated Python virtual environment
python -m venv .venv

# 3. Activate the virtual environment
# On Linux/macOS:
source .venv/bin/activate
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create .env file with your Gemini API key
cp .env.example .env

# 6. Start FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
# 1. Open a new terminal and navigate to frontend
cd frontend

# 2. Install npm dependencies
npm install

# 3. Verify .env.local configuration
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_WS_URL=ws://localhost:8000

# 4. Start Next.js development server
npm run dev
```

---

## 🖥️ Studio Views & Navigation

| Route | View Name | Capabilities |
|---|---|---|
| `/dashboard` | **Projects Dashboard** | Overview grid of active projects, execution phases, progress bars, and new project modal. |
| `/agents` | **Multi-Agent Roster** | Real-time table displaying all 7 specialized agents, active tasks, Gemini model routing, and token metrics. |
| `/workflow/[id]` | **Workflow Graph** | Interactive **React Flow** canvas showing live node execution states (grey, blue, green, red) and handoff edges. |
| `/tasks/[id]` | **8-Column Kanban Backlog** | Synchronized Kanban board: *Backlog*, *Ready*, *In Progress*, *Blocked*, *Code Review*, *QA*, *Rework*, and *Done*. Clicking any card opens a detailed slide-over drawer with acceptance criteria and produced artifacts. |
| `/chat/[id]` | **Agent Live Console** | Real-time WebSocket log stream, questions/risks audit, operator chat input, and interactive approval cards (**Approve / Reject / Escalate**). |
| `/artifacts/[id]` | **Artifacts Explorer** | Dedicated tabbed viewer for **BRD**, **FRD**, **Architecture**, **Code**, and **Tests** with line numbers, code copy, and download options. |
| `/ai-ops` | **AI Ops & Observability** | Token telemetry per model, retry and failure diagnostics, average latency benchmarks, and SVG model routing pie chart reading `./logs/langfuse.jsonl`. |
| `/settings` | **Settings & Policies** | Model routing matrix, masked API key protection, and human approval gate toggles saved to `localStorage`. |

---

## 🧪 Running Test Suites

Run the complete backend test suite using `pytest`:

```bash
cd backend

# Run all unit and integration tests
pytest -v

# Run the end-to-end multi-agent workflow simulation
pytest -s tests/test_e2e.py
```

Test coverage includes:
- `tests/test_store.py`: Atomic JSON/JSONL persistence operations
- `tests/test_vectors.py`: ChromaDB vector memory indexing and search
- `tests/test_router.py`: Gemini model routing and automatic Pro-to-Flash fallback
- `tests/test_agents.py`: CTO, PM, Team Lead, UI/UX, Developer, QA, and AI Engineer contracts
- `tests/test_workflow.py`: LangGraph conditional routing and state serialization
- `tests/test_events.py`: Single-process `asyncio.Queue` WebSocket pub/sub
- `tests/test_tools.py`: Local Git and shell execution protection
- `tests/test_e2e.py`: End-to-end customer wallet development workflow

---

## 📁 Project Directory Structure

```text
ai-dev-org/
├── backend/
│   ├── app/
│   │   ├── agents/          # 7 Specialized agent modules (cto, pm, developer, qa, etc.)
│   │   ├── api/             # FastAPI REST endpoints & WebSocket pub/sub events
│   │   ├── graph/           # LangGraph workflow, state schema, and conditional routing
│   │   ├── memory/          # Atomic JSON/JSONL store, ChromaDB vector memory, and context builder
│   │   ├── models/          # Pydantic v2 schemas (AgentInput, AgentOutput, Project, Task, Message)
│   │   ├── observability/   # JSONL logging and automatic 50MB log rotation
│   │   ├── router/          # LiteLLM client with Gemini model routing & retry backoff
│   │   ├── tools/           # Safe local Git, Shell allowlist, and Semantic Search tools
│   │   └── main.py          # FastAPI application entrypoint and lifespan initializer
│   ├── tests/               # Comprehensive test suites & E2E workflow simulation
│   └── requirements.txt     # Backend Python dependencies
├── frontend/
│   ├── app/                 # Next.js 14 App Router pages
│   │   ├── agents/          # Multi-Agent roster table
│   │   ├── ai-ops/          # Observability dashboard & SVG pie chart
│   │   ├── artifacts/       # BRD, FRD, Architecture, Code & Test explorer
│   │   ├── chat/            # Live console stream & human governance approval cards
│   │   ├── dashboard/       # Project grid & creation modal
│   │   ├── settings/        # Model matrix & approval gate toggles
│   │   ├── tasks/           # 8-column read-only Kanban backlog & slide-over drawer
│   │   ├── workflow/        # React Flow pipeline graph with status color-coding
│   │   └── layout.tsx       # Sidebar navigation & dark glassmorphism layout
│   ├── components/ui/       # Modular shadcn/ui primitives (Table, etc.)
│   ├── lib/                 # Type-safe native fetch (api.ts) & WebSocket client (ws.ts)
│   ├── store/               # Zustand state store
│   └── package.json         # Frontend dependencies (React Flow, TanStack Query, Zustand)
├── data/                    # Local JSON/JSONL persistent storage (projects, memory, langgraph)
├── logs/                    # Append-only Langfuse observability logs (langfuse.jsonl)
├── scripts/
│   ├── dev.sh               # POSIX bash launcher
│   └── dev.ps1              # Windows PowerShell launcher
└── README.md                # Comprehensive documentation
```

---

## 📄 License & Standards

- **Zero Cloud Leakage**: All state remains local on your laptop.
- **Gemini Free Tier Compliant**: Optimized token usage with automated budget tracking.
- **Production-Ready Code**: No TODO placeholders, strict TypeScript type checks, and complete unit test suites.
