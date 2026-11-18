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

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

type Body = "list" | "cards" | "grid" | "map" | "timeline";

/**
 * A list page while it loads: its real title at once (it never changes), then grey shapes roughly where the content
 * goes. Next fetches these ahead for every menu link it shows, so a click changes the screen straight away.
 */
export function PageSkeleton({
  label,
  eyebrow,
  before = "",
  marked,
  after = "",
  intro,
  figures = 0,
  body = "list",
}: {
  /** For screen readers: "A carregar o Governo…". */
  label: string;
  eyebrow?: string;
  /** The title, in three parts: before, the highlighted word(s), after. */
  before?: string;
  marked: string;
  after?: string;
  intro?: string;
  /** Boxes of figures under the title. */
  figures?: number;
  body?: Body;
}) {
  return (
    <div data-wide role="status">
      <span className="sr-only">{label}</span>
      <header className="mb-8">
        {eyebrow && <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">{eyebrow}</p>}
        {/* Looks like the page's title but isn't a heading: the page streams in after it, in the same HTML, and two h1s
            there read as two titles to search engines. */}
        <p className="text-3xl font-bold leading-tight sm:text-4xl">
          {before && `${before} `}
          <span className={MARKER}>{marked}</span>
          {after && ` ${after}`}
        </p>
        {intro && <p className="mt-2 max-w-2xl leading-relaxed text-muted">{intro}</p>}
      </header>
      <div aria-hidden="true" className="animate-pulse">
        {figures > 0 && (
          <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: figures }, (_, index) => (
              <div key={index} className="h-[88px] rounded-xl border border-line p-4">
                <div className={`h-7 w-16 ${bar}`} />
                <div className={`mt-3 h-3 w-24 ${bar}`} />
              </div>
            ))}
          </div>
        )}
        <SkeletonBody body={body} />
      </div>
    </div>
  );
}

function SkeletonBody({ body }: { body: Body }) {
  if (body === "map")
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={`aspect-[3/4] max-h-[70vh] w-full rounded-2xl ${bar}`} />
        <Rows count={6} />
      </div>
    );
  if (body === "grid" || body === "cards")
    return (
      <div className={`grid gap-4 sm:grid-cols-2 ${body === "grid" ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3"}`}>
        {Array.from({ length: body === "grid" ? 8 : 6 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-line p-4">
            {body === "cards" && <div className={`mb-4 aspect-video w-full rounded-xl ${bar}`} />}
            <div className="flex items-center gap-3">
              {body === "grid" && <div className={`size-12 shrink-0 rounded-full ${bar}`} />}
              <div className="flex-1 space-y-2">
                <div className={`h-4 w-3/4 ${bar}`} />
                <div className={`h-3 w-1/2 ${bar}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  if (body === "timeline")
    return (
      <div className="flex flex-col gap-4 border-l-2 border-line pl-6">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-line p-4">
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-5 w-2/3 ${bar}`} />
            <div className={`h-3 w-1/3 ${bar}`} />
          </div>
        ))}
      </div>
    );
  return (
    <>
      <div className={`mb-4 h-10 w-full rounded-full ${bar}`} />
      <Rows count={6} />
    </>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className="flex flex-col divide-y divide-line self-start rounded-2xl border border-line">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-2 p-4">
          <div className={`h-3 w-1/4 ${bar}`} />
          <div className={`h-5 w-4/5 ${bar}`} />
          <div className={`h-3 w-1/2 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

/** The initiatives list while it loads. */
export function InitiativesSkeleton() {
  return (
    <PageSkeleton
      label="A carregar as iniciativas…"
      eyebrow="Assembleia da República"
      before="O que está a"
      marked="mudar"
      after="nas leis"
      intro="Cada proposta que entra no Parlamento, explicada em linguagem simples: o que é, em que fase está e quem a propôs."
      figures={4}
    />
  );
}
