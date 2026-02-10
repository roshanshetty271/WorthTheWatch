/**
 * Worth the Watch? — API Client
 * Communicates with FastAPI backend on Koyeb.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ─── Types ─────────────────────────────────────────────

export interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  media_type: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: { id: number; name?: string }[] | null;
  release_date: string | null;
  tmdb_popularity: number | null;
  tmdb_vote_average: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
}

export interface Review {
  verdict: string;
  review_text: string;
  praise_points: string[] | null;
  criticism_points: string[] | null;
  vibe: string | null;
  confidence: string | null;
  sources_count: number | null;
  generated_at: string | null;
  imdb_score: number | null;
  rt_critic_score: number | null;
  rt_audience_score: number | null;
  // Verdict DNA
  tags?: string[];
  best_quote?: string;
  quote_source?: string;

  metascore: number | null;
  controversial: boolean;

  // Phase 2 additions
  trailer_url: string | null;
  positive_pct: number | null;
  negative_pct: number | null;
  mixed_pct: number | null;
}

export interface MovieWithReview {
  movie: Movie;
  review: Review | null;
}

export interface PaginatedMovies {
  movies: MovieWithReview[];
  total: number;
  page: number;
  pages: number;
}

export interface SearchResult {
  found_in_db: boolean;
  movie: MovieWithReview | null;
  tmdb_results: Movie[] | null;
  generation_status: string | null;
}

// ─── API Functions ─────────────────────────────────────

export async function getMovies(params?: {
  page?: number;
  limit?: number;
  category?: string;
  sort?: string;
  verdict?: string;
  media_type?: string;
}): Promise<PaginatedMovies> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.category) searchParams.set("category", params.category);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.verdict) searchParams.set("verdict", params.verdict);
  if (params?.media_type) searchParams.set("media_type", params.media_type);

  const qs = searchParams.toString();
  return fetchAPI<PaginatedMovies>(`/movies${qs ? `?${qs}` : ""}`);
}

export async function getMovie(tmdbId: number): Promise<MovieWithReview> {
  return fetchAPI<MovieWithReview>(`/movies/${tmdbId}`);
}

export async function searchMovies(query: string): Promise<SearchResult> {
  return fetchAPI<SearchResult>(`/search?q=${encodeURIComponent(query)}`);
}

export async function triggerGeneration(
  tmdbId: number,
  mediaType: string = "movie"
): Promise<{ status: string; tmdb_id: number }> {
  return fetchAPI(`/search/generate/${tmdbId}?media_type=${mediaType}`, {
    method: "POST",
  });
}

export async function checkGenerationStatus(tmdbId: number): Promise<{
  status: "generating" | "completed" | "not_found";
  progress?: string;
  movie?: MovieWithReview;
}> {
  return fetchAPI<{
    status: "generating" | "completed" | "not_found";
    progress?: string;
    movie?: MovieWithReview;
  }>(`/search/status/${tmdbId}`);
}
