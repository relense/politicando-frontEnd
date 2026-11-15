"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getDeputyVotes } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { initiativePath } from "@/lib/initiatives";
import type { DeputyVote, DeputyVotesPage } from "@/lib/types";

const POSITIONS: Record<NonNullable<DeputyVote["position"]>, string> = { favor: "A favor", against: "Contra", abstention: "Abstenção" };

/** The Parliament records votes by group, so each line says how the deputy's position is known. */
function basisLabel(vote: DeputyVote, group: string): string {
  switch (vote.basis) {
    case "named":
      return "votou diferente da bancada";
    case "group":
      return `com a bancada do ${group}`;
    case "unanimous":
      return "por unanimidade";
    case "absent":
      return "bancada ausente";
    case "unknown":
      return "bancada dividida; voto individual não registado";
  }
}

type Props = {
  deputyId: number;
  /** The deputy's group acronym, for "with the PS bench". */
  group: string;
  /** Short version for the card: a few votes and a link to the full list. */
  compact?: boolean;
};

export function DeputyVotes({ deputyId, group, compact = false }: Props) {
  const limit = compact ? 5 : 20;
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["deputy-votes", deputyId, limit],
    queryFn: ({ pageParam }) => getDeputyVotes(deputyId, { cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page: DeputyVotesPage) => page.nextCursor ?? undefined,
  });

  if (isPending) return <p className="text-sm text-muted">A carregar as votações…</p>;
  if (isError) return <p className="text-sm text-muted">Não foi possível carregar as votações.</p>;

  const { summary } = data.pages[0]!;
  const votes = data.pages.flatMap((page) => page.votes);

  return (
    <div>
      <dl className="grid grid-cols-4 gap-2 text-center">
        <Count value={summary.favor} label="a favor" />
        <Count value={summary.against} label="contra" />
        <Count value={summary.abstention} label="abstenções" />
        <Count value={summary.brokeRanks} label="contra a bancada" />
      </dl>
      <p className="mt-2 text-xs text-muted">
        O Parlamento regista os votos por bancada. Cada voto vem da posição da bancada do deputado, a não ser quando o registo o nomeia por
        ter votado de outra forma.
      </p>

      {votes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sem votações registadas.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {votes.map((item) => (
            <li key={item.vote.id} className="py-2.5">
              <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted">
                <span className={`rounded px-1.5 py-0.5 font-bold ${item.basis === "named" ? "bg-ink text-paper" : "bg-surface text-ink"}`}>
                  {item.position ? POSITIONS[item.position] : "Sem registo"}
                </span>
                <span>{basisLabel(item, group)}</span>
                {item.vote.date && <span>· {formatDate(item.vote.date)}</span>}
              </p>
              <p className="mt-1 text-sm font-bold leading-snug">
                <Link href={initiativePath(item.initiative.id)} className="hover:underline">
                  {item.initiative.title}
                </Link>
              </p>
              <p className="font-mono text-[11px] text-muted">
                {item.initiative.type}
                {item.initiative.number && ` n.º ${item.initiative.number}`} · {item.vote.phase ?? "Votação"}: {item.vote.result}
              </p>
            </li>
          ))}
        </ul>
      )}

      {compact ? (
        <Link href={`/deputados/${deputyId}#votacoes`} className="mt-2 inline-block font-mono text-xs text-link underline">
          Ver todas as votações
        </Link>
      ) : (
        hasNextPage && (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-3 w-full rounded-lg border border-line py-2.5 font-mono text-sm font-bold hover:bg-surface disabled:opacity-60"
          >
            {isFetchingNextPage ? "A carregar…" : "Carregar mais"}
          </button>
        )
      )}
    </div>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-surface px-1 py-2">
      <dt className="font-mono text-[10px] leading-tight text-muted">{label}</dt>
      <dd className="text-lg font-bold">{value}</dd>
    </div>
  );
}
