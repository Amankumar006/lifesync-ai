import logging
import datetime
import asyncio
from firebase_admin import firestore_async
from langgraph.store.postgres.aio import AsyncPostgresStore
from app.config import settings
from app.memory.store import load_user_profile, save_user_profile

logger = logging.getLogger("app.tasks.nightly_learning")

async def nightly_learning_job(date_str: str = None):
    """Nightly behavioral learning job.
    
    1. Fetches all users from Firestore.
    2. Reads today's schedule for each user.
    3. Analyzes completed vs skipped blocks.
    4. Updates skip probabilities in the LangGraph Store profile.
    """
    logger.info("Executing nightly behavioral learning job...")
    try:
        from app.api.auth import firebase_initialized
        if not firebase_initialized:
            logger.warning("Nightly learning job: Firebase not initialized. Skipping.")
            return
            
        # Get today's date and weekday name
        today = date_str or datetime.date.today().isoformat()
        dt = datetime.date.fromisoformat(today)
        weekday = dt.strftime("%A").lower()  # e.g., "monday"
        
        db = firestore_async.client()
        
        # Get all users from Firestore
        users = await db.collection("users").get()
        if not users:
            logger.info("No active users found in Firestore. Nightly learning task complete.")
            return
            
        logger.info(f"Retrieved {len(users)} users from Firestore. Processing dates={today}, weekday={weekday}")
        
        # Connect to the LangGraph Store
        async with AsyncPostgresStore.from_conn_string(settings.DB_URI) as store:
            await store.setup()
            
            for user_doc in users:
                user_id = user_doc.id
                logger.info(f"Processing user: {user_id}")
                
                # Fetch schedule doc for today
                schedule_ref = db.collection("schedules").document(user_id).collection("days").document(today)
                schedule_doc = await schedule_ref.get()
                
                if not schedule_doc.exists:
                    logger.info(f"No schedule found for user {user_id} on date {today}. Skipping.")
                    continue
                    
                schedule_data = schedule_doc.to_dict() or {}
                blocks = schedule_data.get("blocks", [])
                
                if not blocks:
                    logger.info(f"Schedule for user {user_id} on date {today} has no blocks. Skipping.")
                    continue
                    
                # Load user profile from LangGraph Store
                profile = await load_user_profile(store, user_id)
                if not profile:
                    profile = {}
                    
                skip_probabilities = profile.setdefault("skip_probabilities", {})
                updated_any = False
                
                for block in blocks:
                    completed = block.get("completed", False)
                    skipped = block.get("skipped", False)
                    
                    # User must have explicitly marked it done or skip
                    if not completed and not skipped:
                        continue
                        
                    block_type = block.get("type", "").lower()
                    title = block.get("title", "").lower()
                    
                    # Resolve block type (handle special "gym" title fallback)
                    if "gym" in title or block_type == "gym":
                        resolved_type = "gym"
                    else:
                        resolved_type = block_type
                        
                    pattern_key = f"{resolved_type}_{weekday}"
                    current_prob = skip_probabilities.get(pattern_key, 0.1)
                    
                    if skipped:
                        # Increment skip probability (e.g. skip gym_monday -> skip prob increases)
                        new_prob = min(current_prob + 0.1, 1.0)
                        skip_probabilities[pattern_key] = round(new_prob, 4)
                        logger.info(f"User {user_id} skipped {resolved_type} on {weekday}. Skip probability {pattern_key}: {current_prob} -> {new_prob:.2f}")
                        updated_any = True
                    elif completed:
                        # Decrement skip probability (positive reinforcement)
                        new_prob = max(current_prob - 0.02, 0.0)
                        skip_probabilities[pattern_key] = round(new_prob, 4)
                        logger.info(f"User {user_id} completed {resolved_type} on {weekday}. Skip probability {pattern_key}: {current_prob} -> {new_prob:.2f}")
                        updated_any = True
                
                if updated_any:
                    await save_user_profile(store, user_id, profile)
                    logger.info(f"Saved updated skip probabilities to store for user {user_id}: {skip_probabilities}")
                    
        logger.info("Nightly behavioral learning job completed successfully!")
    except Exception as e:
        logger.error(f"Error executing nightly learning job: {e}", exc_info=True)

def run_nightly_learning():
    """Synchronous wrapper for nightly learning job (run inside APScheduler thread)."""
    logger.info("Executing run_nightly_learning sync wrapper...")
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(nightly_learning_job())
        loop.close()
    except Exception as e:
        logger.error(f"Error in run_nightly_learning wrapper: {e}", exc_info=True)
