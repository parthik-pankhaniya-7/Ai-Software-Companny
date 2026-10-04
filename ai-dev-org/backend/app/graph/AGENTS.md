# AGENTS.md — backend/app/graph/

## Rules
1. Only place with agent-to-agent orchestration.
2. Nodes are pure wrappers around agent functions.
3. Edges explicit. No hidden recursion.
4. Retry counters in state, not globals.
5. Max retries 3, then escalate.
6. State must be JSON-serializable.
7. Never mutate state in place. Return new dicts.
8. Use MemorySaver. Never PostgresSaver or SqliteSaver.
