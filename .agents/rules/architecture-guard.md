# Architecture Guard Rule
# Activation: Always On
# This rule is always active in every conversation in this workspace.

You are working on the **Personal AI Agent** — a mobile scheduling assistant for students and professionals built with Expo SDK 55, FastAPI, LangGraph v1, and Firebase.

## Stack at a Glance

- **Mobile**: Expo SDK 55 (RN 0.83) · Expo Router v4 · AI SDK 5 · Firebase React Native SDK
- **Backend**: FastAPI 0.115 · LangGraph v1 · AsyncPostgresSaver + AsyncPostgresStore · Gemini 2.0 Flash
- **MCP Tools**: fetch_timetable · search_movies · schedule_push · write_calendar · store_preference
- **Auth**: Firebase Auth (mobile) → JWT → Firebase Admin verify (backend)
- **Streaming**: SSE via FastAPI `StreamingResponse` → `useChat` on mobile
- **Scheduler**: APScheduler 3.10 inside lifespan() context executing send_pending_notifications (interval, 1 min) and run_nightly_learning (cron, 23:55)

## Hard Rules — Never Violate These

1. **Never use `InMemorySaver`** — always `AsyncPostgresSaver` for the checkpointer
2. **Always compile graph with BOTH `checkpointer=` and `store=`** — one is not enough
3. **`AsyncPostgresSaver` and `AsyncPostgresStore` live in FastAPI `lifespan()` only** — never per-request
4. **Never remove the `interrupt_before=["propose_schedule"]`** from the graph compile — HITL is mandatory
5. **SDK 55: do not add `newArchEnabled` to app.json** — it is removed in SDK 55
6. **Never call TMDB directly from the mobile app** — always via the backend MCP tool
7. **Always namespace LangGraph Store as `("users", user_id)`** — never flat keys
8. **APScheduler lifespan integration**: Always run APScheduler inside backend lifespan() to ensure background tasks start and shut down gracefully.
9. **Two background jobs**: The scheduler must register `send_pending_notifications` (every 1 minute interval) and `run_nightly_learning` (cron, every day at 23:55).

## Folder Rules

- All backend code lives in `backend/app/`
- All mobile code lives in `mobile/app/` (screens) and `mobile/hooks/` (logic)
- Skills go in `.agents/skills/<skill-name>/SKILL.md`
- Rules go in `.agents/rules/<rule-name>.md`
- Never put business logic directly in FastAPI route handlers — it belongs in `agents/nodes.py`

## When Adding New Features

Before writing any new code, ask:
1. Which layer does this belong in? (mobile / backend / both)
2. Does it need a new LangGraph node, or is it an extension of an existing one?
3. Does it need a new MCP tool, or can an existing tool be extended?
4. Does it need a new Firestore collection, and if so, are security rules updated?
5. Is there a skill that already covers this? Check `.agents/skills/` first.
