from langchain_core.tools import tool
from langgraph.store.base import BaseStore
from typing import Any

async def store_preference_func(user_id: str, key: str, value: Any, store: BaseStore) -> str:
    """Internal helper to store a user preference or profile field in the LangGraph Store."""
    namespace = ("users", user_id)
    item = await store.aget(namespace, "profile")
    profile = item.value if (item and hasattr(item, "value") and item.value) else {}
    
    profile[key] = value
    await store.aput(namespace, "profile", profile)
    return f"Successfully saved {key} = {value} for user {user_id}."

@tool
async def store_preference(user_id: str, key: str, value: Any, store: BaseStore) -> str:
    """Stores a user preference or profile field in the LangGraph Store.
    
    Use this to save fields like role, wake_time, gym_days, or sleep_target for a user.
    All data is namespaced under ("users", user_id).
    """
    return await store_preference_func(user_id, key, value, store)

