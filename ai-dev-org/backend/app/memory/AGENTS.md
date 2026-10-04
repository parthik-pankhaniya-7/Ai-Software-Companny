# AGENTS.md — backend/app/memory/

## Rules
1. This is the ONLY place that reads/writes ./data.
2. Every write is atomic: write to <file>.tmp then os.replace.
3. JSON files UTF-8, 2-space indent. JSONL append-only.
4. Never import sqlite3 or any DB driver.
5. Never load more than one project's memory into RAM at a time.
6. Never mutate a loaded dict and save it back without calling save_project or save_task.
7. Vector search uses ChromaDB only. Never hand-roll embedding math.
8. If USE_CHROMA=false, fall back to keyword search on JSONL.
9. Paths built with pathlib only.
10. On malformed JSON, log and skip. Never crash.
