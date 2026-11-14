const bar = "rounded bg-surface";

/** Home only: a loading boundary on pages that can 404 would turn their 404s into 200s. */
export function FeedSkeleton() {
  return (
    <div role="status" className="flex animate-pulse flex-col gap-6">
      <span className="sr-only">A carregar notícias…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} aria-hidden="true" className="border-b border-line pb-6">
          <div className={`mb-3 h-6 w-4/5 ${bar}`} />
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className={`aspect-video w-full sm:w-56 ${bar}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-4 ${bar}`} />
              <div className={`h-4 w-11/12 ${bar}`} />
              <div className={`h-4 w-2/3 ${bar}`} />
              <div className={`mt-3 h-3 w-1/3 ${bar}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
