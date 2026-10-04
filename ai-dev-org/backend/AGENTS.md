# AGENTS.md — backend/

Inherit /AGENTS.md.

## Layout (do not deviate)
backend/app/
  main.py           FastAPI entry
  config.py         pydantic-settings loader
  api/              routes + events.py + ws.py
  agents/           cto.py, pm.py, team_lead.py, uiux.py, developer.py, qa.py, ai_engineer.py
  graph/            workflow.py + state.py
  memory/           store.py + vectors.py + context.py
  router/           llm.py
  tools/            git_tool.py, shell_tool.py, search_tool.py
  models/           Pydantic models only
  observability/    log.py

## Rules
1. All LLM calls go through app.router.llm.call_llm. Never import litellm or google.generativeai elsewhere.
2. All agents are pure functions: run_<agent>(inp: AgentInput) -> AgentOutput.
3. All file access goes through app.memory.store. No raw open() outside store.py.
4. All tool usage goes through app.tools.*. Never call subprocess directly.
5. Pydantic v2. Use model_dump(), not .dict().
6. Route handlers are async. Agents are sync unless they call async I/O.
7. Every new module gets a matching test in backend/tests/.
8. Never catch bare Exception. Catch specific exceptions.
9. Never use print(). Use logging.
10. Never commit .env, __pycache__, .venv, data/.

## Model Policy
- reasoning/high → gemini/gemini-1.5-pro
- reasoning/low  → gemini/gemini-1.5-flash
- coding/high    → gemini/gemini-1.5-pro
- coding/low     → gemini/gemini-2.0-flash
- doc/any        → gemini/gemini-1.5-flash
- routing/any    → gemini/gemini-1.5-flash

Never bypass the router. Never hardcode a model string in an agent.

## Forbidden
- sqlite3, psycopg, psycopg2, asyncpg, redis, pymongo
- openai, anthropic, cohere, mistralai, ollama
- requests (use httpx)
- flask, django
- pickle, eval, exec
- subprocess outside app/tools/shell_tool.py
- Global mutable state
