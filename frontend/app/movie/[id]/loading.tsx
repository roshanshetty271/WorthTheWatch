export default function MovieLoading() {
  return (
    <div className="min-h-screen animate-pulse opacity-0" style={{ animation: "fadeIn 0.3s ease-in 1s forwards" }}>
      {/* Backdrop skeleton */}
      <div className="relative min-h-[50vh] md:min-h-[60vh] bg-white/5">
        {/* Back button */}
        <div className="absolute top-20 left-4 sm:left-6 z-10">
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10" />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-8 left-4 sm:left-12 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-white/10 rounded-full" />
            <div className="h-5 w-12 bg-white/10 rounded-full" />
          </div>
          <div className="h-8 w-72 bg-white/10 rounded-lg" />
          <div className="flex gap-2">
            <div className="h-5 w-20 bg-white/5 rounded-full" />
            <div className="h-5 w-20 bg-white/5 rounded-full" />
            <div className="h-5 w-20 bg-white/5 rounded-full" />
          </div>
          <div className="flex gap-3 mt-2">
            <div className="h-10 w-32 bg-white/10 rounded-full" />
            <div className="h-10 w-32 bg-white/10 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Review skeleton */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-4">
        <div className="h-5 w-full bg-white/5 rounded" />
        <div className="h-5 w-full bg-white/5 rounded" />
        <div className="h-5 w-3/4 bg-white/5 rounded" />
        <div className="h-5 w-full bg-white/5 rounded mt-4" />
        <div className="h-5 w-5/6 bg-white/5 rounded" />
      </div>
    </div>
  );
}
