# AGENTS.md — Root Rules

## Read First
Before any task, read in this order:
1. AGENTS.md (this file)
2. docs/architecture.md
3. docs/agent-contracts.md
4. The AGENTS.md in the folder you are editing

If any file is missing, STOP and report. Do not guess.

## Project
ai-dev-org is a local-first multi-agent AI software development environment.
Runs on the user's laptop. Uses Gemini API for LLM calls.
No cloud. No database server.

## Stack (fixed)
Python 3.11, FastAPI, LangGraph (MemorySaver), LiteLLM, Gemini API,
JSON file persistence under ./data, optional ChromaDB for vector memory,
Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, React Flow,
TanStack Query, Zustand.

## Persistence Rule
There is NO database. All state is JSON/JSONL files under ./data.
All file access goes through backend/app/memory/store.py.
Never import sqlite3, psycopg, psycopg2, asyncpg, redis, or pymongo.

## Hard Rules — Never Violate
1. Never add a new library without explicit approval in the prompt.
2. Never use OpenAI, Anthropic, Claude, Cohere, Mistral, or Ollama.
   Only Gemini via LiteLLM.
3. Never hardcode API keys. Read from settings or .env.
4. Never write outside the repo. Never run global installs.
5. Never auto-deploy, auto-merge, or auto-push.
6. Never invent file paths. List directories if unsure.
7. Never invent function names. Check files if unsure.
8. Never leave TODO placeholders unless asked.
9. Always add tests for backend. Always add types for TS.
10. Single process only. Use asyncio.Queue for in-process events.

## Ports
Backend 8000, Frontend 3000.

## Definition of Done
1. Code imports resolve.
2. Tests exist and pass.
3. No lint errors.
4. No new dependency.
5. Docs updated if behavior changed.
6. Only files listed in the prompt were touched.

## Style
Backend: PEP8, type hints on every function, docstrings on public APIs.
Frontend: functional components only. No class components.
No emojis. No trailing whitespace.
