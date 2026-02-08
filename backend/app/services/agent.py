"""
Worth the Watch? — LangGraph Agent
Optional upgrade from the procedural pipeline.
Uses a StateGraph for adaptive review generation with conditional routing.

Enable via: USE_LANGGRAPH=true in .env
"""

import logging
from typing import TypedDict, Optional, Literal

from langgraph.graph import StateGraph, END

from app.models import Movie, Review
from app.services.serper import serper_service
from app.services.jina import jina_service
from app.services.grep import extract_opinion_paragraphs, select_best_sources
from app.services.llm import synthesize_review, llm_model
from app.services.omdb import omdb_service
from app.services.kinocheck import kinocheck_service, youtube_embed_url
from app.services.guardian import guardian_service
from app.services.nyt import nyt_service
from app.schemas import LLMReviewOutput
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── State Definition ─────────────────────────────────────────

class AgentState(TypedDict):
    """State passed between nodes in the review generation graph."""
    # Input
    movie: Movie
    title: str
    year: str
    genres: str
    
    # Search results
    search_results: list[dict]
    search_attempts: int
    
    # Processed content
    articles: list[str]
    filtered_opinions: str
    
    # LLM output
    llm_output: Optional[LLMReviewOutput]
    
    # Enrichment data
    omdb_scores: Optional[dict]
    trailer_url: Optional[str]
    
    # Final output
    review: Optional[Review]
    error: Optional[str]


# ─── Node Functions ───────────────────────────────────────────

async def search_sources(state: AgentState) -> dict:
    """Search for reviews using Serper + Guardian + NYT."""
    title = state["title"]
    year = state["year"]
    
    logger.info(f"🔍 Agent: Searching for reviews of '{title}'")
    
    results = []
    
    # Serper search (critic + Reddit)
    try:
        critic_results = await serper_service.search_reviews(title, year)
        reddit_results = await serper_service.search_reddit(title, year)
        results.extend(critic_results + reddit_results)
    except Exception as e:
        logger.warning(f"Serper search failed: {e}")
    
    # Guardian
    try:
        guardian_articles = await guardian_service.search_film_reviews(title, year)
        for article in guardian_articles:
            results.append({
                "title": article.headline,
                "link": article.url,
                "snippet": article.snippet,
            })
    except Exception as e:
        logger.warning(f"Guardian search failed: {e}")
    
    # NYT
    try:
        nyt_reviews = await nyt_service.search_reviews(title)
        for review in nyt_reviews:
            results.append({
                "title": review.headline,
                "link": review.url,
                "snippet": review.summary,
            })
    except Exception as e:
        logger.warning(f"NYT search failed: {e}")
    
    return {
        "search_results": results,
        "search_attempts": state.get("search_attempts", 0) + 1,
    }


async def read_articles(state: AgentState) -> dict:
    """Read article content using Jina Reader."""
    results = state["search_results"]
    title = state["title"]
    
    if not results:
        return {"articles": [], "error": "No search results found"}
    
    selected_urls = select_best_sources(results, max_total=12)
    logger.info(f"📖 Agent: Reading {len(selected_urls)} articles for '{title}'")
    
    articles = await jina_service.read_urls(selected_urls, max_concurrent=10)
    
    # Fallback to snippets if reading failed
    if not articles:
        snippets = "\n\n".join(
            f"Source: {r['title']}\n{r['snippet']}" for r in results[:10]
        )
        articles = [snippets]
    
    return {"articles": articles}


async def filter_opinions(state: AgentState) -> dict:
    """Filter opinion paragraphs using grep-like keyword matching."""
    articles = state["articles"]
    title = state["title"]
    
    logger.info(f"🔎 Agent: Filtering opinions from {len(articles)} articles for '{title}'")
    
    filtered = extract_opinion_paragraphs(articles)
    
    # Fallback if filtering removed too much
    if not filtered or len(filtered) < 50:
        results = state["search_results"]
        filtered = "\n\n".join(
            f"{r['title']}: {r['snippet']}" for r in results[:15]
        )
    
    return {"filtered_opinions": filtered}


def assess_quality(state: AgentState) -> Literal["sufficient", "broaden"]:
    """Assess if we have enough quality data to generate a review."""
    filtered = state.get("filtered_opinions", "")
    search_attempts = state.get("search_attempts", 0)
    articles = state.get("articles", [])
    
    # If we've already tried broadening, proceed anyway
    if search_attempts >= 2:
        return "sufficient"
    
    # Check if we have enough content
    if len(filtered) > 500 and len(articles) >= 3:
        return "sufficient"
    
    # Need more data
    return "broaden"


async def broaden_search(state: AgentState) -> dict:
    """Broaden search when initial results are insufficient."""
    title = state["title"]
    year = state["year"]
    
    logger.info(f"🔄 Agent: Broadening search for '{title}' (attempt {state.get('search_attempts', 1) + 1})")
    
    # Try alternative search queries
    additional_results = []
    
    try:
        # Search without year for older titles
        results = await serper_service.search(f'"{title}" review worth watching', num_results=10)
        additional_results.extend(results)
    except Exception as e:
        logger.warning(f"Broadened search failed: {e}")
    
    # Merge with existing results
    existing = state.get("search_results", [])
    seen_urls = {r.get("link") for r in existing}
    
    for r in additional_results:
        if r.get("link") not in seen_urls:
            existing.append(r)
            seen_urls.add(r.get("link"))
    
    return {
        "search_results": existing,
        "search_attempts": state.get("search_attempts", 0) + 1,
    }


async def synthesize(state: AgentState) -> dict:
    """Generate review using LLM."""
    movie = state["movie"]
    title = state["title"]
    
    logger.info(f"🧠 Agent: Generating review for '{title}'")
    
    try:
        llm_output = await synthesize_review(
            title=title,
            year=state["year"],
            genres=state["genres"],
            overview=movie.overview or "",
            opinions=state["filtered_opinions"][:18000],
            sources_count=len(state.get("articles", [])),
            tmdb_score=movie.tmdb_vote_average or 0.0,
        )
        return {"llm_output": llm_output}
    except Exception as e:
        return {"error": f"LLM synthesis failed: {e}"}


async def enrich_data(state: AgentState) -> dict:
    """Fetch OMDB scores and KinoCheck trailer."""
    movie = state["movie"]
    title = state["title"]
    year = state["year"]
    
    logger.info(f"🎬 Agent: Enriching data for '{title}'")
    
    omdb_scores = None
    trailer_url = None
    
    # OMDB
    try:
        scores = await omdb_service.get_scores_by_title(
            title, year, "series" if movie.media_type == "tv" else "movie"
        )
        omdb_scores = scores.to_dict()
    except Exception as e:
        logger.warning(f"OMDB fetch failed: {e}")
    
    # KinoCheck
    try:
        trailer_id = await kinocheck_service.get_trailer_by_tmdb_id(movie.tmdb_id, movie.media_type or "movie")
        if trailer_id:
            trailer_url = youtube_embed_url(trailer_id)
    except Exception as e:
        logger.warning(f"KinoCheck fetch failed: {e}")
    
    return {
        "omdb_scores": omdb_scores,
        "trailer_url": trailer_url,
    }


# ─── Graph Builder ────────────────────────────────────────────

def build_review_agent() -> StateGraph:
    """Build the review generation agent graph."""
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("search", search_sources)
    workflow.add_node("read", read_articles)
    workflow.add_node("filter", filter_opinions)
    workflow.add_node("broaden", broaden_search)
    workflow.add_node("synthesize", synthesize)
    workflow.add_node("enrich", enrich_data)
    
    # Define edges
    workflow.set_entry_point("search")
    workflow.add_edge("search", "read")
    workflow.add_edge("read", "filter")
    
    # Conditional edge: assess quality
    workflow.add_conditional_edges(
        "filter",
        assess_quality,
        {
            "sufficient": "synthesize",
            "broaden": "broaden",
        }
    )
    
    workflow.add_edge("broaden", "read")  # Loop back
    workflow.add_edge("synthesize", "enrich")
    workflow.add_edge("enrich", END)
    
    return workflow.compile()


# Global agent instance
review_agent = build_review_agent()


# ─── Public Interface ─────────────────────────────────────────

async def run_agent_pipeline(movie: Movie) -> dict:
    """
    Run the LangGraph agent to generate a review.
    
    Returns dict with:
        - llm_output: LLMReviewOutput
        - omdb_scores: dict
        - trailer_url: str | None
        - search_results: list
        - error: str | None
    """
    title = movie.title
    year = str(movie.release_date.year) if movie.release_date else ""
    genres = ", ".join(g.get("name", "") for g in (movie.genres or []) if g.get("name"))
    
    initial_state: AgentState = {
        "movie": movie,
        "title": title,
        "year": year,
        "genres": genres,
        "search_results": [],
        "search_attempts": 0,
        "articles": [],
        "filtered_opinions": "",
        "llm_output": None,
        "omdb_scores": None,
        "trailer_url": None,
        "review": None,
        "error": None,
    }
    
    final_state = await review_agent.ainvoke(initial_state)
    
    return {
        "llm_output": final_state.get("llm_output"),
        "omdb_scores": final_state.get("omdb_scores"),
        "trailer_url": final_state.get("trailer_url"),
        "search_results": final_state.get("search_results", []),
        "error": final_state.get("error"),
    }
