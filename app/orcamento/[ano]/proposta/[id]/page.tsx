import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ResultBadge } from "@/components/budget/BudgetParts";
import { AutomaticLabel, ProposalVotes, WhatChanges } from "@/components/budget/ProposalItem";
import { getBudgetProposal } from "@/lib/api/budget";
import { formatDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";

type Props = { params: Promise<{ ano: string; id: string }> };

/** One proposal, read once per request for the page and its metadata. */
const load = cache(async (ano: string, id: string) =>
  /^\d{4}$/.test(ano) && /^\d+$/.test(id) ? getBudgetProposal(Number(ano), Number(id)).catch(() => null) : null,
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ano, id } = await params;
  const proposal = await load(ano, id);
  if (!proposal) return { title: "Proposta de alteração ao Orçamento" };
  return {
    title: `${proposal.title} · proposta ${proposal.number} ao OE ${proposal.year}`,
    description: `Proposta de alteração n.º ${proposal.number} ao Orçamento do Estado para ${proposal.year}${
      proposal.authors.label ? `, de ${proposal.authors.label}` : ""
    }: o resultado e como votou cada partido.`,
    alternates: { canonical: `/orcamento/${proposal.year}/proposta/${proposal.id}` },
  };
}

const label = "font-mono text-[11px] font-bold uppercase tracking-widest text-muted";

export default async function BudgetProposalPage({ params }: Props) {
  const { ano, id } = await params;
  const proposal = await load(ano, id);
  if (!proposal) notFound();
  const facts: [string, string | null][] = [
    [
      "Proposta por",
      proposal.authors.label ||
        [...proposal.authors.parties.map((party) => party.acronym), ...proposal.authors.deputies].join(", ") ||
        null,
    ],
    ["Temas", proposal.topics.join(", ") || null],
    ["Artigo", proposal.article],
    ["Tipo", proposal.kind],
    ["Entregue a", formatDate(proposal.submittedOn)],
    ["Estado na fonte oficial", proposal.status],
  ];
  return (
    <article data-wide className="max-w-3xl">
      <Link href={`/orcamento/${proposal.year}`} className="font-mono text-xs uppercase tracking-widest text-muted hover:underline">
        <span aria-hidden="true">← </span>Orçamento do Estado {proposal.year}
      </Link>
      <p className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        {proposal.authors.parties[0] && (
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: partyColor(proposal.authors.parties[0].slug) }}
          />
        )}
        Proposta de alteração n.º {proposal.number}
        <ResultBadge result={proposal.result} />
      </p>
      <h1 className="mt-1 font-serif text-3xl font-bold leading-tight">{proposal.title}</h1>
      <WhatChanges proposal={proposal} className="mt-4 rounded-xl border border-line p-4" />
      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {facts
          .filter((fact): fact is [string, string] => Boolean(fact[1]))
          .map(([term, value]) => (
            <div key={term}>
              <dt className={label}>{term}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
      </dl>
      <section aria-labelledby="votacao" className="mt-6">
        <h2 id="votacao" className="border-b-2 border-ink pb-1 font-mono text-xs font-bold uppercase tracking-widest">
          {proposal.votes.length > 1 ? "As votações" : "A votação"}
        </h2>
        <div className="mt-3">
          <ProposalVotes proposal={proposal} />
        </div>
      </section>
      <p className="mt-6 flex flex-wrap gap-2">
        {proposal.documentUrl && (
          <a
            href={proposal.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
          >
            PDF oficial <span aria-hidden="true">↗</span>
          </a>
        )}
        {proposal.sourceUrl && (
          <a
            href={proposal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface"
          >
            Fonte: Parlamento <span aria-hidden="true">↗</span>
          </a>
        )}
        <AutomaticLabel proposal={proposal} />
      </p>
      <p className="mt-4 font-mono text-[11px] text-muted">
        Resultados nos termos do Parlamento. O texto da proposta está no PDF oficial
        {proposal.plain?.automatic
          ? "; o resumo foi escrito automaticamente a partir dele."
          : proposal.plain
            ? "."
            : "; ainda não temos um resumo simples."}
      </p>
    </article>
  );
}
