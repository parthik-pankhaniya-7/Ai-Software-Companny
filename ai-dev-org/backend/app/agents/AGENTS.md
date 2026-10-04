# AGENTS.md — backend/app/agents/

## Rules
1. One file = one agent. No helper files here.
2. Every agent function shape:
   def run_<name>(inp: AgentInput) -> AgentOutput:
       result = call_llm(prompt=..., task_type=..., complexity=..., system=SYSTEM, json_mode=True)
       parsed = SomeModel.model_validate_json(result["text"])
       return AgentOutput(status="ok", summary="", artifacts=parsed.model_dump(), meta=result)
3. System prompts must demand strict JSON, list exact keys, forbid markdown fences.
4. Never call another agent directly. Only the graph orchestrates agents.
5. Never write to disk. Return artifacts; the caller saves.
6. Never use gemini-1.5-pro for classification or routing.
