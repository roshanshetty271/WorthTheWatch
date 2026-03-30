"""
Worth the Watch? — Movies Router
Endpoints for listing and retrieving movies with reviews.
"""

import math
import random as _random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, desc, and_, or_, cast, String

from typing import Optional, List
from sqlalchemy.orm import joinedload, Session
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Movie, Review
from app.schemas import MovieResponse, ReviewResponse, MovieWithReview, PaginatedMovies
from app.services.tmdb import tmdb_service
from app.services.safety import is_safe_content
from app.middleware.rate_limit import check_rate_limit, check_rate_limit_hybrid

router = APIRouter()

# ─── Mood → Tag + Genre Mapping ───────────────────────────────────────
# PRIMARY: LLM-generated review tags (most accurate for mood)
# SECONDARY: TMDB genres with EXCLUSION rules (prevents Breaking Bad in "emotional")
#
# Tags are assigned by the LLM during review generation and are mood-specific.
# Genres alone are too broad — "Drama" covers everything from The Notebook to Breaking Bad.
# Exclusion genres prevent wrong-mood results from leaking in.

MOOD_CONFIG = {
    "tired": {
        # Easy, light, comfort watches — unwind without thinking
        "tags": ["Feel-Good", "Whimsical", "Family-Friendly", "Funny", "Light", "Comforting", "Wholesome"],
        "include_genres": ["Comedy", "Romance", "Animation", "Family", "Music"],
        "exclude_genres": ["Horror", "Thriller", "Crime", "War"],
    },
    "pumped": {
        # Adrenaline, high-octane — John Wick, Mad Max, Top Gun
        "tags": ["Action-Packed", "Gritty", "Fast-Paced", "Violent", "Intense", "Thrilling"],
        "include_genres": ["Action", "War"],
        "exclude_genres": ["Romance", "Family", "Animation", "Music"],
    },
    "emotional": {
        # Tearjerkers, deep feelings — Green Mile, Schindler's List, Grave of the Fireflies
        "tags": ["Emotional", "Heartbreaking", "Tearjerker", "Moving", "Touching", "Heartfelt", "Devastating"],
        "include_genres": ["Drama", "Romance"],
        "exclude_genres": ["Action", "Thriller", "Crime", "Horror", "Science Fiction"],
    },
    "cerebral": {
        # Mind-benders, make you think — Inception, Memento, Arrival, Interstellar
        "tags": ["Mind-Bending", "Cerebral", "Slow-Burn", "Thought-Provoking", "Complex", "Philosophical"],
        "include_genres": ["Science Fiction", "Mystery"],
        "exclude_genres": ["Comedy", "Family", "Animation", "Romance"],
    },
    "fun": {
        # Popcorn entertainment — Jurassic Park, Guardians, Spider-Verse
        "tags": ["Funny", "Feel-Good", "Whimsical", "Entertaining", "Adventure", "Escapist"],
        "include_genres": ["Comedy", "Animation", "Adventure", "Fantasy"],
        "exclude_genres": ["Horror", "War", "Crime"],
    },
}


def _build_mood_filter(mood: str):
    """
    Build SQLAlchemy filter for mood-based browsing.
    
    Strategy: Tags first (most accurate), genres second (with exclusions).
    
    A movie matches a mood if:
      - It has ANY matching tag (LLM assigned, most reliable), OR
      - It has an included genre AND does NOT have any excluded genre
    
    This prevents "Breaking Bad" from showing in "Emotional" (it's Drama 
    but also Crime+Thriller which are excluded) while keeping "The Green Mile" 
    (Drama with no excluded genres).
    """
    config = MOOD_CONFIG.get(mood)
    if not config:
        return None

    conditions = []

    # 1. TAG MATCHING (primary — most accurate mood signal)
    for tag in config["tags"]:
        conditions.append(
            cast(Review.tags, String).ilike(f'%{tag}%')
        )

    # 2. GENRE MATCHING with exclusions (secondary — broader but filtered)
    genre_includes = []
    for genre in config["include_genres"]:
        genre_includes.append(
            cast(Movie.genres, String).ilike(f'%{genre}%')
        )

    genre_excludes = []
    for genre in config["exclude_genres"]:
        genre_excludes.append(
            cast(Movie.genres, String).ilike(f'%{genre}%')
        )

    # Movie has at least one included genre AND none of the excluded genres
    if genre_includes:
        has_included = or_(*genre_includes)
        if genre_excludes:
            has_excluded = or_(*genre_excludes)
            # Include genre match BUT NOT excluded genre
            genre_condition = and_(has_included, ~has_excluded)
        else:
            genre_condition = has_included
        conditions.append(genre_condition)

    return or_(*conditions)


@router.get("", response_model=PaginatedMovies)
async def list_movies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(
        None,
        pattern="^(trending|latest|worth-it|skip-these|mixed-bag|hidden-gems|movies|tv-shows|mood-tired|mood-pumped|mood-emotional|mood-cerebral|mood-fun)$"
    ),
    sort: Optional[str] = Query(None, pattern="^(latest|popular|verdict|release_date)$"),
    verdict: Optional[str] = Query(None, pattern="^(WORTH IT|NOT WORTH IT|MIXED BAG)$"),
    media_type: Optional[str] = Query(None, pattern="^(movie|tv)$"),
    shuffle: bool = Query(False, description="Randomize results (for mood shuffle button)"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Movie).options(joinedload(Movie.review))
    count_query = select(func.count()).select_from(Movie)

    if category:
        if category == "trending":
            query = query.order_by(desc(Movie.tmdb_popularity))

        elif category == "latest":
            query = query.join(Review).order_by(desc(Review.generated_at))
            count_query = count_query.join(Review)

        elif category == "worth-it":
            query = query.join(Review).where(
                Review.verdict == "WORTH IT"
            ).order_by(func.random())
            count_query = count_query.join(Review).where(Review.verdict == "WORTH IT")

        elif category == "skip-these":
            query = query.join(Review).where(Review.verdict == "NOT WORTH IT").order_by(desc(Review.generated_at))
            count_query = count_query.join(Review).where(Review.verdict == "NOT WORTH IT")

        elif category == "mixed-bag":
            query = query.join(Review).where(Review.verdict == "MIXED BAG").order_by(desc(Review.generated_at))
            count_query = count_query.join(Review).where(Review.verdict == "MIXED BAG")

        elif category == "hidden-gems":
            query = query.join(Review).where(
                and_(
                    Review.verdict == "WORTH IT",
                    Movie.tmdb_popularity < 20,
                )
            ).order_by(func.random())
            count_query = count_query.join(Review).where(
                and_(
                    Review.verdict == "WORTH IT",
                    Movie.tmdb_popularity < 20,
                )
            )

        elif category == "movies":
            query = query.where(Movie.media_type == "movie").order_by(desc(Movie.release_date))
            count_query = count_query.where(Movie.media_type == "movie")

        elif category == "tv-shows":
            query = query.join(Review, isouter=True).where(
                and_(
                    Movie.media_type == "tv",
                    or_(Review.verdict != "NOT WORTH IT", Review.verdict.is_(None))
                )
            ).order_by(desc(Movie.release_date))
            count_query = count_query.join(Review, isouter=True).where(
                and_(
                    Movie.media_type == "tv",
                    or_(Review.verdict != "NOT WORTH IT", Review.verdict.is_(None))
                )
            )

        # ─── Mood Categories (Curated Lists) ─────────────────────────
        elif category.startswith("mood-"):
            from app.services.curated_moods import CURATED_MOODS

            mood = category.replace("mood-", "")
            curated_ids = CURATED_MOODS.get(mood, [])

            if not curated_ids:
                # Unknown mood — fall back to all reviewed
                query = query.join(Review).where(
                    Review.verdict == "WORTH IT"
                ).order_by(desc(Movie.tmdb_popularity))
                count_query = count_query.join(Review).where(
                    Review.verdict == "WORTH IT"
                )
            else:
                # Shuffle: randomize the curated order
                if shuffle:
                    curated_ids = list(curated_ids)
                    _random.shuffle(curated_ids)

                # Get movies from our DB matching curated TMDB IDs
                # Include all — reviewed and unreviewed — with reviews loaded
                query = query.where(
                    Movie.tmdb_id.in_(curated_ids)
                )
                count_query = count_query.where(
                    Movie.tmdb_id.in_(curated_ids)
                )

                # We need custom ordering to match the curated list order
                # SQLAlchemy doesn't support CASE ordering easily, so we'll
                # fetch all and sort in Python after the query executes
                # For now, use popularity as proxy (most iconic = most popular)
                if not shuffle:
                    query = query.order_by(desc(Movie.tmdb_popularity))

    else:
        if media_type:
            query = query.where(Movie.media_type == media_type)
            count_query = count_query.where(Movie.media_type == media_type)
        if verdict:
            query = query.join(Review).where(Review.verdict == verdict)
            count_query = count_query.join(Review).where(Review.verdict == verdict)

        sort = sort or "latest"
        if sort == "latest":
            if not verdict:
                query = query.join(Review, isouter=True)
            query = query.order_by(desc(Review.generated_at).nulls_last(), desc(Movie.release_date))
        elif sort == "release_date":
            query = query.order_by(desc(Movie.release_date))
        elif sort == "popular":
            query = query.order_by(desc(Movie.tmdb_popularity))
        elif sort == "verdict" and not verdict:
            query = query.join(Review, isouter=True).order_by(desc(Review.generated_at))
        elif sort == "verdict" and verdict:
            query = query.order_by(desc(Review.generated_at))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    movies = result.unique().scalars().all()

    return PaginatedMovies(
        movies=[_format_movie_with_review(m) for m in movies],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total > 0 else 0,
    )


@router.get("/random", response_model=MovieWithReview)
async def get_random_movie_with_review(
    exclude: Optional[int] = Query(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Prefers hidden gems, falls back to any WORTH IT movie."""
    await check_rate_limit_hybrid(request, limit_type="roulette")
    # First: hidden gems
    query = select(Movie).options(joinedload(Movie.review)).join(Review).where(
        and_(
            Review.verdict == "WORTH IT",
            Movie.poster_path.is_not(None),
            Movie.tmdb_popularity < 20,
        )
    )
    if exclude:
        query = query.where(Movie.tmdb_id != exclude)
    query = query.order_by(func.random()).limit(1)
    result = await db.execute(query)
    movie = result.unique().scalar_one_or_none()

    # Second: any WORTH IT
    if not movie:
        query = select(Movie).options(joinedload(Movie.review)).join(Review).where(
            and_(Review.verdict == "WORTH IT", Movie.poster_path.is_not(None))
        )
        if exclude:
            query = query.where(Movie.tmdb_id != exclude)
        query = query.order_by(func.random()).limit(1)
        result = await db.execute(query)
        movie = result.unique().scalar_one_or_none()

    # Third: without exclude
    if not movie and exclude:
        query = select(Movie).options(joinedload(Movie.review)).join(Review).where(
            and_(Review.verdict == "WORTH IT", Movie.poster_path.is_not(None))
        ).order_by(func.random()).limit(1)
        result = await db.execute(query)
        movie = result.unique().scalar_one_or_none()

    if movie:
        return _format_movie_with_review(movie)

    # Fourth: TMDB discover fallback — pick a random well-rated movie
    try:
        page = _random.randint(1, 5)
        data = await tmdb_service._get("/discover/movie", params={
            "vote_average.gte": 7,
            "vote_count.gte": 500,
            "sort_by": "vote_average.desc",
            "include_adult": "false",
            "page": page,
        })
        candidates = [
            r for r in data.get("results", [])
            if r.get("poster_path") and is_safe_content(r)
            and (not exclude or r.get("id") != exclude)
        ]
        if candidates:
            pick = _random.choice(candidates)
            movie_resp = MovieResponse(
                id=0,
                tmdb_id=pick["id"],
                title=pick.get("title", "Unknown"),
                media_type="movie",
                overview=pick.get("overview"),
                poster_path=pick.get("poster_path"),
                backdrop_path=pick.get("backdrop_path"),
                genres=[],
                release_date=pick.get("release_date") or None,
                tmdb_popularity=pick.get("popularity"),
                tmdb_vote_average=pick.get("vote_average"),
                poster_url=tmdb_service.get_poster_url(pick.get("poster_path")),
                backdrop_url=tmdb_service.get_backdrop_url(pick.get("backdrop_path")),
            )
            return MovieWithReview(movie=movie_resp, review=None)
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="No reviewed movies found")



@router.get("/{tmdb_id}", response_model=MovieWithReview)
async def get_movie(
    tmdb_id: int,
    media_type: str = Query(None, pattern="^(movie|tv)$"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Movie).options(joinedload(Movie.review)).where(Movie.tmdb_id == tmdb_id)
    if media_type:
        query = query.where(Movie.media_type == media_type)
    result = await db.execute(query)
    movies = result.unique().scalars().all()

    # If multiple entries share the same tmdb_id (e.g. movie "Yellowknife" 
    # and TV show "The 100" both have tmdb_id 48866), prefer the one 
    # that has a review. This prevents showing the wrong title when 
    # media_type is not specified in the URL.
    movie = None
    if len(movies) == 1:
        movie = movies[0]
    elif len(movies) > 1:
        reviewed = [m for m in movies if m.review]
        movie = reviewed[0] if reviewed else movies[0]

    if movie:
        return _format_movie_with_review(movie)

    # ─── TMDB Fallback for movies not in our DB ──────────────
    # This handles Discover clicks, Coming Soon, and any movie
    # the user navigates to that hasn't been reviewed yet.
    import logging
    _logger = logging.getLogger(__name__)
    from app.services.safety import get_block_reason

    try:
        tmdb_data = None
        detected_type = media_type or "movie"
        if media_type == "movie":
            tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
        elif media_type == "tv":
            tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
        else:
            tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
            if not tmdb_data or not tmdb_data.get("id"):
                tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
                detected_type = "tv"

        if not tmdb_data or not tmdb_data.get("id"):
            _logger.warning(f"🚫 TMDB fallback: no data for tmdb_id={tmdb_id}")
            raise HTTPException(status_code=404, detail="Movie not found")

        _logger.info(f"📡 TMDB fallback fetched: '{tmdb_data.get('title') or tmdb_data.get('name')}' (tmdb_id={tmdb_id})")

        # Only block adult/erotica content — skip vote-count spam filters
        # since user explicitly navigated to this movie (not a search result)
        if tmdb_data.get("adult", False):
            _logger.warning(f"🚫 TMDB fallback BLOCKED: tmdb_id={tmdb_id}, reason=adult content")
            raise HTTPException(status_code=404, detail="Movie not found (blocked)")

        text_to_check = " ".join([
            tmdb_data.get("title", ""), tmdb_data.get("name", ""),
            tmdb_data.get("original_title", ""), tmdb_data.get("overview", "")
        ]).lower()
        from app.services.safety import _HARD_BLOCKLIST_PATTERNS
        for pattern in _HARD_BLOCKLIST_PATTERNS:
            if pattern.search(text_to_check):
                _logger.warning(f"🚫 TMDB fallback BLOCKED: tmdb_id={tmdb_id}, reason=blocklist '{pattern.pattern}'")
                raise HTTPException(status_code=404, detail="Movie not found (blocked)")

        tmdb_data["media_type"] = detected_type

        # Normalize — but don't let it crash us
        try:
            normalized = tmdb_service.normalize_result(tmdb_data)
        except Exception as norm_err:
            _logger.error(f"normalize_result failed for {tmdb_id}: {norm_err}")
            normalized = {}

        # Parse every field safely — one bad field should NOT kill the page
        title = normalized.get("title") or tmdb_data.get("title") or tmdb_data.get("name") or "Unknown"
        
        poster_path = normalized.get("poster_path") or tmdb_data.get("poster_path")
        backdrop_path = normalized.get("backdrop_path") or tmdb_data.get("backdrop_path")
        overview = normalized.get("overview") or tmdb_data.get("overview") or ""

        # Genres: TMDB details returns [{"id": 28, "name": "Action"}]
        # normalize_result should handle this, but fallback to raw
        raw_genres = normalized.get("genres") or tmdb_data.get("genres") or []
        genres = []
        if isinstance(raw_genres, list):
            for g in raw_genres:
                if isinstance(g, dict):
                    genres.append(g)
                elif isinstance(g, (int, str)):
                    genres.append({"id": g, "name": ""})

        # Release date: handle strings, date objects, None, empty strings
        parsed_release = None
        raw_release = normalized.get("release_date") or tmdb_data.get("release_date") or tmdb_data.get("first_air_date")
        if raw_release:
            try:
                from datetime import date as date_type
                if isinstance(raw_release, str) and raw_release.strip():
                    parsed_release = date_type.fromisoformat(raw_release.strip())
                elif hasattr(raw_release, "isoformat"):
                    parsed_release = raw_release
            except (ValueError, TypeError):
                parsed_release = None

        # Numeric fields
        tmdb_pop = None
        try:
            tmdb_pop = float(normalized.get("tmdb_popularity") or tmdb_data.get("popularity") or 0) or None
        except (ValueError, TypeError):
            pass

        tmdb_vote = None
        try:
            tmdb_vote = float(normalized.get("tmdb_vote_average") or tmdb_data.get("vote_average") or 0) or None
        except (ValueError, TypeError):
            pass

        movie_resp = MovieResponse(
            id=0,
            tmdb_id=tmdb_id,
            title=title,
            media_type=detected_type,
            overview=overview,
            poster_path=poster_path,
            backdrop_path=backdrop_path,
            genres=genres,
            release_date=parsed_release,
            tmdb_popularity=tmdb_pop,
            tmdb_vote_average=tmdb_vote,
            poster_url=tmdb_service.get_poster_url(poster_path),
            backdrop_url=tmdb_service.get_backdrop_url(backdrop_path),
        )
        return MovieWithReview(movie=movie_resp, review=None)

    except HTTPException:
        raise
    except Exception as e:
        _logger.error(f"TMDB fallback failed for {tmdb_id}: {e}", exc_info=True)

    raise HTTPException(status_code=404, detail="Movie not found")


@router.get("/{tmdb_id}/streaming")
async def get_streaming_availability(
    tmdb_id: int,
    region: str = Query("US", max_length=2),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = result.scalar_one_or_none()
    media_type = movie.media_type if movie else "movie"
    providers = await tmdb_service.get_watch_providers(tmdb_id, media_type, region)

    def format_provider(p: dict) -> dict:
        logo_path = p.get("logo_path", "")
        return {
            "name": p.get("provider_name", ""),
            "logo_url": f"https://image.tmdb.org/t/p/w92{logo_path}" if logo_path else None,
            "provider_id": p.get("provider_id"),
        }

    flatrate = [format_provider(p) for p in providers.get("flatrate", [])]
    rent = [format_provider(p) for p in providers.get("rent", [])]
    buy = [format_provider(p) for p in providers.get("buy", [])]
    free = [format_provider(p) for p in (providers.get("free", []) + providers.get("ads", []))]

    return {
        "available": bool(flatrate or rent or buy or free),
        "flatrate": flatrate, "rent": rent, "buy": buy, "free": free,
        "justwatch_link": providers.get("link", ""),
    }


@router.get("/person/{person_id}")
async def get_person(
    person_id: int,
    exclude_tmdb_id: int = Query(None, description="Exclude this movie from filmography (the one user is viewing)"),
    db: AsyncSession = Depends(get_db),
):
    """Get actor details + filmography with WTW verdict enrichment."""
    person_data = await tmdb_service.get_person_with_credits(person_id)
    filmography = person_data.get("filmography", [])

    # Exclude the current movie if specified
    if exclude_tmdb_id:
        filmography = [f for f in filmography if f["tmdb_id"] != exclude_tmdb_id]

    # Filter out adult/blocklist content only (not spam scores — these are real actor credits)
    from app.services.safety import _HARD_BLOCKLIST_PATTERNS
    def _is_filmography_safe(item: dict) -> bool:
        title = (item.get("title") or "").lower()
        for pattern in _HARD_BLOCKLIST_PATTERNS:
            if pattern.search(title):
                return False
        return True
    filmography = [f for f in filmography if _is_filmography_safe(f)]

    # Enrich with WTW verdicts
    if filmography:
        tmdb_ids = [f["tmdb_id"] for f in filmography]
        rows = await db.execute(
            select(Movie.tmdb_id, Movie.media_type, Review.verdict)
            .join(Review, Review.movie_id == Movie.id)
            .where(Movie.tmdb_id.in_(tmdb_ids))
        )
        review_map = {
            (row.tmdb_id, row.media_type): row.verdict
            for row in rows.all()
        }
        for f in filmography:
            verdict = review_map.get((f["tmdb_id"], f["media_type"]))
            f["has_review"] = verdict is not None
            f["verdict"] = verdict

    person_data["filmography"] = filmography
    return person_data


@router.get("/{tmdb_id}/credits")
async def get_movie_credits(
    tmdb_id: int,
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get cast list for a movie or TV show."""
    try:
        if media_type == "tv":
            credits = await tmdb_service.get_tv_credits(tmdb_id)
        else:
            credits = await tmdb_service.get_movie_credits(tmdb_id)
        
        if not credits:
            return {"cast": []}
        
        # Return top 12 cast members
        cast = []
        for person in credits.get("cast", [])[:12]:
            cast.append({
                "id": person.get("id"),
                "name": person.get("name", ""),
                "character": person.get("character", ""),
                "profile_path": person.get("profile_path"),
                "profile_url": f"https://image.tmdb.org/t/p/w185{person['profile_path']}" if person.get("profile_path") else None,
            })
        
        return {"cast": cast}
    except Exception as e:
        return {"cast": []}


@router.get("/{tmdb_id}/recommendations")
async def get_recommendations(
    tmdb_id: int,
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get recommended movies/shows similar to this one."""
    try:
        if media_type == "tv":
            endpoint = f"/tv/{tmdb_id}/recommendations"
        else:
            endpoint = f"/movie/{tmdb_id}/recommendations"

        data = await tmdb_service._get(endpoint, params={"language": "en-US"})
        raw = data.get("results", [])

        results = []
        tmdb_ids = []
        for item in raw[:15]:
            if not item.get("poster_path"):
                continue
            mt = item.get("media_type", media_type)
            title = item.get("title") or item.get("name") or ""
            poster = item.get("poster_path")
            results.append({
                "tmdb_id": item["id"],
                "title": title,
                "media_type": mt,
                "poster_url": f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
                "tmdb_vote_average": item.get("vote_average"),
                "release_date": item.get("release_date") or item.get("first_air_date"),
            })
            tmdb_ids.append(item["id"])

        # Cross-reference with our review DB for verdicts
        if tmdb_ids:
            reviewed = await db.execute(
                select(Movie.tmdb_id, Movie.media_type, Review.verdict)
                .join(Review, Review.movie_id == Movie.id)
                .where(Movie.tmdb_id.in_(tmdb_ids))
            )
            verdict_map = {(row.tmdb_id, row.media_type): row.verdict for row in reviewed.all()}
            for r in results:
                key = (r["tmdb_id"], r.get("media_type", "movie"))
                r["verdict"] = verdict_map.get(key)
                r["has_review"] = key in verdict_map

        return {"results": results}
    except Exception as e:
        return {"results": []}


def _format_movie_with_review(movie: Movie) -> MovieWithReview:
    movie_resp = MovieResponse(
        id=movie.id, tmdb_id=movie.tmdb_id, title=movie.title,
        media_type=movie.media_type, overview=movie.overview,
        poster_path=movie.poster_path, backdrop_path=movie.backdrop_path,
        genres=movie.genres, release_date=movie.release_date,
        tmdb_popularity=movie.tmdb_popularity,
        tmdb_vote_average=movie.tmdb_vote_average,
        poster_url=tmdb_service.get_poster_url(movie.poster_path),
        backdrop_url=tmdb_service.get_backdrop_url(movie.backdrop_path),
    )
    review_resp = None
    if movie.review:
        review_resp = ReviewResponse.model_validate(movie.review)
    return MovieWithReview(movie=movie_resp, review=review_resp)