from typing import Any, Dict
from langgraph.store.base import BaseStore
from firebase_admin import firestore_async
import logging

logger = logging.getLogger("app.memory.store")

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

async def sync_and_load_user_profile(store: BaseStore, user_id: str) -> Dict[str, Any]:
    """Loads user profile from LangGraph Store, syncs it with Firestore, and returns the synced profile."""
    profile = await load_user_profile(store, user_id)
    db = firestore_async.client()
    try:
        user_doc = await db.collection("users").document(user_id).get()
        if user_doc.exists:
            firestore_data = user_doc.to_dict() or {}
            profile_updated = False
            for k, v in firestore_data.items():
                if k == "completed_discovery":
                    completed = profile.get("completed_discovery", [])
                    original_len = len(completed)
                    for item in v:
                        if item not in completed:
                            completed.append(item)
                    if len(completed) > original_len:
                        profile["completed_discovery"] = completed
                        profile_updated = True
                else:
                    if profile.get(k) != v:
                        profile[k] = v
                        profile_updated = True
            if profile_updated:
                await save_user_profile(store, user_id, profile)
    except Exception as sync_err:
        logger.warning(f"Failed to sync user profile with Firestore for user {user_id}: {sync_err}")
    return profile


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
