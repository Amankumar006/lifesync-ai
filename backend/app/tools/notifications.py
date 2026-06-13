import logging
import datetime
from typing import List, Dict, Any
import httpx
from langchain_core.tools import tool
from firebase_admin import firestore_async

logger = logging.getLogger("app.tools.notifications")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_immediate_push(user_id: str, title: str, body: str) -> bool:
    """Fetches user's push_token from Firestore and sends an immediate push notification via Expo API."""
    logger.info(f"Sending immediate push to user={user_id}, title={title}")
    try:
        db = firestore_async.client()
        user_doc_ref = db.collection("users").document(user_id)
        user_doc = await user_doc_ref.get()
        if not user_doc.exists:
            logger.warning(f"User document for {user_id} not found in Firestore. Cannot send push.")
            return False
            
        user_data = user_doc.to_dict() or {}
        push_token = user_data.get("push_token")
        if not push_token:
            logger.warning(f"No push_token found for user {user_id}. Cannot send push.")
            return False

        payload = {
            "to": push_token,
            "title": title,
            "body": body,
            "sound": "default",
            "channelId": "schedule-reminders",
            "data": {"type": "immediate_notification"},
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.info(f"Immediate push notification sent successfully: {data}")
                return True
            else:
                logger.error(f"Expo push API returned {resp.status_code}: {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending immediate push notification: {e}", exc_info=True)
        return False


async def schedule_push_func(user_id: str, blocks: List[Dict[str, Any]], date: str = None) -> str:
    """Internal helper to store push notification schedules in Firestore."""
    if not date:
        date = datetime.date.today().isoformat()
    logger.info(f"Helper: schedule_push_func for user={user_id}, date={date}, blocks_count={len(blocks)}")
    try:
        db = firestore_async.client()
        
        # Calculate reminders for each block
        reminders = []
        for block in blocks:
            time = block.get("time", "")
            title = block.get("title", "")
            
            # Normalize time to HH:MM format
            time_formatted = "00:00"
            if time and ":" in time:
                try:
                    parts = time.split(":")
                    h = parts[0].strip().zfill(2)
                    m = parts[1].strip().zfill(2)
                    time_formatted = f"{h}:{m}"
                except Exception:
                    time_formatted = time
            else:
                time_formatted = time
            
            scheduled_for = f"{date}T{time_formatted}:00"
            
            reminders.append({
                "time": time_formatted,
                "title": title,
                "scheduled_for": scheduled_for,
                "sent": False,
                "body": f"Time to start your block: {title}"
            })
            
        doc_ref = db.collection("notifications").document(user_id).collection("pending").document(date)
        await doc_ref.set({
            "reminders": reminders,
            "updated_at": firestore_async.SERVER_TIMESTAMP
        }, merge=True)
        
        msg = f"Successfully scheduled {len(reminders)} push reminders for {date} in Firestore under pending collection."
        logger.info(msg)
        return msg
    except Exception as e:
        logger.error(f"Error scheduling push notifications in Firestore: {e}", exc_info=True)
        return f"Failed to schedule push notifications: {e}"

@tool
async def schedule_push(user_id: str, blocks: List[Dict[str, Any]], date: str = None) -> str:
    """Saves a notification schedule to Firestore for schedule reminders.
    
    Args:
        user_id: The ID of the user.
        blocks: A list of schedule block dicts, each containing 'time' and 'title'.
        date: Optional date string in YYYY-MM-DD format. Defaults to today's date.
    """
    return await schedule_push_func(user_id=user_id, blocks=blocks, date=date)
