import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import type { PaginatedMovies } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getMovies(): Promise<PaginatedMovies | null> {
  try {
    const res = await fetch(`${API_BASE}/api/movies?sort=latest&limit=40`, {
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await getMovies();
  const movies = data?.movies ?? [];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="py-8 text-center sm:py-16">
        <h1 className="font-display text-4xl text-text-primary sm:text-6xl">
          Worth the Watch<span className="text-accent-gold">?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
          AI-powered reviews synthesized from real internet opinions. No critic
          bias. No algorithms. Just what people actually think.
        </p>
        <div className="mx-auto mt-8 max-w-2xl">
          <SearchBar placeholder="Is Severance Season 2 worth watching?" />
        </div>
      </section>

      {/* Movies Grid */}
      {movies.length > 0 ? (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl text-text-primary">
              Latest Verdicts
            </h2>
            <span className="text-sm text-text-muted">
              {data?.total ?? 0} titles reviewed
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {movies.map((item) => (
              <MovieCard key={item.movie.tmdb_id} data={item} />
            ))}
          </div>
        </section>
      ) : (
        <section className="py-16 text-center">
          <p className="text-6xl">🎬</p>
          <h2 className="mt-4 font-display text-2xl text-text-primary">
            No reviews yet
          </h2>
          <p className="mt-2 text-text-secondary">
            The database is being seeded with reviews. Check back soon, or
            search for a specific title to generate a review on demand.
          </p>
        </section>
      )}
    </div>
  );
}
