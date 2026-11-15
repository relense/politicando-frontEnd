import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PartyLogo } from "@/components/PartyLogo";
import { getPartyOverview } from "@/lib/api/client";
import { formatPercent } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { partyPath } from "@/lib/parties";
import type { PartyOverview } from "@/lib/types";

export const metadata: Metadata = {
  title: "Partidos",
  description:
    "Os partidos políticos portugueses: quem os lidera, quantos deputados têm, quantos votos tiveram nas últimas legislativas, e as suas notícias.",
  alternates: { canonical: "/partidos" },
};

/** Null when the list can't be loaded, so the page can say so calmly. */
async function loadParties(): Promise<PartyOverview[] | null> {
  try {
    return await getPartyOverview();
  } catch {
    return null;
  }
}

const byName = (a: PartyOverview, b: PartyOverview) => a.acronym.localeCompare(b.acronym, "pt", { sensitivity: "base" });

export default async function PartiesPage() {
  await connection();
  const parties = await loadParties();
  // The API already sends the most seats first; those without seats are listed by name.
  const seated = (parties ?? []).filter((party) => party.seats > 0);
  const others = (parties ?? []).filter((party) => party.seats === 0).sort(byName);

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Partidos políticos</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">Partidos</h1>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Quem os lidera, quantos deputados têm e como votaram neles nas últimas legislativas. Carrega num partido para ver as notícias, as
          votações no Parlamento e o fórum.
        </p>
      </header>

      {!parties ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Não foi possível carregar os partidos.</p>
      ) : (
        <>
          {seated.length > 0 && (
            <section aria-labelledby="com-deputados">
              <h2 id="com-deputados" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                No Parlamento
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {seated.map((party) => (
                  <li key={party.slug}>
                    <PartyCard party={party} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {others.length > 0 && (
            <section aria-labelledby="sem-deputados" className="mt-12">
              <h2 id="sem-deputados" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                Sem deputados
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((party) => (
                  <li key={party.slug}>
                    <Link
                      href={partyPath(party.slug)}
                      className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-surface"
                    >
                      <PartyLogo slug={party.slug} acronym={party.acronym} size={28} />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-bold">{party.acronym}</span>
                        <span className="block truncate text-sm text-muted">{party.name}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** "28,0% nas legislativas de 2025", or the coalition's share, said as such and never added up. */
function electionLine(election: PartyOverview["lastElection"]): string | null {
  if (!election) return null;
  const year = election.id.match(/\d{4}/)?.[0];
  const share = formatPercent(election.validPct);
  if (!share) return null;
  return election.coalition
    ? `${share} em coligação, nas legislativas${year ? ` de ${year}` : ""}`
    : `${share} nas legislativas${year ? ` de ${year}` : ""}`;
}

function PartyCard({ party }: { party: PartyOverview }) {
  const election = electionLine(party.lastElection);
  return (
    <article
      className="relative flex h-full flex-col rounded-2xl border border-line p-5 hover:bg-surface"
      style={{ boxShadow: `inset 0 4px 0 ${partyColor(party.slug)}` }}
    >
      <div className="flex items-center gap-3">
        <PartyLogo slug={party.slug} acronym={party.acronym} size={44} />
        <div className="min-w-0">
          <h3 className="font-mono text-lg font-bold leading-tight">
            {/* The whole card opens the party; the leader's link sits above it. */}
            <Link href={partyPath(party.slug)} className="after:absolute after:inset-0">
              {party.acronym}
            </Link>
          </h3>
          <p className="text-sm leading-snug text-muted">{party.name}</p>
        </div>
      </div>

      <p className="mt-4">
        <span className="text-3xl font-bold">{party.seats}</span>{" "}
        <span className="text-sm text-muted">{party.seats === 1 ? "deputado" : "deputados"}</span>
      </p>
      {election && <p className="font-mono text-xs text-muted">{election}</p>}
      {party.governmentMembers > 0 && (
        <p className="font-mono text-xs text-muted">
          No Governo: {party.governmentMembers === 1 ? "pelo menos 1 membro" : `pelo menos ${party.governmentMembers} membros`}
        </p>
      )}

      {party.leader && (
        <p className="mt-auto border-t border-line pt-3 text-sm">
          <span className="block font-mono text-xs text-muted">{party.leader.title ?? "Líder"}</span>
          {party.leader.href ? (
            <Link
              href={party.leader.href}
              className="relative z-10 font-bold underline decoration-line underline-offset-2 hover:decoration-ink"
            >
              {party.leader.name}
            </Link>
          ) : (
            <span className="font-bold">{party.leader.name}</span>
          )}
        </p>
      )}
    </article>
  );
}
