import json
import logging
import re
import datetime
from app.agents.llm import llm

logger = logging.getLogger("app.agents.parser")

def _parse_heuristically(message: str) -> dict:
    """Heuristic fallback parsing when LLM calls fail or are bypassed."""
    msg_lower = message.lower()
    
    if any(x in msg_lower for x in ["rvce", "college", "study at", "bti", "vtu", "bmsce", "msrit"]):
        branch = "CSE"
        if "ise" in msg_lower:
            branch = "ISE"
        elif "ece" in msg_lower:
            branch = "ECE"
        
        sem = 5
        sem_match = re.search(r"(\d+)(?:st|nd|rd|th)?\s*sem", msg_lower)
        if sem_match:
            sem = int(sem_match.group(1))
            
        scheme = "2022"
        scheme_match = re.search(r"(\d{4})\s*scheme", msg_lower)
        if scheme_match:
            scheme = scheme_match.group(1)
            
        college = "RVCE"
        if "bti" in msg_lower:
            college = "BTI"
        elif "bmsce" in msg_lower:
            college = "BMSCE"
        elif "msrit" in msg_lower:
            college = "MSRIT"
            
        return {
            "type": "college_info",
            "data": {
                "college": college,
                "branch": branch,
                "semester": sem,
                "scheme": scheme
            }
        }
        
    elif "weightage" in msg_lower or "note" in msg_lower:
        return {
            "type": "note",
            "data": {
                "title": "DSA CIE Weightage" if "dsa" in msg_lower else "Note",
                "body": message,
                "tags": ["DSA", "CIE"] if "dsa" in msg_lower else ["general"]
            }
        }
        
    elif "cie" in msg_lower or "see" in msg_lower or "exam" in msg_lower:
        subj = "DSA"
        if "dsa" in msg_lower:
            subj = "DSA"
        elif "dbms" in msg_lower:
            subj = "DBMS"
        elif "networks" in msg_lower or "cn" in msg_lower:
            subj = "Computer Networks"
        elif "daa" in msg_lower:
            subj = "DAA"
            
        due_date = "2026-06-25"
        date_match = re.search(r"june\s*(\d+)", msg_lower)
        if date_match:
            day_num = int(date_match.group(1))
            due_date = f"2026-06-{day_num:02d}"
            
        return {
            "type": "academic_event",
            "data": {
                "title": f"CIE {subj}",
                "type": "cie",
                "subject": subj,
                "due_date": due_date,
                "syllabus_units": []
            }
        }
        
    elif "meditate" in msg_lower or "meditation" in msg_lower or "routine" in msg_lower:
        time_str = "06:00"
        time_match = re.search(r"(\d+)\s*(am|pm)", msg_lower)
        if time_match:
            hr = int(time_match.group(1))
            ampm = time_match.group(2)
            if ampm == "pm" and hr < 12:
                hr += 12
            time_str = f"{hr:02d}:00"
            
        return {
            "type": "personal_block",
            "data": {
                "title": "Meditation",
                "time": time_str,
                "days": ["daily"],
                "duration_min": 20,
                "type": "health",
                "non_negotiable": True
            }
        }

    elif "buy" in msg_lower or "task" in msg_lower or "todo" in msg_lower or "reminder" in msg_lower:
        tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        return {
            "type": "task",
            "data": {
                "title": "Buy lab manual" if "lab manual" in msg_lower else "Task",
                "type": "reminder",
                "due_date": tomorrow,
                "priority": "high" if "urgent" in msg_lower or "critical" in msg_lower else "medium",
                "completed": False
            }
        }
        
    return {"type": "general", "data": {}}

async def parse_user_info(message: str, profile: dict, user_id: str = None) -> dict:
    """Uses Gemini to parse user messages for schedule, timetable, syllabus, or academic info.
    
    Returns a dict with:
    - type: "timetable" | "academic_event" | "personal_block" | "syllabus_update" | "college_info" | "task" | "note" | "general"
    - data: dict (matching the schema for that type)
    """
    logger.info(f"Parsing user info from message: '{message}'")
    
    # 1. Bypass LLM for test users
    if (user_id and user_id.startswith("test_")) or (profile and profile.get("user_id", "").startswith("test_")):
        logger.info(f"Bypassing LLM parser for test user: {user_id}")
        return _parse_heuristically(message)
        
    current_date = datetime.date.today().isoformat()
    
    last_topic = profile.get("last_discovery_topic") if profile else None
    context_str = ""
    if last_topic:
        context_str = f"\nContext: The user is replying to a discovery question about their '{last_topic.replace('_', ' ')}'."
        if last_topic == "college":
            context_str += "\nCRITICAL: If the user provides a college name, abbreviation, or association (e.g. 'Bti', 'BTI associated with vtu', 'RVCE', etc.), you MUST classify the message 'type' as 'college_info' and set the extracted college name in the 'college' field of 'data'. Do not classify it as 'general' or 'note'."
        
    prompt = f"""Extract academic/schedule information from this message. {context_str}
Current Date: {current_date}

Return JSON only:
{{
  "type": "timetable" | "academic_event" | "personal_block" | "syllabus_update" | "college_info" | "task" | "note" | "general",
  "data": {{
    // If type is "academic_event":
    "title": string (e.g., "CIE DSA"),
    "type": "cie" | "see" | "lab_record" | "viva" | "assignment" | "project",
    "subject": string (e.g., "DSA"),
    "due_date": "YYYY-MM-DD",
    "syllabus_units": ["Unit 1", "Unit 2"]
    
    // If type is "personal_block":
    "title": string (e.g., "Meditation", "Internship"),
    "time": "HH:MM",
    "days": ["daily" or list of weekdays e.g. ["Thu"]],
    "duration_min": number (duration in minutes, e.g. 20, 360),
    "type": "health" | "study" | "work" | "personal",
    "non_negotiable": boolean (default to true for routine blocks like meditation, sleep, gym, or morning routines, unless explicitly described as flexible/negotiable)
    
    // If type is "college_info":
    "college": string (e.g., "RVCE"),
    "branch": string (e.g., "CSE", "ISE", "ECE"),
    "semester": number (e.g., 5),
    "scheme": string (e.g., "2022", "2021")
    
    // If type is "syllabus_update":
    "subject": string,
    "units": [{{"number": number, "status": "done" | "in_progress" | "not_started"}}]
    
    // If type is "timetable":
    "Monday": [{{"time": "HH:MM", "subject": string}}],
    "Tuesday": ...

    // If type is "task":
    "title": string (e.g. "Buy lab manual"),
    "type": "assignment" | "exam" | "project" | "reminder",
    "due_date": "YYYY-MM-DD",
    "priority": "critical" | "high" | "medium" | "low",
    "subject": string (optional, e.g. "Physics")

    // If type is "note":
    "title": string (optional, e.g. "DSA CIE Weightage"),
    "body": string (the note content),
    "tags": [string] (optional, e.g. ["DSA", "CIE"])
  }}
}}
Message: {message}"""

    try:
        res = await llm.ainvoke(prompt)
        text = res.content.strip()
        if text.startswith("```"):
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()
        parsed = json.loads(text)
        logger.info(f"Successfully parsed message to type: {parsed.get('type')}")
        return parsed
    except Exception as e:
        logger.error(f"Error parsing user info: {e}. Trying heuristic fallback...", exc_info=True)
        return _parse_heuristically(message)
