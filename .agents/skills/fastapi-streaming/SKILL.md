---
name: fastapi-streaming
description: Handles all FastAPI backend concerns for the Personal AI Agent: SSE streaming endpoints, Firebase JWT middleware, lifespan context management, MCP tool definitions with the @tool decorator, and API route structure. Use when creating new API endpoints, modifying the chat streaming route, adding new MCP tools (timetable, TMDB, push notifications, calendar), or debugging auth/streaming issues.
---

# FastAPI Streaming Skill

You are building the backend API layer of the Personal AI Agent using **FastAPI 0.115** with full async support. This backend hosts the LangGraph agent graph and exposes it via Server-Sent Events (SSE) for real-time streaming to the Expo mobile app.

## Stack Versions

- FastAPI: `0.115.0`
- Uvicorn: `0.34.0` (with `[standard]` extras for production)
- AI SDK protocol: **standard SSE** — `text/event-stream` only
- Auth: Firebase Admin SDK JWT verification

## The Lifespan Pattern — Always Follow This

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from app.agents.graph import create_graph
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with (
        AsyncPostgresStore.from_conn_string(settings.DB_URI) as store,
        AsyncPostgresSaver.from_conn_string(settings.DB_URI) as checkpointer,
    ):
        await store.setup()
        await checkpointer.setup()
        app.state.graph = await create_graph(store, checkpointer)
        yield  # ← app serves requests here

app = FastAPI(title="Personal AI Agent API", lifespan=lifespan)
```

**Why**: Both `AsyncPostgresStore` and `AsyncPostgresSaver` hold connection pools. They must stay alive for the entire app lifetime — not created per-request.

## SSE Streaming Endpoint — Exact Format

AI SDK 5 on the mobile side expects standard SSE. The format is:

```
data: {"type": "text", "text": "chunk content"}\n\n
data: [DONE]\n\n
```

```python
# backend/app/api/chat.py
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import json

router = APIRouter()

@router.post("/chat")
async def chat_endpoint(request: Request, body: dict):
    graph = request.app.state.graph
    user_id = body["user_id"]
    thread_id = body["thread_id"]
    message = body["message"]

    config = {"configurable": {"thread_id": thread_id}}
    inputs = {
        "messages": [{"role": "user", "content": message}],
        "user_id": user_id,
        "task_queue": [],
    }

    async def event_stream():
        async for chunk in graph.astream(inputs, config, stream_mode="messages"):
            if chunk:
                payload = json.dumps({"type": "text", "text": str(chunk)})
                yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # ← required for nginx proxying
        }
    )
```

## Firebase JWT Middleware

```python
# backend/app/api/auth.py
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, credentials, initialize_app
import firebase_admin

security = HTTPBearer()

# Initialize once at module load
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-service-account.json")
    initialize_app(cred)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> str:
    """Verify Firebase JWT → return uid"""
    try:
        decoded = auth.verify_id_token(credentials.credentials)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
```

Apply to any route that needs auth:
```python
@router.post("/schedule")
async def get_schedule(user_id: str = Depends(get_current_user)):
    ...
```

## MCP Tool Pattern — @tool Decorator

All tools the agent can call are defined with `@tool`. Follow this pattern exactly:

```python
from langchain_core.tools import tool

@tool
async def fetch_timetable(user_id: str, date: str) -> dict:
    """Fetch the user's college timetable for a specific date.
    Returns list of classes with time, subject, room, and required textbooks.
    Use this when building a schedule to get fixed class blocks."""
    # ... implementation
```

**Docstring is critical** — the LLM uses it to decide when to call the tool.

## Registered MCP Tools (Never Remove)

| Tool | File | Purpose |
|------|------|---------|
| `fetch_timetable` | `tools/timetable.py` | Get college classes by date from Firestore |
| `search_movies` | `tools/tmdb.py` | TMDB movie recs by genre + runtime |
| `schedule_push` | `tools/notifications.py` | Register Expo push notifications |
| `write_calendar` | `tools/calendar.py` | Write approved schedule to Firestore |
| `store_preference` | `tools/memory.py` | Write user edits back to LangGraph Store |

## Running Locally

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

Use `--host 0.0.0.0` so the Expo dev client on your physical Android device can reach the server over LAN.

## CORS — Required for Mobile Dev

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Quick Smoke Test

```bash
curl -N -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"uid123","thread_id":"t1","message":"schedule my day"}'
# -N disables buffering so you see SSE chunks as they arrive
# You should see: data: {"type":"text","text":"..."} lines streaming
```
