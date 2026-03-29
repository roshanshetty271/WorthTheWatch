export default function DiscoverLoading() {
  return (
    <div className="min-h-screen animate-pulse pt-28 md:pt-32 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="h-10 w-48 bg-white/10 rounded-lg mb-2" />
        <div className="h-4 w-72 bg-white/5 rounded-lg mb-8" />

        {/* Filter bar skeleton */}
        <div className="flex gap-2 mb-4">
          <div className="h-8 w-24 bg-white/10 rounded-full" />
          <div className="h-8 w-24 bg-white/10 rounded-full" />
          <div className="h-8 w-32 bg-white/5 rounded-full" />
        </div>
        <div className="flex gap-2 mb-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-7 w-16 bg-white/5 rounded-full shrink-0" />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 mt-8">
          {[...Array(18)].map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-white/5" />
              <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
