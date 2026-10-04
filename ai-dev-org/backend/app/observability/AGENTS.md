# AGENTS.md — backend/app/observability/

## Rules
1. JSONL logging only. File: ./logs/langfuse.jsonl
2. No external observability services.
3. Never log API keys or secrets.
4. Rotate log if > 50MB.
