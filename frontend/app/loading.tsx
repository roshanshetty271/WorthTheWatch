export default function HomeLoading() {
  return (
    <div className="min-h-screen animate-pulse opacity-0" style={{ animation: "fadeIn 0.3s ease-in 1s forwards" }}>
      {/* Hero skeleton */}
      <div className="relative min-h-[80svh] md:min-h-[100svh] bg-white/5">
        <div className="absolute bottom-12 left-6 sm:left-12 space-y-3">
          <div className="h-3 w-20 bg-white/10 rounded-full" />
          <div className="h-7 w-64 bg-white/10 rounded-lg" />
          <div className="h-4 w-48 bg-white/5 rounded-lg" />
          <div className="h-10 w-36 bg-white/10 rounded-full mt-4" />
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-12">
        {[...Array(3)].map((_, s) => (
          <div key={s}>
            <div className="h-6 w-48 bg-white/10 rounded-lg mb-6" />
            <div className="flex gap-4 sm:gap-6 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="shrink-0 w-[140px] sm:w-[170px] md:w-[200px]">
                  <div className="aspect-[2/3] rounded-xl bg-white/5" />
                  <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
