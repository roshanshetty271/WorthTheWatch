export default function BrowseLoading() {
  return (
    <div className="min-h-screen animate-pulse pt-28 md:pt-32 px-4 opacity-0" style={{ animation: "fadeIn 0.3s ease-in 1s forwards" }}>
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-56 bg-white/10 rounded-lg mb-2" />
        <div className="h-4 w-80 bg-white/5 rounded-lg mb-8" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {[...Array(15)].map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-white/5" />
              <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
              <div className="mt-1 h-2 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
