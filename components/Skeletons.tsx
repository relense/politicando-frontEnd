const bar = "rounded bg-surface";

/** Only for pages that can't 404: a loading boundary would turn their 404s into 200s. Home and the initiatives list. */
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

/** The initiatives list while it loads: its title at once (it never changes), then the figures and the list. */
export function InitiativesSkeleton() {
  return (
    <div data-wide role="status">
      <span className="sr-only">A carregar as iniciativas…</span>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Assembleia da República</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          O que está a{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">mudar</span> nas
          leis
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Cada proposta que entra no Parlamento, explicada em linguagem simples: o que é, em que fase está e quem a propôs.
        </p>
      </header>
      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-[88px] rounded-xl border border-line p-4">
              <div className={`h-7 w-16 ${bar}`} />
              <div className={`mt-3 h-3 w-24 ${bar}`} />
            </div>
          ))}
        </div>
        <div className={`mb-4 h-10 w-full rounded-full ${bar}`} />
        <div className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="space-y-2 p-4">
              <div className={`h-3 w-1/4 ${bar}`} />
              <div className={`h-5 w-4/5 ${bar}`} />
              <div className={`h-3 w-1/2 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
