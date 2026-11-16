import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { InitiativeList } from "@/components/InitiativeList";
import { ApiError, getInitiatives, getParliament, type InitiativeQuery } from "@/lib/api/client";
import { getInitiativeTopics, type TopicCount } from "@/lib/api/presidency";
import { formatNumber } from "@/lib/format";
import { INITIATIVE_STAGES, toneColor, type InitiativeStageKey, type StageTone } from "@/lib/initiatives";
import type { InitiativePage, Parliament } from "@/lib/types";

type Search = {
  tema?: string | string[];
  fase?: string | string[];
  q?: string | string[];
  ordem?: string | string[];
  // Older addresses, from before the API filtered by phase: still understood.
  estado?: string | string[];
  presidente?: string | string[];
};
type Props = { searchParams: Promise<Search> };

/** The old filters, by status and by the President's decision, as the phase they now are. */
const LEGACY: Record<string, InitiativeStageKey> = {
  in_progress: "debate",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "withdrawn",
  pending: "president",
  vetoed: "vetoed",
  promulgated: "published",
};

type Filters = {
  topic: string | null;
  stage: InitiativeStageKey | null;
  /** Words from the title, or the initiative's number. */
  q: string | null;
  oldest: boolean;
};

function filtersOf(search: Search, topics: readonly TopicCount[]): Filters {
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  const topic = one(search.tema);
  const asked = one(search.fase) ?? LEGACY[one(search.estado) ?? ""] ?? LEGACY[one(search.presidente) ?? ""] ?? null;
  const q = one(search.q)?.trim().slice(0, 100) ?? "";
  return {
    topic: topics.some((item) => item.slug === topic) ? topic : null,
    stage: INITIATIVE_STAGES.find((item) => item.key === asked)?.key ?? null,
    q: q || null,
    oldest: one(search.ordem) === "antigas",
  };
}

function pathOf({ topic, stage, q, oldest }: Filters) {
  const query = new URLSearchParams();
  if (topic) query.set("tema", topic);
  if (stage) query.set("fase", stage);
  if (q) query.set("q", q);
  if (oldest) query.set("ordem", "antigas");
  return query.size > 0 ? `/iniciativas?${query}` : "/iniciativas";
}

const loadTopics = () => getInitiativeTopics().catch(() => ({ items: [] as TopicCount[], untagged: 0 }));

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [search, topics] = await Promise.all([searchParams, loadTopics()]);
  const filters = filtersOf(search, topics.items);
  const topic = topics.items.find((item) => item.slug === filters.topic);
  return {
    title: topic ? `${topic.label} · Iniciativas no Parlamento` : "Iniciativas no Parlamento",
    description:
      "As propostas de lei e recomendações que entram no Parlamento, explicadas em linguagem simples: o que são, em que fase estão, quem as propôs e como se votou.",
    // A search or another order is the same list again: point to it without them, and keep searches out of the index.
    alternates: { canonical: pathOf({ ...filters, q: null, oldest: false }) },
    robots: filters.q ? { index: false, follow: true } : undefined,
  };
}

/** Null while the API doesn't serve initiatives, so the page can say so calmly. */
async function loadPage(query: InitiativeQuery): Promise<InitiativePage | null> {
  try {
    return await getInitiatives(query);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

const TOPIC_TONES: StageTone[] = ["submitted", "approved", "debate", "president", "law", "stopped"];
const TOPICS_SHOWN = 10;

export default async function InitiativesPage({ searchParams }: Props) {
  await connection();
  const [search, topics, parliament] = await Promise.all([
    searchParams,
    loadTopics(),
    getParliament().catch((): Parliament | null => null),
  ]);
  const filters = filtersOf(search, topics.items);
  const query: Omit<InitiativeQuery, "cursor"> = {
    topic: filters.topic ?? undefined,
    stage: filters.stage ?? undefined,
    q: filters.q ?? undefined,
    sort: filters.oldest ? "oldest" : undefined,
    limit: 20,
  };
  const filtered = Boolean(filters.topic || filters.q);
  // The figures at the top are for everything; with a topic or a search, they need a page of their own.
  const [page, everything] = await Promise.all([loadPage(query), filtered ? loadPage({ limit: 1 }) : null]);

  // The API counts each phase with every filter but the phase, so the path keeps its numbers.
  const counted = new Map((page?.stages ?? []).map((item) => [item.key, item]));
  const steps = INITIATIVE_STAGES.map((stage) => {
    const fromApi = counted.get(stage.key);
    return { ...stage, label: fromApi?.label ?? stage.label, plain: fromApi?.plain, count: fromApi?.count };
  });
  const activeStep = steps.find((step) => step.key === filters.stage) ?? null;
  const base: Filters = { ...filters, stage: null };
  const total = page?.stages.length ? page.stages.reduce((sum, item) => sum + item.count, 0) : null;
  const topic = topics.items.find((item) => item.slug === filters.topic) ?? null;
  const shown = page?.total ?? null;

  const overall = new Map(((filtered ? everything?.stages : page?.stages) ?? []).map((item) => [item.key, item]));
  const figure = (...keys: InitiativeStageKey[]) =>
    keys.every((key) => overall.has(key)) ? keys.reduce((sum, key) => sum + overall.get(key)!.count, 0) : undefined;
  const cards = [
    { label: "Em discussão", tone: "debate" as const, value: figure("submitted", "debate"), note: "Entregues ou em debate" },
    { label: "Aprovadas", tone: "approved" as const, value: figure("approved"), note: overall.get("approved")?.plain ?? null },
    { label: "No Presidente", tone: "president" as const, value: figure("president"), note: overall.get("president")?.plain ?? null },
    { label: "Já são lei", tone: "law" as const, value: figure("published"), note: "Publicadas em Diário da República" },
  ].filter((card) => card.value !== undefined);

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          Assembleia da República{parliament ? ` · ${parliament.legislature} Legislatura` : ""}
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          O que está a{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">mudar</span> nas
          leis
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Cada proposta que entra no Parlamento, explicada em linguagem simples: o que é, em que fase está e quem a propôs.
        </p>
        <p className="mt-2 max-w-2xl font-mono text-xs text-muted">
          Os títulos simples são gerados por regras fixas a partir do título oficial, que mostramos sempre ao lado.
        </p>
      </header>

      {cards.length > 0 && (
        <ul aria-label="Em números" className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <li
              key={card.label}
              className="flex flex-col-reverse justify-end rounded-xl border p-4"
              style={{
                borderColor: `color-mix(in srgb, ${toneColor(card.tone)} 40%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${toneColor(card.tone)} 7%, transparent)`,
              }}
            >
              {card.note && <span className="mt-1 text-sm text-muted">{card.note}</span>}
              <span className="text-3xl font-bold">{formatNumber(card.value!)}</span>
              <span
                className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest"
                style={{ color: toneColor(card.tone) }}
              >
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: toneColor(card.tone) }} />
                {card.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {/* On phones the path is a row of pills above the list; on larger screens it sits in the column beside it. */}
          <nav aria-label="Fase" className="mb-4 lg:hidden">
            <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              <li>
                <Link href={pathOf(base)} aria-current={!filters.stage ? "page" : undefined} className={pill(!filters.stage)}>
                  Todas
                </Link>
              </li>
              {steps.map((step) => (
                <li key={step.key}>
                  <Link
                    href={pathOf({ ...base, stage: step.key })}
                    aria-current={filters.stage === step.key ? "page" : undefined}
                    className={pill(filters.stage === step.key)}
                  >
                    {step.label}
                    {step.count !== undefined && <span className="ml-1 font-normal opacity-70">{formatNumber(step.count)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <SearchBar filters={filters} />

          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b-2 border-ink pb-2 font-mono text-xs">
            <p>
              {shown !== null && <span className="font-bold">{formatNumber(shown)} </span>}
              <span className={shown !== null ? "text-muted" : "font-bold"}>{shown === 1 ? "iniciativa" : "iniciativas"}</span>
              <span className="text-muted"> · {filters.oldest ? "mais antigas primeiro" : "mais recentes primeiro"}</span>
            </p>
            {activeStep?.plain && (
              <p className="basis-full font-sans text-sm text-muted">
                {activeStep.label}: {activeStep.plain}
              </p>
            )}
            {filters.q && (
              <Link href={pathOf({ ...filters, q: null })} className="rounded-full border border-line px-2 py-0.5 hover:bg-surface">
                Pesquisa: «{filters.q}» <span aria-hidden="true">×</span>
                <span className="sr-only"> (tirar a pesquisa)</span>
              </Link>
            )}
            {topic && (
              <Link href={pathOf({ ...filters, topic: null })} className="rounded-full border border-line px-2 py-0.5 hover:bg-surface">
                Tema: {topic.label} <span aria-hidden="true">×</span>
                <span className="sr-only"> (tirar o filtro)</span>
              </Link>
            )}
          </div>

          {page ? (
            <InitiativeList key={pathOf(filters)} query={query} initialPage={page} />
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              As iniciativas ainda não estão disponíveis. Volta em breve.
            </p>
          )}
        </div>

        {/* Below the list on phones (the phases are the pills above it), beside it on larger screens. */}
        <aside className="flex flex-col gap-5">
          <nav aria-labelledby="caminho" className="hidden rounded-2xl border border-line p-4 lg:block">
            <h2 id="caminho" className="font-mono text-xs font-bold uppercase tracking-widest">
              O caminho de uma lei
            </h2>
            <p className="mb-3 text-xs text-muted">Toca numa fase para filtrar.</p>
            <ol className="flex flex-col">
              <li>
                <PathLink href={pathOf(base)} active={!filters.stage} label="Todas" count={total} tone={null} />
              </li>
              {steps.map((step, index) => (
                <li key={step.key} className={step.end ? "pl-4" : ""}>
                  {!step.end && index > 0 && <span aria-hidden="true" className="ml-[1.0625rem] block h-2 w-px bg-line" />}
                  <PathLink
                    href={pathOf({ ...base, stage: step.key })}
                    active={filters.stage === step.key}
                    label={step.label}
                    title={step.plain}
                    count={step.count ?? null}
                    tone={step.tone}
                    hollow={step.end}
                  />
                </li>
              ))}
            </ol>
          </nav>

          {topics.items.length > 0 && <TopicBars topics={topics.items} filters={filters} />}
        </aside>
      </div>
    </div>
  );
}

const pill = (active: boolean) =>
  `inline-block whitespace-nowrap rounded-full border px-3 py-1 font-mono text-xs font-bold ${active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;

function PathLink({
  href,
  active,
  label,
  count,
  tone,
  title,
  hollow = false,
}: {
  href: string;
  active: boolean;
  label: string;
  /** What the phase means, from the API. */
  title?: string;
  count: number | null;
  tone: StageTone | null;
  hollow?: boolean;
}) {
  const color = tone ? toneColor(tone) : "var(--ink)";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={title}
      className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs ${active ? "border-ink bg-surface" : "border-transparent hover:bg-surface"}`}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={hollow || !tone ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { backgroundColor: color }}
      />
      <span className="flex-1">{label}</span>
      {count !== null && <span className="text-muted">{formatNumber(count)}</span>}
    </Link>
  );
}

/** Topics by number of initiatives, as bars: the first ten, the rest folded. */
function TopicBars({ topics, filters }: { topics: TopicCount[]; filters: Filters }) {
  const sorted = [...topics].sort((a, b) => b.count - a.count);
  const max = sorted[0]?.count ?? 1;
  const row = (topic: TopicCount, index: number) => (
    <li key={topic.slug}>
      <Link
        href={pathOf({ ...filters, topic: filters.topic === topic.slug ? null : topic.slug })}
        aria-current={filters.topic === topic.slug ? "page" : undefined}
        className={`block rounded px-1 py-1 font-mono text-xs hover:bg-surface ${filters.topic === topic.slug ? "bg-surface font-bold" : ""}`}
      >
        <span className="flex justify-between gap-2">
          <span>{topic.label}</span>
          <span className="text-muted">{formatNumber(topic.count)}</span>
        </span>
        <span className="mt-1 block h-0.5 rounded-full bg-line">
          <span
            className="block h-full rounded-full"
            style={{ width: `${(topic.count / max) * 100}%`, backgroundColor: toneColor(TOPIC_TONES[index % TOPIC_TONES.length]!) }}
          />
        </span>
      </Link>
    </li>
  );
  return (
    <nav aria-labelledby="temas" className="rounded-2xl border border-line p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id="temas" className="font-mono text-xs font-bold uppercase tracking-widest">
          Temas
        </h2>
        <span className="font-mono text-[11px] text-muted">por n.º de iniciativas</span>
      </div>
      <ul className="flex flex-col gap-1">{sorted.slice(0, TOPICS_SHOWN).map(row)}</ul>
      {sorted.length > TOPICS_SHOWN && (
        <details className="group mt-1">
          <summary className="mt-2 inline-block cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface group-open:hidden">
            Ver os {sorted.length} temas
          </summary>
          <ul className="flex flex-col gap-1">{sorted.slice(TOPICS_SHOWN).map((topic, index) => row(topic, index + TOPICS_SHOWN))}</ul>
        </details>
      )}
    </nav>
  );
}

/** A plain form, so it works before the page's scripts load: the words, plus the filters already chosen, and the order. */
function SearchBar({ filters }: { filters: Filters }) {
  const keep = { tema: filters.topic, fase: filters.stage, ordem: filters.oldest ? "antigas" : null };
  const order = (oldest: boolean) =>
    `inline-flex h-10 items-center rounded-full border px-4 font-mono text-xs font-bold ${filters.oldest === oldest ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form action="/iniciativas" role="search" className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
        {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          maxLength={100}
          placeholder="Título ou número, ex.: «rendas»"
          aria-label="Procurar iniciativas"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-sm"
        />
        <button type="submit" className="h-10 rounded-full border border-ink px-4 font-mono text-xs font-bold hover:bg-surface">
          Procurar
        </button>
      </form>
      <nav aria-label="Ordem" className="flex gap-1.5">
        <Link href={pathOf({ ...filters, oldest: false })} aria-current={!filters.oldest ? "page" : undefined} className={order(false)}>
          Mais recentes
        </Link>
        <Link href={pathOf({ ...filters, oldest: true })} aria-current={filters.oldest ? "page" : undefined} className={order(true)}>
          Mais antigas
        </Link>
      </nav>
    </div>
  );
}
