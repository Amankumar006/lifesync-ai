"""Integration test for Tasks & Notes scheduling context."""
import asyncio
import sys
import datetime
import httpx

sys.path.append("/Users/amankumar/Aman/Agent planner/backend")

from firebase_admin import firestore_async
from app.api.auth import firebase_initialized
from langgraph.store.postgres.aio import AsyncPostgresStore
from app.config import settings

async def clean_user_data(user_id):
    db = firestore_async.client()
    
    # Delete top-level documents
    await db.collection("users").document(user_id).delete()
    await db.collection("personal_schedule").document(user_id).delete()
    await db.collection("timetables").document(user_id).delete()
    
    # Delete subcollections
    for col in ["days"]:
        docs = await db.collection("schedules").document(user_id).collection(col).get()
        for doc in docs:
            await doc.reference.delete()
        await db.collection("schedules").document(user_id).delete()
        
    for col in ["items"]:
        docs = await db.collection("tasks").document(user_id).collection(col).get()
        for doc in docs:
            await doc.reference.delete()
        await db.collection("tasks").document(user_id).delete()
        
    for col in ["items"]:
        docs = await db.collection("notes").document(user_id).collection(col).get()
        for doc in docs:
            await doc.reference.delete()
        await db.collection("notes").document(user_id).delete()

    # Clear LangGraph Store
    async with AsyncPostgresStore.from_conn_string(settings.DB_URI) as store:
        namespace = ("users", user_id)
        await store.aput(namespace, "profile", {})

async def send_chat_message(client, user_id, thread_id, message):
    payload = {
        "user_id": user_id,
        "thread_id": thread_id,
        "message": message
    }
    assistant_text = ""
    proposed_schedule = None
    async with client.stream("POST", "http://localhost:8000/api/chat", json=payload) as response:
        assert response.status_code == 200
        async for line in response.aiter_lines():
            if line.strip():
                if line.startswith("data: "):
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        continue
                    try:
                        import json
                        parsed = json.loads(data_str)
                        if parsed.get("type") == "text":
                            assistant_text += parsed.get("text", "")
                        elif parsed.get("type") == "proposed_schedule":
                            proposed_schedule = parsed.get("schedule")
                    except Exception:
                        pass
    return assistant_text, proposed_schedule

async def main():
    user_id = "test_user_tasks_notes"
    thread_id = "thread_tasks_notes"
    
    print("=== Tasks & Notes Context Scheduling Integration Test ===")
    print("1. Cleaning up old database entries...")
    await clean_user_data(user_id)
    print("✓ Cleanup finished.")
    
    db = firestore_async.client()
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # Step 2: Add Task "Buy lab manual due tomorrow"
        print("\n2. Sending task message: 'Buy lab manual due tomorrow'...")
        resp_task, _ = await send_chat_message(client, user_id, thread_id, "Buy lab manual due tomorrow")
        print(f"Agent response: {resp_task}")
        
        # Verify in Firestore
        tasks = await db.collection("tasks").document(user_id).collection("items").get()
        assert len(tasks) > 0, "No tasks found in Firestore!"
        lab_task = next((t.to_dict() for t in tasks if "lab manual" in t.to_dict().get("title", "").lower()), None)
        assert lab_task is not None, "Lab manual task was not created!"
        print(f"✓ Confirmed: Task created in Firestore: {lab_task}")
        
        # Step 3: Add Note "DSA Unit 4 has 40% CIE weightage"
        print("\n3. Sending note message: 'DSA Unit 4 has 40% CIE weightage'...")
        resp_note, _ = await send_chat_message(client, user_id, thread_id, "DSA Unit 4 has 40% CIE weightage")
        print(f"Agent response: {resp_note}")
        
        # Verify in Firestore
        notes = await db.collection("notes").document(user_id).collection("items").get()
        assert len(notes) > 0, "No notes found in Firestore!"
        dsa_note = next((n.to_dict() for n in notes if "dsa" in n.to_dict().get("body", "").lower()), None)
        assert dsa_note is not None, "DSA note was not created!"
        assert dsa_note.get("ai_summary") != "", "Note was not summarized by LLM!"
        print(f"✓ Confirmed: Note created and summarized in Firestore: {dsa_note}")
        
        # Step 4: Generate schedule and verify tasks & notes impact
        print("\n4. Requesting schedule generation...")
        test_date = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        msg_schedule = f"schedule my day for {test_date}"
        _, schedule = await send_chat_message(client, user_id, thread_id, msg_schedule)
        
        assert schedule is not None, "Failed to get proposed schedule!"
        print("\n=== Received Proposed Schedule ===")
        for b in schedule:
            print(f"⏰ {b['time']} ({b['duration_min']} min) - {b['title']} [{b['type']}] - Notes: {b.get('notes', '')}")
            
        # Verify that the schedule has a block or a task completion for "Buy lab manual"
        lab_block = next((b for b in schedule if "lab manual" in b.get("title", "").lower() or "lab manual" in b.get("notes", "").lower()), None)
        assert lab_block is not None, "Did not schedule task 'Buy lab manual'!"
        
        # Verify that the schedule has a study/prep block for DSA (influenced by Unit 4 weightage note)
        dsa_block = next((b for b in schedule if "dsa" in b.get("title", "").lower() or "dsa" in b.get("notes", "").lower()), None)
        assert dsa_block is not None, "Did not schedule study block for DSA!"
        
        print("\n✓ Verification successful: 'Buy lab manual' and 'DSA study' blocks are both scheduled!")
        
    print("\n=== TASKS & NOTES CONTEXT TEST SUCCESSFUL! ===")

if __name__ == "__main__":
    asyncio.run(main())
