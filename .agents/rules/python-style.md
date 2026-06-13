# Python Code Style Rule
# Activation: Glob → **/*.py
# Applied automatically to all Python files in this workspace.

## Python Conventions for This Project

### Async First
All functions that touch I/O (database, HTTP, Firebase, LangGraph) **must be async**:
```python
# ✅ Correct
async def fetch_timetable(user_id: str, date: str) -> dict:
    ...

# ❌ Wrong — will block the event loop
def fetch_timetable(user_id: str, date: str) -> dict:
    ...
```

### Type Hints — Always
Every function must have input and return type hints:
```python
# ✅
async def build_schedule(state: AgentState) -> dict:

# ❌
async def build_schedule(state):
```

### LangGraph Node Return Pattern
Nodes return only the keys that changed — not the full state:
```python
# ✅ Correct — partial return
async def classify_intent_node(state: AgentState) -> dict:
    return {"intent": "schedule_build", "intent_scope": "day"}

# ❌ Wrong — don't return the whole state
async def classify_intent_node(state: AgentState) -> AgentState:
    state["intent"] = "schedule_build"
    return state
```

### Error Handling in MCP Tools
Always catch and return structured errors — never let tools raise unhandled exceptions:
```python
@tool
async def fetch_timetable(user_id: str, date: str) -> dict:
    """..."""
    try:
        # ... implementation
    except Exception as e:
        return {"error": str(e), "classes": []}
```

### Imports — Order
1. Standard library
2. Third-party (fastapi, langchain, firebase_admin)
3. Local app modules (`from app.agents.state import AgentState`)

### Environment Variables
Always use `settings` from `app/config.py` — never `os.getenv()` directly in route handlers or nodes:
```python
# ✅
from app.config import settings
key = settings.GEMINI_API_KEY

# ❌
import os
key = os.getenv("GEMINI_API_KEY")
```

### Config (pydantic-settings)
```python
# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GEMINI_API_KEY: str
    DB_URI: str
    TMDB_API_KEY: str
    LANGCHAIN_API_KEY: str
    LANGCHAIN_TRACING_V2: str = "true"
    LANGCHAIN_PROJECT: str = "personal-ai-agent"

    class Config:
        env_file = ".env"

settings = Settings()
```
