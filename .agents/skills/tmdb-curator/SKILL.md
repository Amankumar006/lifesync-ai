---
name: tmdb-curator
description: Handles all TMDB API integration for the Personal AI Agent's entertainment curation feature. Use when implementing or modifying the movie recommendation logic, updating the search_movies MCP tool, adding watch history tracking, filtering by genre or runtime, or building the weekend movie night suggestion flow. Also use when the user asks why movie recommendations are wrong or wants to add TV show support.
---

# TMDB Curator Skill

The Entertainment Agent calls TMDB to curate personalized movie recommendations for Saturday movie nights. The TMDB tool is called by the LangGraph agent — never called directly from the mobile app.

## API Key

Store as `TMDB_API_KEY` in backend `.env`. Get it from: https://www.themoviedb.org/settings/api (free account).

## Genre ID Map (TMDB's fixed IDs)

```python
GENRE_IDS = {
    "action": 28,      "adventure": 12,   "animation": 16,
    "comedy": 35,      "crime": 80,       "documentary": 99,
    "drama": 18,       "family": 10751,   "fantasy": 14,
    "history": 36,     "horror": 27,      "music": 10402,
    "mystery": 9648,   "romance": 10749,  "sci-fi": 878,
    "thriller": 53,    "war": 10752,      "western": 37,
}
```

## The MCP Tool — Full Implementation

```python
# backend/app/tools/tmdb.py
from langchain_core.tools import tool
import httpx
import os

TMDB_BASE = "https://api.themoviedb.org/3"

@tool
async def search_movies(
    genres: list[str],
    max_runtime: int = 150,
    exclude_ids: list[int] = [],
    min_rating: float = 7.0
) -> list[dict]:
    """Search TMDB for movie recommendations for the user's weekend movie night.
    Filters by the user's preferred genres, runtime limit, and excludes already-watched movies.
    Use this on Saturdays when building the entertainment block in the schedule.
    Returns top 5 movies sorted by rating with title, overview, runtime, and rating."""

    api_key = os.getenv("TMDB_API_KEY")
    genre_ids = ",".join([
        str(GENRE_IDS[g]) for g in genres if g in GENRE_IDS
    ])

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{TMDB_BASE}/discover/movie", params={
            "api_key": api_key,
            "with_genres": genre_ids,
            "with_runtime.lte": max_runtime,
            "with_runtime.gte": 60,          # no short films
            "vote_average.gte": min_rating,
            "vote_count.gte": 500,           # enough votes to be reliable
            "sort_by": "vote_average.desc",
            "include_adult": False,
            "page": 1,
            "language": "en-US",
        })
        r.raise_for_status()

    results = r.json().get("results", [])

    # Filter out already-watched movies
    filtered = [m for m in results if m["id"] not in exclude_ids]

    return [
        {
            "id": m["id"],
            "title": m["title"],
            "overview": m["overview"][:200] + "...",
            "rating": round(m["vote_average"], 1),
            "release_year": m["release_date"][:4] if m.get("release_date") else "?",
            "genre_ids": m["genre_ids"],
            "poster_path": f"https://image.tmdb.org/t/p/w300{m['poster_path']}" if m.get("poster_path") else None,
        }
        for m in filtered[:5]
    ]
```

## Watch History — Firestore Storage

Store watched movie IDs in the user's Firestore doc so the agent can exclude them:

```typescript
// mobile — after user marks movie as watched
await firestore()
  .collection("users")
  .doc(uid)
  .update({
    watched_movie_ids: firestore.FieldValue.arrayUnion(movieId)
  });
```

```python
# backend — read in the Entertainment Agent node before calling search_movies
doc = await db.collection("users").document(user_id).get()
watched_ids = doc.to_dict().get("watched_movie_ids", [])
movies = await search_movies.ainvoke({
    "genres": user_profile["movie_genres"],
    "max_runtime": user_profile.get("movie_max_runtime", 150),
    "exclude_ids": watched_ids,
})
```

## When to Trigger Movie Curation

Only call TMDB on these conditions (all must be true):
1. `current_mode == "weekend"` OR today is Saturday
2. Time is after 5 PM (no point suggesting movie at 9 AM)
3. User hasn't already seen a movie suggestion today (check Firestore)

## Fallback — If TMDB is Unavailable

```python
FALLBACK_MOVIES = [
    {"title": "Dune: Part Two", "rating": 8.5, "runtime": 166},
    {"title": "Oppenheimer", "rating": 8.3, "runtime": 180},
    {"title": "The Batman", "rating": 7.8, "runtime": 176},
]
# Use as fallback only — always try TMDB first
```

## Mobile: Movie Card Component

```typescript
// The Entertainment Agent response includes movie data
// Display it as a card in the chat:
{
  movies.map(movie => (
    <View key={movie.id} style={styles.movieCard}>
      {movie.poster_path && <Image source={{uri: movie.poster_path}} style={styles.poster} />}
      <View style={styles.info}>
        <Text style={styles.title}>{movie.title} ({movie.release_year})</Text>
        <Text style={styles.rating}>⭐ {movie.rating}/10</Text>
        <Text style={styles.overview}>{movie.overview}</Text>
        <TouchableOpacity onPress={() => markWatched(movie.id)}>
          <Text>Mark as watched</Text>
        </TouchableOpacity>
      </View>
    </View>
  ))
}
```
