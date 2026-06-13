import logging
import datetime
from langchain_core.tools import tool
from firebase_admin import firestore_async

logger = logging.getLogger("app.tools.timetable")

async def fetch_timetable_func(user_id: str, date: str) -> dict:
    """Internal helper to fetch college timetable, academic events, and personal schedule from Firestore."""
    logger.info(f"Helper: fetch_timetable_func for user={user_id}, date={date}")
    try:
        weekday = datetime.datetime.fromisoformat(date).strftime("%A")
        
        db = firestore_async.client()
        
        # 1. Fetch timetable document
        timetable_doc = await db.collection("timetables").document(user_id).get()
        timetable_exists = timetable_doc.exists
        classes = []
        if timetable_exists:
            classes = (timetable_doc.to_dict() or {}).get(weekday, [])
            
        # 2. Fetch academic events list
        academic_events = []
        try:
            events_ref = db.collection("academic_events").document(user_id).collection("items")
            events_snap = await events_ref.get()
            for doc in events_snap:
                event_data = doc.to_dict()
                event_data["id"] = doc.id
                academic_events.append(event_data)
        except Exception as event_err:
            logger.warning(f"Failed to fetch academic events: {event_err}")
            
        # 3. Fetch personal schedule fixed blocks
        personal_fixed_blocks = []
        try:
            personal_doc = await db.collection("personal_schedule").document(user_id).get()
            if personal_doc.exists:
                personal_fixed_blocks = (personal_doc.to_dict() or {}).get("fixed_blocks", [])
        except Exception as personal_err:
            logger.warning(f"Failed to fetch personal schedule: {personal_err}")
            
        logger.info(f"Retrieved {len(classes)} classes, {len(academic_events)} academic events, and {len(personal_fixed_blocks)} personal blocks.")
        return {
            "classes": classes,
            "weekday": weekday,
            "academic_events": academic_events,
            "personal_fixed_blocks": personal_fixed_blocks,
            "timetable_exists": timetable_exists
        }
    except Exception as e:
        logger.error(f"Error fetching schedule info from Firestore: {e}", exc_info=True)
        try:
            weekday = datetime.datetime.fromisoformat(date).strftime("%A")
        except Exception:
            weekday = "Unknown"
        return {
            "classes": [],
            "weekday": weekday,
            "academic_events": [],
            "personal_fixed_blocks": [],
            "timetable_exists": False,
            "error": str(e)
        }

@tool
async def fetch_timetable(user_id: str, date: str) -> dict:
    """Fetch college timetable for a specific date. Returns fixed class blocks.
    
    Args:
        user_id: The ID of the user.
        date: The target date in YYYY-MM-DD format.
    """
    return await fetch_timetable_func(user_id, date)

