---
name: langgraph-agent-builder
description: Builds and modifies LangGraph v1 agent graphs for the Personal AI Agent backend. Use when creating new agent nodes, adding conditional edges, wiring memory layers (AsyncPostgresSaver checkpointer + AsyncPostgresStore), defining AgentState TypedDicts, or debugging graph execution flow. Also use when adding new specialist sub-agents (Routine, Academic, Entertainment, Location) or when the user asks to change how the agent makes decisions.
---

# LangGraph Agent Builder Skill

You are building a **multi-agent scheduling system** using LangGraph v1. The backend is Python + FastAPI. Every change you make to the agent graph must respect the production constraints documented here.

## Project Context

- **Root orchestrator**: `gemini-2.0-flash` (cloud) — handles complex reasoning, intent classification, schedule building
- **Sub-agents**: On-device Gemini Nano (via ADK for Android) handles Routine, Academic, and Location agents for privacy-sensitive/offline tasks
- **Memory**: Two layers — `AsyncPostgresSaver` (session/checkpointer) + `AsyncPostgresStore` (cross-session/long-term)
- **HITL**: Graph interrupts at `propose_schedule` node — never commits a schedule without user approval
- **Tracing**: LangSmith is always on — set `LANGCHAIN_TRACING_V2=true`

## File Locations

```
backend/app/agents/
├── graph.py       ← StateGraph definition + compile()
├── nodes.py       ← All node functions
├── state.py       ← AgentState TypedDict
└── router.py      ← Conditional edge functions
```

## Non-Negotiable Rules

1. **NEVER use `InMemorySaver` or `MemorySaver`** — these are test-only. Always use `AsyncPostgresSaver`.
2. **ALWAYS compile with both memory layers**:
   ```python
   builder.compile(
       checkpointer=checkpointer,   # session memory
       store=store,                  # cross-session memory
       interrupt_before=["propose_schedule"]  # HITL
   )
   ```
3. **NEVER instantiate `AsyncPostgresSaver` or `AsyncPostgresStore` per-request**. They live in FastAPI's `lifespan()` context manager only, attached to `app.state.graph`.
4. **ALWAYS call `await store.setup()` and `await checkpointer.setup()`** inside `lifespan()` on first run — this creates the Postgres tables automatically.
5. **Store namespaces** must follow the pattern `("users", user_id)` for profiles, `("users", user_id, "habits")` for behavioral signals.

## AgentState Fields (Do Not Remove Any)

```python
class AgentState(MessagesState):
    user_id: str
    user_profile: dict
    intent: Optional[str]          # "schedule_build" | "schedule_edit" | "entertainment_rec" | "reminder_set" | "general"
    intent_scope: Optional[str]    # "day" | "week"
    intent_date: Optional[str]     # "YYYY-MM-DD"
    timetable_today: Optional[dict]
    task_queue: list[dict]
    proposed_schedule: Optional[list]
    approved_schedule: Optional[list]
    needs_clarification: bool
    clarification_question: Optional[str]
    human_feedback: Optional[dict]
```

## Graph Node Order

```
START
  → classify_intent        (LLM: classify user message into intent + scope)
  → hydrate_context        (parallel: Store profile fetch + Firestore timetable fetch)
  → check_clarification    (conditional branch point)
      → ask_clarification  (if missing slots → HITL interrupt, then resume)
      → build_schedule     (core planning LLM call with full profile context)
  → propose_schedule       ← HITL interrupt_before here
      → commit_schedule    (on approval: MCP tools — calendar_write, push_schedule, preference_store)
      → build_schedule     (on rejection with edits: rebuild with human_feedback)
END
```

## Conditional Edge Pattern

```python
def route_after_context(state: AgentState) -> str:
    if state["needs_clarification"]:
        return "ask_clarification"
    return "build_schedule"

def route_after_proposal(state: AgentState) -> str:
    feedback = state.get("human_feedback", {})
    if feedback.get("approved"):
        return "commit_schedule"
    return "rebuild"   # maps to "build_schedule" node
```

## Adding a New Node — Checklist

When the user asks to add a new agent node:
1. Define the async function in `nodes.py` with signature `async def node_name(state: AgentState, store: BaseStore) -> dict`
2. Add `builder.add_node("node_name", node_name)` in `graph.py`
3. Wire edges: `builder.add_edge(...)` or `builder.add_conditional_edges(...)`
4. If the node needs cross-session memory, inject `store: BaseStore` in the signature — LangGraph injects it automatically when compiled with a store
5. Return only the keys that changed — LangGraph merges partial returns into state

## Schedule Build Prompt Template

When writing or editing `build_schedule_node`, always include these sections in the system prompt sent to Gemini:

```
FIXED BLOCKS (non-negotiable, do not move):
- [list from timetable_today]

USER PROFILE:
- wake_time, sleep_target, peak_focus_time, study_block_pref
- gym_days + preferred time
- reschedule_patterns (skip probabilities per block type)
- current_mode: weekday | weekend

TASK QUEUE (sorted by deadline):
- [list from task_queue with due dates and priority]

CONSTRAINTS FROM FEEDBACK:
- [human_feedback edits if this is a rebuild]

Output: JSON array of {time, title, type, duration_min, notes, priority}
```

## Testing a New Node

Before committing, always:
```bash
# Run the graph with a test message
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test123","thread_id":"test-sess-1","message":"schedule my day"}'

# Check LangSmith at smith.langchain.com for the full trace
# Verify: node fired, correct edge taken, state updated correctly
```

## Common Mistakes to Avoid

- **Don't** use `graph.invoke()` for streaming — use `graph.astream()` with `stream_mode="messages"`
- **Don't** forget `async` on all node functions — FastAPI is fully async
- **Don't** return the full state from a node — return only changed keys as a `dict`
- **Don't** add `interrupt_before` to the `ask_clarification` node — only `propose_schedule` is a HITL pause point
