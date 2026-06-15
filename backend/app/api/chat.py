import json
import logging
from fastapi import APIRouter, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.api.auth import get_current_user

logger = logging.getLogger("app.api.chat")
router = APIRouter()

@router.post("/chat")
async def chat_endpoint(request: Request, body: dict, background_tasks: BackgroundTasks):
    graph = request.app.state.graph
    user_id = body.get("user_id", "mock_user_123")
    thread_id = body.get("thread_id", "default_thread")
    message = body.get("message")
    human_feedback = body.get("human_feedback")

    config = {"configurable": {"thread_id": thread_id}, "background_tasks": background_tasks}

    
    # Check if there is an active interrupt (graph is paused)
    state = await graph.aget_state(config)
    
    if human_feedback is not None:
        logger.info(f"Resuming graph '{thread_id}' with human feedback: {human_feedback}")
        # Update state with human feedback and resume graph from interrupt
        await graph.aupdate_state(config, {"human_feedback": human_feedback}, as_node="propose_schedule")
        inputs = None  # Passing None resumes the graph
    else:
        logger.info(f"Starting new graph run for thread '{thread_id}' with message: {message}")
        inputs = {
            "messages": [{"role": "user", "content": message}] if message else [],
            "user_id": user_id,
            "user_profile": {},
            "task_queue": [],
            "pending_tasks": [],
            "recent_notes": [],
            "needs_clarification": False,
            "proposed_schedule": None,
            "approved_schedule": None,
            "human_feedback": None,
            "asked_discovery_this_session": False,
            "academic_calendar": None
        }

    async def event_stream():
        try:
            # Stream updates from LangGraph to capture messages returned by custom nodes
            async for chunk in graph.astream(inputs, config, stream_mode="updates"):
                for node_name, node_output in chunk.items():
                    if node_output and isinstance(node_output, dict) and "messages" in node_output:
                        for msg in node_output["messages"]:
                            content = msg.content if hasattr(msg, "content") else (msg.get("content", "") if isinstance(msg, dict) else str(msg))
                            if content:
                                payload = json.dumps({"type": "text", "text": content})
                                yield f"data: {payload}\n\n"
                    
            # After stream completes, check state for proposed/approved schedule and yield them
            final_state = await graph.aget_state(config)
            values = final_state.values or {}
            
            if "proposed_schedule" in values and values["proposed_schedule"]:
                payload = json.dumps({
                    "type": "proposed_schedule",
                    "schedule": values["proposed_schedule"]
                })
                yield f"data: {payload}\n\n"
                
            if "approved_schedule" in values and values["approved_schedule"]:
                payload = json.dumps({
                    "type": "approved_schedule",
                    "schedule": values["approved_schedule"]
                })
                yield f"data: {payload}\n\n"
                
        except Exception as e:
            logger.error(f"Error in event_stream: {e}", exc_info=True)
            payload = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {payload}\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/schedule/approve")
async def approve_schedule(request: Request, body: dict):
    from langgraph.types import Command
    graph = request.app.state.graph
    thread_id = body.get("thread_id")
    feedback = body.get("feedback")  # {"approved": true, "edits": []} or {"approved": false, "edits": [...]}

    if not thread_id:
        return {"status": "error", "message": "thread_id is required"}

    config = {"configurable": {"thread_id": thread_id}}
    
    logger.info(f"Approve endpoint called for thread '{thread_id}' with feedback: {feedback}")

    try:
        # Update the state first so that the router/nodes can read it
        await graph.aupdate_state(config, {"human_feedback": feedback}, as_node="propose_schedule")

        # Resume the graph from the interrupt using Command(resume=feedback)
        await graph.ainvoke(Command(resume=feedback), config)

        # Get final state to check the committed schedule
        final_state = await graph.aget_state(config)
        values = final_state.values or {}

        return {
            "status": "success",
            "proposed_schedule": values.get("proposed_schedule"),
            "approved_schedule": values.get("approved_schedule")
        }
    except Exception as e:
        logger.error(f"Error in approve_schedule: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

# Note summarizer route
from pydantic import BaseModel

class SummarizeNoteRequest(BaseModel):
    note_content: str
    user_id: str

@router.post("/notes/summarize")
async def summarize_note_endpoint(req: SummarizeNoteRequest):
    from app.agents.nodes import summarize_note_content
    logger.info(f"Summarizing note for user {req.user_id} via API")
    try:
        res = await summarize_note_content(req.note_content)
        try:
            from app.api.upload import link_note_to_syllabus
            linked = await link_note_to_syllabus(
                user_id=req.user_id,
                note_subject=res.get("subject", "General"),
                note_tags=res.get("tags", []),
                note_content=req.note_content
            )
            if linked:
                res["linked_syllabus"] = linked
        except Exception as ex:
            logger.error(f"Syllabus linker failed in chat summarize: {ex}")
        return res
    except Exception as e:
        logger.error(f"Error in summarize_note_endpoint: {e}", exc_info=True)
        return {
            "summary": req.note_content[:60] + "..." if len(req.note_content) > 60 else req.note_content,
            "subject": "General",
            "tags": ["general"]
        }
