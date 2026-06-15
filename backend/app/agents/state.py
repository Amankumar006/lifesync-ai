from typing import Optional, List, Dict, Any
from langgraph.graph import MessagesState

class AgentState(MessagesState):
    user_id: str
    user_profile: Dict[str, Any]
    intent: Optional[str]          # "schedule_build" | "schedule_edit" | "entertainment_rec" | "reminder_set" | "general"
    intent_scope: Optional[str]    # "day" | "week"
    intent_date: Optional[str]     # "YYYY-MM-DD"
    timetable_today: Optional[Dict[str, Any]]
    task_queue: List[Dict[str, Any]]
    proposed_schedule: Optional[List[Dict[str, Any]]]
    approved_schedule: Optional[List[Dict[str, Any]]]
    needs_clarification: bool
    clarification_question: Optional[str]
    human_feedback: Optional[Dict[str, Any]]
    academic_events: List[Dict[str, Any]]
    personal_fixed_blocks: List[Dict[str, Any]]
    syllabus_status: Dict[str, Any]
    college_info: Optional[Dict[str, Any]]
    calendar_status: str
    asked_discovery_this_session: Optional[bool]
    academic_calendar: Optional[Dict[str, Any]]
    pending_tasks: List[Dict[str, Any]]
    recent_notes: List[Dict[str, Any]]



