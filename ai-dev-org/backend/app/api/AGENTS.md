# AGENTS.md — backend/app/api/

## Rules
1. No Redis. Use asyncio.Queue in events.py.
2. Single-process only.
3. All routes return Pydantic models.
4. All routes are async.
5. WebSocket route subscribes via events.subscribe.
6. CORS allows FRONTEND_URL only.
