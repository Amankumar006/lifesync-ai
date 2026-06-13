import logging
from typing import List, Dict, Any
from langchain_core.tools import tool
from firebase_admin import firestore_async

logger = logging.getLogger("app.tools.calendar")

async def write_calendar_func(user_id: str, date: str, blocks: List[Dict[str, Any]]) -> str:
    """Internal helper to write the approved daily schedule blocks to Firestore for the user."""
    logger.info(f"Helper: write_calendar_func for user={user_id}, date={date}, blocks_count={len(blocks)}")
    try:
        db = firestore_async.client()
        
        doc_ref = db.collection("schedules").document(user_id).collection("days").document(date)
        
        await doc_ref.set({
            "blocks": blocks,
            "approved": True,
            "created_at": firestore_async.SERVER_TIMESTAMP
        }, merge=True)
        
        msg = f"Successfully wrote schedule for {date} to Firestore."
        logger.info(msg)
        return msg
    except Exception as e:
        logger.error(f"Error writing calendar to Firestore: {e}", exc_info=True)
        return f"Failed to write calendar to Firestore: {e}"

@tool
async def write_calendar(user_id: str, date: str, blocks: List[Dict[str, Any]]) -> str:
    """Writes the approved daily schedule blocks to Firestore for the user.
    
    Args:
        user_id: The ID of the user.
        date: The target date in YYYY-MM-DD format.
        blocks: A list of schedule block dicts (containing time, title, type, duration_min, notes).
    """
    return await write_calendar_func(user_id, date, blocks)

