import logging
from typing import Optional

logger = logging.getLogger("app.agents.discovery")

def identify_missing_slots(
    profile: dict, 
    timetable: dict, 
    academic_events: list
) -> Optional[dict]:
    """Identifies the highest priority missing slot / knowledge gap for the student.
    
    Priority order:
    1. No timetable -> ask for timetable
    2. No college -> ask for college
    3. No academic events -> ask about upcoming CIEs/assignments
    4. No personal fixed blocks -> ask about non-negotiables
    
    Returns a dict with {"topic": str, "question": str} or None.
    """
    if not profile:
        profile = {}
    if not timetable:
        timetable = {}
    if not academic_events:
        academic_events = []
        
    completed = profile.get("completed_discovery", [])
    logger.info(f"Checking missing slots. Completed discovery topics: {completed}")
    
    # 1. Timetable
    if not timetable and "timetable" not in completed:
        return {
            "topic": "timetable", 
            "question": "Can you upload a photo of your class timetable? I'll read it automatically."
        }
    
    # 2. College
    if not profile.get("college") and "college" not in completed:
        return {
            "topic": "college",
            "question": "Which college are you in? I'll look up your academic calendar automatically."
        }
    
    # 3. Academic Events
    if not academic_events and "academic_events" not in completed:
        return {
            "topic": "academic_events",
            "question": "Any CIEs or assignments coming up this week I should know about?"
        }
    
    # 4. Personal Blocks
    if not profile.get("personal_blocks") and "personal_blocks" not in completed:
        return {
            "topic": "personal_blocks",
            "question": "Any fixed things you do every day that I should never schedule over? Like morning workout, prayer, family dinner?"
        }
    
    return None  # Profile complete
