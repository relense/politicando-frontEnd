"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getInitiative, getInitiatives } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { partyColor, STATUS_LABELS } from "@/lib/parliament";
import { OriginBadge, originOf } from "./OrgansExplainer";
import type { Initiative, InitiativePage, InitiativeStatus, ParliamentGroup, VotePosition } from "@/lib/types";

type Tab = Extract<InitiativeStatus, "approved" | "in_progress">;
const TABS: { value: Tab; label: string }[] = [
  { value: "approved", label: "Aprovadas" },
  { value: "in_progress", label: "Em discussão" },
];

const POSITION_LABELS: Record<string, string> = { favor: "a favor", against: "contra", abstention: "abstenção" };

/** Narrows the list to what is chosen on the map: one deputy or one party. */
export type InitiativeFilter = { label: string; deputy?: number; party?: string } | null;

type Props = {
  initialPage: InitiativePage | null;
  counts: Partial<Record<InitiativeStatus, number>>;
  groups: ReadonlyMap<string, ParliamentGroup>;
  filter: InitiativeFilter;
  /** Hovering an initiative lights up its authors' benches. */
  onHighlight: (parties: string[] | null) => void;
};

/** Initiatives ("diplomas") approved or still being discussed, with who proposed them and how the vote went. */
export function InitiativesSection({ initialPage, counts, groups, filter, onHighlight }: Props) {
  const [tab, setTab] = useState<Tab>("approved");
  const [filtered, setFiltered] = useState(false);
  const active = filtered && filter ? filter : null;
  const usesInitialPage = tab === "approved" && !active && initialPage !== null;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError } = useInfiniteQuery({
    queryKey: ["initiatives", tab, active?.deputy ?? null, active?.party ?? null],
    queryFn: ({ pageParam }) => getInitiatives({ status: tab, deputy: active?.deputy, party: active?.party, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: usesInitialPage ? { pages: [initialPage], pageParams: [undefined] } : undefined,
  });
  const initiatives = data?.pages.flatMap((page) => page.initiatives) ?? [];

  return (
    <section aria-labelledby="iniciativas" className="mt-14">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
        <h2 id="iniciativas" className="font-mono text-sm font-bold uppercase tracking-widest">
          Iniciativas
        </h2>
        <div role="group" aria-label="Estado das iniciativas" className="flex gap-1 font-mono text-xs">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`rounded px-3 py-1.5 font-bold ${tab === value ? "bg-ink text-paper" : "border border-line text-muted hover:text-ink"}`}
            >
              {label}
              {counts[value] !== undefined && <span className="font-normal"> {counts[value]}</span>}
            </button>
          ))}
        </div>
      </div>

      {filter && (
        <label className="mb-5 flex w-fit cursor-pointer items-center gap-2 font-mono text-sm">
          <input type="checkbox" checked={filtered} onChange={(event) => setFiltered(event.target.checked)} />
          Só as de {filter.label}
        </label>
      )}

      {isPending ? (
        <p className="text-muted">A carregar iniciativas…</p>
      ) : isError ? (
        <p role="alert" className="text-muted">
          Não foi possível carregar as iniciativas.
        </p>
      ) : initiatives.length === 0 ? (
        <p className="text-muted">Não há iniciativas para mostrar.</p>
      ) : (
        <ul className="flex flex-col">
          {initiatives.map((initiative) => {
            const authors = initiative.authors.parties.map((party) => party.slug);
            const highlight = () => onHighlight(authors.length > 0 ? authors : null);
            return (
              <li
                key={initiative.id}
                onMouseEnter={highlight}
                onMouseLeave={() => onHighlight(null)}
                onFocus={highlight}
                onBlur={() => onHighlight(null)}
              >
                <InitiativeCard initiative={initiative} groups={groups} />
              </li>
            );
          })}
        </ul>
      )}

      {hasNextPage && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full border border-line px-5 py-2 font-mono text-sm font-bold hover:bg-surface disabled:opacity-60"
          >
            {isFetchingNextPage ? "A carregar…" : "Carregar mais"}
          </button>
        </div>
      )}
    </section>
  );
}

function InitiativeCard({ initiative, groups }: { initiative: Initiative; groups: ReadonlyMap<string, ParliamentGroup> }) {
  const [showVote, setShowVote] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const related = initiative.coverage.articles;
  const { authors, lastVote } = initiative;
  const date = formatDate(initiative.phaseDate);
  const proposedBy =
    authors.other ??
    [
      ...authors.parties.map((party) => party.acronym),
      ...authors.deputies.map((author) => {
        const acronym = author.partySlug ? groups.get(author.partySlug)?.party.acronym : null;
        return acronym ? `${author.name} (${acronym})` : author.name;
      }),
    ].join(", ");

  return (
    <article className="border-b border-line py-5">
      <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <span className="sr-only">Origem: </span>
        <OriginBadge origin={originOf(initiative)} label={authors.other ?? undefined} linked />
        <span className="font-bold text-ink">
          {initiative.type}
          {initiative.number && ` n.º ${initiative.number}`}
        </span>
        <span aria-hidden="true">·</span>
        <span>{STATUS_LABELS[initiative.status]}</span>
        {initiative.phase && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {initiative.phase}
              {date && `, ${date}`}
            </span>
          </>
        )}
      </p>
      <h3 className="text-lg font-bold leading-snug">{initiative.title}</h3>

      {proposedBy && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-mono text-xs uppercase tracking-wider">Proposta por </span>
          {proposedBy}
        </p>
      )}

      {lastVote && (
        <p className="mt-2 font-mono text-xs text-muted">
          {lastVote.phase ?? "Votação"}: <span className="font-bold text-ink">{lastVote.result}</span>
          {lastVote.unanimous && " por unanimidade"}
          {lastVote.date && ` em ${formatDate(lastVote.date)}`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm">
        {lastVote && !lastVote.unanimous && (
          <button type="button" aria-expanded={showVote} onClick={() => setShowVote((value) => !value)} className="text-link underline">
            {showVote ? "Esconder votação" : "Ver votação por partido"}
          </button>
        )}
        {/* Matched by keywords from the title, so it's labelled as related rather than as coverage. */}
        {related > 0 && (
          <button type="button" aria-expanded={showNews} onClick={() => setShowNews((value) => !value)} className="text-link underline">
            {showNews ? "Esconder notícias" : `${related} ${related === 1 ? "notícia relacionada" : "notícias relacionadas"}`}
          </button>
        )}
        {initiative.textUrl && (
          <a href={initiative.textUrl} target="_blank" rel="noopener noreferrer" className="text-link underline">
            Ler o texto ↗<span className="sr-only"> (abre num novo separador)</span>
          </a>
        )}
      </div>

      {showVote && <VoteBreakdown id={initiative.id} groups={groups} />}
      {showNews && <RelatedNews id={initiative.id} />}
    </article>
  );
}

/** How each party voted in the latest vote, loaded only when asked for. */
function VoteBreakdown({ id, groups }: { id: number; groups: ReadonlyMap<string, ParliamentGroup> }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["initiative", id], queryFn: () => getInitiative(id) });
  if (isPending) return <p className="mt-3 text-sm text-muted">A carregar a votação…</p>;
  if (isError) return <p className="mt-3 text-sm text-muted">Não foi possível carregar a votação.</p>;
  const vote = data.votes.at(-1);
  if (!vote) return <p className="mt-3 text-sm text-muted">Sem detalhe de votação.</p>;

  const acronym = (slug: string) => groups.get(slug)?.party.acronym ?? slug.toUpperCase();
  return (
    <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-surface p-3 text-sm">
      <p className="font-mono text-xs text-muted">
        {vote.phase ?? "Votação"}
        {vote.date && `, ${formatDate(vote.date)}`}: <span className="font-bold text-ink">{vote.result}</span>
      </p>
      <VoteRow label="A favor" positions={vote.favor} acronym={acronym} />
      <VoteRow label="Contra" positions={vote.against} acronym={acronym} />
      <VoteRow label="Abstenção" positions={vote.abstention} acronym={acronym} />
      <VoteRow label="Ausentes" positions={vote.absent} acronym={acronym} />
      {vote.named.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          Votaram à parte da sua bancada:{" "}
          {vote.named
            .map((person) => `${person.name} (${person.group}, ${POSITION_LABELS[person.position] ?? person.position})`)
            .join("; ")}
        </p>
      )}
    </div>
  );
}

function VoteRow({ label, positions, acronym }: { label: string; positions: VotePosition[]; acronym: (slug: string) => string }) {
  if (positions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 font-mono text-xs text-muted">{label}</span>
      {positions.map(({ partySlug, count }) => (
        <span
          key={partySlug}
          className="flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-xs font-bold"
        >
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(partySlug) }} />
          {/* A number means only that many of the group's deputies. */}
          {count !== null && `${count} `}
          {acronym(partySlug)}
        </span>
      ))}
    </div>
  );
}

/** News that seems to be about the initiative. Loaded only when asked for, from the same request as the votes. */
function RelatedNews({ id }: { id: number }) {
  const { data, isPending, isError } = useQuery({ queryKey: ["initiative", id], queryFn: () => getInitiative(id) });
  if (isPending) return <p className="mt-3 text-sm text-muted">A carregar as notícias…</p>;
  if (isError) return <p className="mt-3 text-sm text-muted">Não foi possível carregar as notícias.</p>;
  if (data.articles.length === 0) return <p className="mt-3 text-sm text-muted">Sem notícias relacionadas nas nossas fontes.</p>;
  return (
    <div className="mt-3 rounded-xl bg-surface p-3">
      <p className="font-mono text-xs text-muted">Encontradas pelas palavras do título; podem não ser todas sobre esta iniciativa.</p>
      <ul className="mt-1 divide-y divide-line">
        {data.articles.map((article) => (
          <li key={article.id} className="py-2">
            <p className="font-mono text-[11px] text-muted">
              {article.source} · {formatDate(article.publishedAt)}
            </p>
            <Link href={`/article/${article.id}`} className="text-sm font-bold leading-snug hover:underline">
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
