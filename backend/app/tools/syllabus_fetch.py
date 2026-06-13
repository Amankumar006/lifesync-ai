from langchain_core.tools import tool
from app.tasks.college_scraper import fetch_vtu_syllabus


@tool
async def fetch_syllabus_for_student(branch: str, semester: int, scheme: str) -> dict:
    """Fetch the official VTU syllabus for a student's branch and semester.
    Use when user shares their branch and semester for the first time.
    Returns all subjects with units and topics."""
    result = await fetch_vtu_syllabus(branch, scheme, semester)
    if result["status"] == "found":
        subjects = result["data"]
        names = [s.get("subject", s.get("subject_code", "?")) for s in subjects]
        return {
            "status": "found",
            "count": len(subjects),
            "subjects": names,
            "message": f"Found {len(subjects)} subjects for {branch} semester {semester} ({scheme} scheme): {', '.join(names)}"
        }
    return {
        "status": result["status"],
        "message": f"Could not fetch syllabus for {branch} semester {semester} ({scheme} scheme). The student may need to upload it manually."
    }
