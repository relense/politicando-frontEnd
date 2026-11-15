import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { InitiativeList } from "@/components/InitiativeList";
import { ApiError, getInitiatives, type InitiativeQuery } from "@/lib/api/client";
import { getInitiativeTopics, type TopicCount } from "@/lib/api/presidency";
import { formatNumber } from "@/lib/format";
import type { InitiativePage, InitiativeStatus, PresidencyStatus } from "@/lib/types";

type Search = { tema?: string | string[]; estado?: string | string[]; presidente?: string | string[] };
type Props = { searchParams: Promise<Search> };

const STATUSES: { value: InitiativeStatus; label: string }[] = [
  { value: "in_progress", label: "Em discussão" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Rejeitadas" },
  { value: "withdrawn", label: "Retiradas" },
];
const PRESIDENCY: PresidencyStatus[] = ["pending", "vetoed", "promulgated"];
const PRESIDENCY_FILTERS: Record<PresidencyStatus, string> = {
  pending: "À espera do Presidente",
  vetoed: "Vetadas",
  promulgated: "Promulgadas",
};

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

export default async function InitiativesPage({ searchParams }: Props) {
  await connection();
  const [search, topics] = await Promise.all([searchParams, loadTopics()]);
  const filters = filtersOf(search, topics.items);
  const query: Omit<InitiativeQuery, "cursor"> = {
    topic: filters.topic ?? undefined,
    status: filters.status ?? undefined,
    presidency: filters.presidency ?? undefined,
    limit: 20,
  };
  const page = await loadPage(query);
  const pill = (active: boolean) =>
    `inline-block whitespace-nowrap rounded-full border px-3 py-1 font-mono text-xs font-bold ${active ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`;

  return (
    <div data-wide>
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Assembleia da República</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Iniciativas, em linguagem simples</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Tudo o que entra no Parlamento para mudar uma lei ou recomendar algo ao Governo: o que é, em que fase está e quem propôs. Os
          títulos simples são gerados por regras fixas a partir do título oficial, que mostramos sempre por baixo.
        </p>
      </header>

      <div className="mb-8 flex flex-col gap-4">
        <nav aria-label="Estado">
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <li>
              <Link
                href={pathOf({ ...filters, status: null, presidency: null })}
                aria-current={!filters.status && !filters.presidency ? "page" : undefined}
                className={pill(!filters.status && !filters.presidency)}
              >
                Todas
              </Link>
            </li>
            {STATUSES.map((item) => (
              <li key={item.value}>
                <Link
                  href={pathOf({ ...filters, status: item.value, presidency: null })}
                  aria-current={filters.status === item.value ? "page" : undefined}
                  className={pill(filters.status === item.value)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {PRESIDENCY.map((item) => (
              <li key={item}>
                <Link
                  href={pathOf({ ...filters, status: null, presidency: item })}
                  aria-current={filters.presidency === item ? "page" : undefined}
                  className={pill(filters.presidency === item)}
                >
                  {PRESIDENCY_FILTERS[item]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {topics.items.length > 0 && (
          <nav aria-label="Temas">
            <ul className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <li>
                <Link
                  href={pathOf({ ...filters, topic: null })}
                  aria-current={filters.topic ? undefined : "page"}
                  className={pill(!filters.topic)}
                >
                  Todos os temas
                </Link>
              </li>
              {topics.items.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={pathOf({ ...filters, topic: topic.slug })}
                    aria-current={filters.topic === topic.slug ? "page" : undefined}
                    className={pill(filters.topic === topic.slug)}
                  >
                    {topic.label} <span className="font-normal">{formatNumber(topic.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {page ? (
        <InitiativeList key={pathOf(filters)} query={query} initialPage={page} />
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          As iniciativas ainda não estão disponíveis. Volta em breve.
        </p>
      )}
    </div>
  );
}
