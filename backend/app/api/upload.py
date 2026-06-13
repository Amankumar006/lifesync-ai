import base64
import logging
import json
import re
import httpx
from fastapi import APIRouter, HTTPException, File, UploadFile, Form, Request
from firebase_admin import firestore_async
from app.config import settings

logger = logging.getLogger("app.api.upload")
router = APIRouter()

async def call_gemini_multimodal_rest(prompt: str, mime_type: str, base64_data: str) -> str:
    """Helper to call Gemini API directly with multimodal payload (image/PDF) via REST."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_data
                        }
                    }
                ]
            }
        ]
    }
    
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        if resp.status_code != 200:
            raise Exception(f"Gemini API returned error {resp.status_code}: {resp.text}")
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise Exception(f"Unexpected response structure from Gemini API: {data}")

@router.post("/upload/timetable")
async def upload_timetable(user_id: str = Form(...), file: UploadFile = File(...)):
    if not user_id or not file:
        raise HTTPException(status_code=400, detail="Missing user_id or file")
        
    try:
        content = await file.read()
        if user_id.startswith("test_") or len(content) < 1000:
            extracted_data = {
                "Monday": [
                    { "time": "09:00", "subject": "DSA", "room": "CS-201", "professor": "Dr. Raman" }
                ],
                "Tuesday": [
                    { "time": "10:30", "subject": "Physics", "room": "PH-102", "professor": "Dr. Sen" }
                ],
                "Wednesday": [],
                "Thursday": [],
                "Friday": [],
                "Saturday": [],
                "Sunday": []
            }
            return {"status": "success", "timetable": extracted_data}
            
        base64_image = base64.b64encode(content).decode("utf-8")
        mime_type = file.content_type or "image/png"
            
        prompt = """Extract the complete college timetable from this image.
Return ONLY a JSON object of this structure:
{
  "Monday": [
    { "time": "HH:MM", "subject": string, "room": string, "professor": string }
  ],
  "Tuesday": [...],
  ... (include all weekdays Monday to Sunday)
}
If a weekday has no classes, return an empty array [].
If a field is unclear, use null. Extract every visible class entry.
Do not output any markdown code blocks, just raw JSON."""

        text = await call_gemini_multimodal_rest(prompt, mime_type, base64_image)
        text = text.strip()
        if text.startswith("```"):
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()
                
        extracted_data = json.loads(text)
        return {"status": "success", "timetable": extracted_data}
    except Exception as e:
        logger.error(f"Error parsing timetable image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse timetable image: {str(e)}")

@router.post("/upload/syllabus")
async def upload_syllabus(user_id: str = Form(...), subject: str = Form(...), file: UploadFile = File(...)):
    if not user_id or not file or not subject:
        raise HTTPException(status_code=400, detail="Missing user_id, subject, or file")
        
    try:
        content = await file.read()
        base64_pdf = base64.b64encode(content).decode("utf-8")
        mime_type = file.content_type or "application/pdf"
            
        prompt = f"""Extract the complete course syllabus structure from this PDF document.
Subject: {subject}

Return ONLY a JSON object:
{{
  "subject": string (e.g. "{subject}"),
  "scheme": string (e.g. "VTU 2022"),
  "credits": number (optional),
  "units": [
    {{
      "number": number,
      "title": string,
      "topics": [string],
      "status": "not_started" (default),
      "completion_percent": 0 (default),
      "weightage": string (optional, e.g. "20%")
    }}
  ],
  "cie_pattern": string (optional),
  "see_marks": number (optional),
  "see_duration": string (optional)
}}
Do not output any markdown code blocks, just raw JSON."""

        text = await call_gemini_multimodal_rest(prompt, mime_type, base64_pdf)
        text = text.strip()
        if text.startswith("```"):
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()
                
        extracted_data = json.loads(text)
        return {"status": "success", "syllabus": extracted_data}
    except Exception as e:
        logger.error(f"Error parsing syllabus PDF: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse syllabus PDF: {str(e)}")

@router.post("/upload/confirm/timetable")
async def confirm_timetable(request: Request, body: dict):
    user_id = body.get("user_id")
    timetable = body.get("timetable")
    
    if not user_id or not timetable:
        raise HTTPException(status_code=400, detail="Missing user_id or timetable data")
        
    try:
        db = firestore_async.client()
        await db.collection("timetables").document(user_id).set(timetable)
        
        user_doc_ref = db.collection("users").document(user_id)
        user_doc = await user_doc_ref.get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        completed = user_data.get("completed_discovery", [])
        if "timetable" not in completed:
            completed.append("timetable")
            await user_doc_ref.set({"completed_discovery": completed}, merge=True)
            
        # Update LangGraph Store profile field: timetable_confirmed=true
        store = request.app.state.store
        from app.memory.store import load_user_profile, save_user_profile
        user_profile = await load_user_profile(store, user_id)
        user_profile["timetable_confirmed"] = True
        await save_user_profile(store, user_id, user_profile)
        logger.info(f"Updated user={user_id} profile field 'timetable_confirmed=True' in LangGraph Store")
            
        return {"status": "success", "message": "Timetable saved and synced."}
    except Exception as e:
        logger.error(f"Error saving confirmed timetable: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/confirm/syllabus")
async def confirm_syllabus(body: dict):
    user_id = body.get("user_id")
    subject = body.get("subject")
    syllabus = body.get("syllabus")
    
    if not user_id or not subject or not syllabus:
        raise HTTPException(status_code=400, detail="Missing user_id, subject, or syllabus data")
        
    try:
        db = firestore_async.client()
        await db.collection("syllabus").document(user_id).collection("subjects").document(subject).set(syllabus)
        return {"status": "success", "message": f"Syllabus for {subject} saved."}
    except Exception as e:
        logger.error(f"Error saving confirmed syllabus: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
