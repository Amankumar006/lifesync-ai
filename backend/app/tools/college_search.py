from langchain_core.tools import tool
from app.tasks.college_scraper import find_college, scrape_college_calendar

@tool
async def search_college_info(college_name: str) -> dict:
    """Search for a student's college academic calendar including
    CIE dates, SEE dates, and holidays. Use when user mentions
    their college name for the first time."""
    college_key = await find_college(college_name)
    if not college_key:
        return {"status": "manual", "data": {}}
    return await scrape_college_calendar(college_key)

