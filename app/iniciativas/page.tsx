import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { InitiativeList } from "@/components/InitiativeList";
import { ApiError, getInitiatives, getParliament, type InitiativeQuery } from "@/lib/api/client";
import { getInitiativeTopics, getPresidency, type TopicCount } from "@/lib/api/presidency";
import { formatNumber } from "@/lib/format";
import { toneColor, type StageTone } from "@/lib/initiatives";
import type { InitiativePage, InitiativeStatus, Parliament, PresidencyStatus } from "@/lib/types";

type Search = { tema?: string | string[]; estado?: string | string[]; presidente?: string | string[] };
type Props = { searchParams: Promise<Search> };

const STATUSES: { value: InitiativeStatus; label: string }[] = [
  { value: "in_progress", label: "Em discussão" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Rejeitadas" },
  { value: "withdrawn", label: "Retiradas" },
];
const PRESIDENCY: PresidencyStatus[] = ["pending", "vetoed", "promulgated"];

type Filters = { topic: string | null; status: InitiativeStatus | null; presidency: PresidencyStatus | null };

function filtersOf(search: Search, topics: readonly TopicCount[]): Filters {
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);
  const topic = one(search.tema);
  const status = one(search.estado);
  const presidency = one(search.presidente);
  return {
    topic: topics.some((item) => item.slug === topic) ? topic : null,
    status: STATUSES.find((item) => item.value === status)?.value ?? null,
    presidency: PRESIDENCY.find((item) => item === presidency) ?? null,
  };
}

function pathOf({ topic, status, presidency }: Filters) {
  const query = new URLSearchParams();
  if (topic) query.set("tema", topic);
  if (status) query.set("estado", status);
  if (presidency) query.set("presidente", presidency);
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
    alternates: { canonical: pathOf(filters) },
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

/** One step of "o caminho de uma lei": a filter, its colour and how many there are, when the API says. */
type PathStep = { label: string; tone: StageTone; filters: Filters; count: number | null; end?: boolean };

const TOPIC_TONES: StageTone[] = ["submitted", "approved", "debate", "president", "law", "stopped"];
const TOPICS_SHOWN = 10;

export default async function InitiativesPage({ searchParams }: Props) {
  await connection();
  const [search, topics, parliament, presidency] = await Promise.all([
    searchParams,
    loadTopics(),
    getParliament().catch((): Parliament | null => null),
    getPresidency().catch(() => null),
  ]);
  const filters = filtersOf(search, topics.items);
  const query: Omit<InitiativeQuery, "cursor"> = {
    topic: filters.topic ?? undefined,
    status: filters.status ?? undefined,
    presidency: filters.presidency ?? undefined,
    limit: 20,
  };
  const page = await loadPage(query);

  const counts = parliament?.initiativeCounts ?? {};
  const known = (value: number | undefined) => (value === undefined ? null : value);
  const total = (["in_progress", "approved", "rejected", "withdrawn"] as const).every((key) => counts[key] !== undefined)
    ? counts.in_progress! + counts.approved! + counts.rejected! + counts.withdrawn!
    : null;
  const pending = presidency?.legislation.pending ?? null;
  const base = { topic: filters.topic, status: null, presidency: null };
  const path: PathStep[] = [
    { label: "Em discussão", tone: "debate", filters: { ...base, status: "in_progress" }, count: known(counts.in_progress) },
    { label: "Aprovada no Parlamento", tone: "approved", filters: { ...base, status: "approved" }, count: known(counts.approved) },
    { label: "À espera do Presidente", tone: "president", filters: { ...base, presidency: "pending" }, count: pending },
    { label: "Promulgada: já é lei", tone: "law", filters: { ...base, presidency: "promulgated" }, count: null },
    { label: "Vetada", tone: "stopped", filters: { ...base, presidency: "vetoed" }, count: null, end: true },
    { label: "Rejeitada", tone: "stopped", filters: { ...base, status: "rejected" }, count: known(counts.rejected), end: true },
    { label: "Retirada", tone: "withdrawn", filters: { ...base, status: "withdrawn" }, count: known(counts.withdrawn), end: true },
  ];
  const active = path.find((step) => step.filters.status === filters.status && step.filters.presidency === filters.presidency) ?? null;
  const topic = topics.items.find((item) => item.slug === filters.topic) ?? null;
  // How many match, when one number answers it: the whole list, one stage, or one topic.
  const shown = !filters.status && !filters.presidency ? (topic ? topic.count : total) : !topic ? (active?.count ?? null) : null;

  const cards = [
    { label: "Em discussão", tone: "debate" as const, value: counts.in_progress, note: "Ainda a ser debatidas" },
    { label: "Aprovadas", tone: "approved" as const, value: counts.approved, note: "Passaram no Parlamento" },
    { label: "No Presidente", tone: "president" as const, value: pending ?? undefined, note: "À espera de promulgação ou veto" },
    {
      label: "Já são lei",
      tone: "law" as const,
      value: presidency?.legislation.promulgated,
      note: "Promulgadas pelo atual Presidente",
    },
  ].filter((card) => card.value !== undefined);

  return (
    <div data-wide className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
          Assembleia da República{parliament ? ` · ${parliament.legislature} Legislatura` : ""}
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          O que está a{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">mudar</span> nas
          leis
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">
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
              <span className="mt-1 text-sm text-muted">{card.note}</span>
              <span className="text-4xl font-bold">{formatNumber(card.value!)}</span>
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
                <Link href={pathOf(base)} aria-current={!active ? "page" : undefined} className={pill(!active)}>
                  Todas
                </Link>
              </li>
              {path.map((step) => (
                <li key={step.label}>
                  <Link href={pathOf(step.filters)} aria-current={active === step ? "page" : undefined} className={pill(active === step)}>
                    {step.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b-2 border-ink pb-2 font-mono text-xs">
            <p>
              {shown !== null && <span className="font-bold">{formatNumber(shown)} </span>}
              <span className={shown !== null ? "text-muted" : "font-bold"}>{shown === 1 ? "iniciativa" : "iniciativas"}</span>
              <span className="text-muted"> · mais recentes primeiro</span>
            </p>
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
            <h2 id="caminho" className="font-mono text-[11px] font-bold uppercase tracking-widest">
              O caminho de uma lei
            </h2>
            <p className="mb-3 text-xs text-muted">Toca numa fase para filtrar.</p>
            <ol className="flex flex-col">
              <li>
                <PathLink href={pathOf(base)} active={!active} label="Todas" count={total} tone={null} />
              </li>
              {path.map((step, index) => (
                <li key={step.label} className={step.end ? "pl-4" : ""}>
                  {!step.end && index > 0 && <span aria-hidden="true" className="ml-[1.0625rem] block h-2 w-px bg-line" />}
                  <PathLink
                    href={pathOf(step.filters)}
                    active={active === step}
                    label={step.label}
                    count={step.count}
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
  hollow = false,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number | null;
  tone: StageTone | null;
  hollow?: boolean;
}) {
  const color = tone ? toneColor(tone) : "var(--ink)";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
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
        <h2 id="temas" className="font-mono text-[11px] font-bold uppercase tracking-widest">
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
