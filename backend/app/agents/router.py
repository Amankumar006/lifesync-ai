import logging
from app.agents.state import AgentState

logger = logging.getLogger("app.agents.router")

def route_intent(state: AgentState) -> str:
    """Routes based on the classified intent of the user message."""
    intent = state.get("intent", "general")
    logger.info(f"Router: route_intent -> {intent}")
    
    if intent == "general":
        return "general_chat"
    if intent == "entertainment_rec":
        return "entertainment_node"
    if intent == "location_trigger":
        return "location_trigger_node"
    if intent == "info_provided":
        return "save_user_info_node"
    return "hydrate_context"

def route_after_context(state: AgentState) -> str:
    """Routes to clarification or schedule building after context hydration."""
    needs_clarification = state.get("needs_clarification", False)
    logger.info(f"Router: route_after_context -> needs_clarification={needs_clarification}")
    
    if needs_clarification:
        return "ask_clarification"
    return "build_schedule"

def route_after_proposal(state: AgentState) -> str:
    """Routes based on human feedback after the schedule proposal interrupt."""
    feedback = state.get("human_feedback") or {}
    approved = feedback.get("approved", False)
    logger.info(f"Router: route_after_proposal -> approved={approved}")
    
    if approved:
        return "commit_schedule"
    return "build_schedule"  # Rebuild/reschedule step

def route_after_clarification(state: AgentState) -> str:
    """Routes to propose_schedule if intent is schedule_build, otherwise to END."""
    intent = state.get("intent", "general")
    logger.info(f"Router: route_after_clarification -> intent={intent}")
    
    if intent == "schedule_build":
        return "propose_schedule"
    return "END"

