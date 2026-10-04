# AGENTS.md — backend/app/router/

## Rules
1. Only file allowed to import litellm or google.generativeai.
2. Model map is a module-level constant.
3. call_llm is the only public function.
4. Max 3 retries. Retry on 429 and timeout only.
5. Always return {text, model, tokens_in, tokens_out, latency, cost}.
6. cost is 0.0 for free tier. Do not fake numbers.
7. On repeated failure, fallback to gemini-1.5-flash, then raise.
8. Log every call via app.observability.log.
