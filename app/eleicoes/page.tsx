import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { listName } from "@/components/ElectionResults";
import { ApiError, getElections, getParties } from "@/lib/api/client";
import { ELECTION_TYPES, electionPath } from "@/lib/elections";
import { formatLongDate, formatPercent } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import type { Election, Party } from "@/lib/types";

export const metadata: Metadata = {
  title: "Eleições",
  description:
    "Os resultados das eleições em Portugal desde 2011: legislativas, autárquicas, presidenciais e europeias, do país à freguesia.",
  alternates: { canonical: "/eleicoes" },
};

/** Null while the API does not serve elections yet, so the page can say so calmly. */
async function loadElections(): Promise<Election[] | null> {
  try {
    return await getElections();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function ElectionsPage() {
  await connection();
  const [elections, parties] = await Promise.all([loadElections(), getParties().catch((): Party[] => [])]);

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Resultados oficiais</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Eleições</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Quem ganhou, com quantos votos e onde, desde 2011. Escolhe uma eleição e desce do país ao distrito, ao concelho e à freguesia.
        </p>
      </header>

      {!elections || elections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Os resultados estarão disponíveis em breve.
        </p>
      ) : (
        <div className="space-y-10">
          {ELECTION_TYPES.map(({ type, label, about }) => {
            const ofType = elections.filter((election) => election.type === type);
            if (ofType.length === 0) return null;
            return (
              <section key={type} aria-labelledby={`tipo-${type}`}>
                <h2 id={`tipo-${type}`} className="border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                  {label}
                </h2>
                <p className="mb-4 mt-2 text-sm text-muted">{about}</p>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {ofType.map((election) => (
                    <li key={election.id}>
                      <ElectionCard election={election} parties={parties} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: Ministério da Administração Interna (eleicoes.mai.gov.pt).
      </p>
    </div>
  );
}

function ElectionCard({ election, parties }: { election: Election; parties: Party[] }) {
  const { winner, turnout } = election;
  const content = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold">{election.name}</span>
        {!election.imported && (
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[11px]">a importar…</span>
        )}
      </span>
      <span className="block text-sm text-muted">{formatLongDate(election.date)}</span>
      {winner && (
        <span className="mt-3 flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-sm"
            style={{ backgroundColor: winner.partySlugs[0] ? partyColor(winner.partySlugs[0]) : "var(--muted)" }}
          />
          <span className="min-w-0 truncate">
            <span className="sr-only">Mais votado: </span>
            <span className="font-bold">{listName(winner, parties)}</span> {formatPercent(winner.validPct)}
            {winner.mandates ? ` · ${winner.mandates} mandatos` : ""}
          </span>
        </span>
      )}
      {turnout?.turnoutPct !== null && turnout?.turnoutPct !== undefined && (
        <span className="mt-1 block font-mono text-xs text-muted">Participação: {formatPercent(turnout.turnoutPct)}</span>
      )}
    </>
  );
  const classes = "block h-full rounded-2xl border border-line p-4";
  // Results are only reachable once the import has finished.
  return election.imported ? (
    <Link href={electionPath(election.id)} className={`${classes} hover:bg-surface`}>
      {content}
    </Link>
  ) : (
    <div className={`${classes} border-dashed`}>{content}</div>
  );
}
