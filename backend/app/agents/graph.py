from langgraph.graph import StateGraph, START, END
from app.agents.state import AgentState
from app.agents.nodes import (
    classify_intent,
    hydrate_context,
    build_schedule,
    propose_schedule,
    commit_schedule,
    general_chat,
    entertainment_node,
    location_trigger_node,
    save_user_info_node,
    check_clarification_node
)
from app.agents.router import (
    route_intent,
    route_after_proposal,
    route_after_clarification
)
from app.tools.college_search import search_college_info
from app.tools.syllabus_fetch import fetch_syllabus_for_student

AGENT_TOOLS = [
    search_college_info,
    fetch_syllabus_for_student,
]


def create_graph(store, checkpointer):
    """Creates and compiles the LangGraph v1 multi-agent state graph."""
    builder = StateGraph(AgentState)
    
    # Add the nodes
    builder.add_node("classify_intent", classify_intent)
    builder.add_node("hydrate_context", hydrate_context)
    builder.add_node("build_schedule", build_schedule)
    builder.add_node("propose_schedule", propose_schedule)
    builder.add_node("commit_schedule", commit_schedule)
    builder.add_node("general_chat", general_chat)
    builder.add_node("entertainment_node", entertainment_node)
    builder.add_node("location_trigger_node", location_trigger_node)
    builder.add_node("save_user_info_node", save_user_info_node)
    builder.add_node("check_clarification_node", check_clarification_node)
    
    # Wire START to the first node
    builder.add_edge(START, "classify_intent")
    
    # Route intent to context hydration or general chat
    builder.add_conditional_edges(
        "classify_intent",
        route_intent,
        {
            "hydrate_context": "hydrate_context",
            "general_chat": "general_chat",
            "entertainment_node": "entertainment_node",
            "location_trigger_node": "location_trigger_node",
            "save_user_info_node": "save_user_info_node"
        }
    )
    
    # Route context hydration directly to scheduling
    builder.add_edge("hydrate_context", "build_schedule")
    
    # All responding nodes flow into the check_clarification_node
    builder.add_edge("general_chat", "check_clarification_node")
    builder.add_edge("entertainment_node", "check_clarification_node")
    builder.add_edge("location_trigger_node", "check_clarification_node")
    builder.add_edge("save_user_info_node", "check_clarification_node")
    builder.add_edge("build_schedule", "check_clarification_node")
    builder.add_edge("commit_schedule", "check_clarification_node")
    
    # Route after clarification check (go to propose_schedule for schedule building, otherwise END)
    builder.add_conditional_edges(
        "check_clarification_node",
        route_after_clarification,
        {
            "propose_schedule": "propose_schedule",
            "END": END
        }
    )
    
    # Route proposal outcome to commit or rebuild (which goes back to build_schedule)
    builder.add_conditional_edges(
        "propose_schedule",
        route_after_proposal,
        {
            "commit_schedule": "commit_schedule",
            "build_schedule": "build_schedule"
        }
    )
    
    # Compile graph with session memory, cross-session store, and HITL interrupt
    return builder.compile(
        checkpointer=checkpointer,
        store=store,
        interrupt_before=["propose_schedule"]
    )

