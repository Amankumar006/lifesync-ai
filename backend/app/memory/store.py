from typing import Any, Dict
from langgraph.store.base import BaseStore

async def save_user_profile(store: BaseStore, user_id: str, profile: Dict[str, Any]) -> None:
    """Saves the user profile to the LangGraph Store.
    
    Namespaced under ("users", user_id) with key "profile".
    """
    namespace = ("users", user_id)
    await store.aput(namespace, "profile", profile)

async def load_user_profile(store: BaseStore, user_id: str) -> Dict[str, Any]:
    """Loads the user profile from the LangGraph Store.
    
    Returns an empty dict if not found.
    """
    namespace = ("users", user_id)
    item = await store.aget(namespace, "profile")
    if item and hasattr(item, "value") and item.value:
        return item.value
    return {}

async def update_profile_field(store: BaseStore, user_id: str, key: str, value: Any) -> None:
    """Updates a single field in the user profile."""
    profile = await load_user_profile(store, user_id)
    profile[key] = value
    await save_user_profile(store, user_id, profile)

async def record_behavior(store: BaseStore, user_id: str, event: str, outcome: Any) -> None:
    """Records a behavioral outcome (habit history) in the store.
    
    Namespaced under ("users", user_id, "habits").
    """
    namespace = ("users", user_id, "habits")
    item = await store.aget(namespace, event)
    history = item.value if (item and hasattr(item, "value") and item.value) else []
    
    if not isinstance(history, list):
        history = [history]
    history.append(outcome)
    
    await store.aput(namespace, event, history)
