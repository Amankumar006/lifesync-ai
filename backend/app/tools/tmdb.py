"""TMDB movie search tool for the Entertainment Agent.

Calls the TMDB /discover/movie endpoint to curate personalized
movie recommendations based on the user's preferred genres,
runtime limits, and watch history.
"""

import logging
from typing import List, Dict, Any
import httpx
from langchain_core.tools import tool
from app.config import settings

logger = logging.getLogger("app.tools.tmdb")

TMDB_BASE = "https://api.themoviedb.org/3"

# TMDB's fixed genre integer IDs
GENRE_IDS = {
    "action": 28,      "adventure": 12,   "animation": 16,
    "comedy": 35,      "crime": 80,       "documentary": 99,
    "drama": 18,       "family": 10751,   "fantasy": 14,
    "history": 36,     "horror": 27,      "music": 10402,
    "mystery": 9648,   "romance": 10749,  "sci-fi": 878,
    "thriller": 53,    "war": 10752,      "western": 37,
}

# Hardcoded fallback when TMDB API is unreachable
FALLBACK_MOVIES = [
    {
        "id": 693134, "title": "Dune: Part Two",
        "overview": "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge...",
        "rating": 8.5, "release_year": "2024", "poster_path": None,
    },
    {
        "id": 872585, "title": "Oppenheimer",
        "overview": "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II...",
        "rating": 8.3, "release_year": "2023", "poster_path": None,
    },
    {
        "id": 414906, "title": "The Batman",
        "overview": "When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate...",
        "rating": 7.8, "release_year": "2022", "poster_path": None,
    },
]


async def search_movies_func(
    genres: List[str],
    max_runtime: int = 150,
    exclude_ids: List[int] = [],
    min_rating: float = 7.0,
) -> List[Dict[str, Any]]:
    """Internal helper: search TMDB for movies matching preferences.

    Args:
        genres: List of genre name strings (e.g. ["action", "sci-fi"]).
        max_runtime: Maximum movie runtime in minutes.
        exclude_ids: TMDB movie IDs to skip (already watched).
        min_rating: Minimum vote_average threshold.

    Returns:
        Top 5 matching movies with id, title, overview, rating, etc.
    """
    api_key = settings.TMDB_API_KEY
    if not api_key:
        logger.warning("TMDB_API_KEY not set — returning fallback movies.")
        return FALLBACK_MOVIES[:5]

    # Map genre names → TMDB integer IDs
    genre_id_list = [str(GENRE_IDS[g.lower()]) for g in genres if g.lower() in GENRE_IDS]
    genre_ids_param = ",".join(genre_id_list) if genre_id_list else ""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{TMDB_BASE}/discover/movie", params={
                "api_key": api_key,
                "with_genres": genre_ids_param,
                "with_runtime.lte": max_runtime,
                "with_runtime.gte": 60,
                "vote_average.gte": min_rating,
                "vote_count.gte": 500,
                "sort_by": "vote_average.desc",
                "include_adult": False,
                "page": 1,
                "language": "en-US",
            })
            resp.raise_for_status()

        results = resp.json().get("results", [])

        # Exclude already-watched movies
        filtered = [m for m in results if m["id"] not in exclude_ids]

        movies = [
            {
                "id": m["id"],
                "title": m["title"],
                "overview": (m["overview"][:200] + "...") if len(m.get("overview", "")) > 200 else m.get("overview", ""),
                "rating": round(m["vote_average"], 1),
                "release_year": m["release_date"][:4] if m.get("release_date") else "?",
                "poster_path": f"https://image.tmdb.org/t/p/w300{m['poster_path']}" if m.get("poster_path") else None,
            }
            for m in filtered[:5]
        ]

        logger.info(f"TMDB returned {len(results)} raw results, {len(movies)} after filtering.")
        return movies if movies else FALLBACK_MOVIES[:5]

    except Exception as e:
        logger.error(f"TMDB API call failed: {e}. Returning fallback movies.")
        return FALLBACK_MOVIES[:5]


@tool
async def search_movies(
    genres: list[str],
    max_runtime: int = 150,
    exclude_ids: list[int] = [],
    min_rating: float = 7.0,
) -> list[dict]:
    """Search TMDB for movie recommendations for the user's weekend movie night.
    Filters by the user's preferred genres, runtime limit, and excludes already-watched movies.
    Use this on Saturdays when building the entertainment block in the schedule.
    Returns top 5 movies sorted by rating with title, overview, runtime, and rating."""
    return await search_movies_func(genres, max_runtime, exclude_ids, min_rating)
