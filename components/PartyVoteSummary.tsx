import Link from "next/link";
import type { PartyVoteSummary as Summary } from "@/lib/api/partyVotes";
import { formatPercent } from "@/lib/format";
import { partyColor } from "@/lib/parliament";

const share = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

/**
 * How the party voted in this legislature, at a glance: a bar of its positions, and the parties it votes with most
 * and least often. Beside the party's description, where the page would otherwise be empty.
 */
export function PartyVoteSummary({ acronym, summary, href }: { acronym: string; summary: Summary; href: string }) {
  const positions = [
    { key: "favor", label: "A favor", value: summary.favor, className: "bg-ink" },
    { key: "abstention", label: "Abstenção", value: summary.abstention, className: "bg-ink/45" },
    { key: "against", label: "Contra", value: summary.against, className: "bg-ink/15" },
  ];
  const counted = positions.reduce((sum, item) => sum + item.value, 0);
  const most = summary.agreement.slice(0, 3);
  const least = summary.agreement.length > 3 ? summary.agreement.slice(-2).reverse() : [];

  return (
    <section aria-labelledby="como-vota" className="mt-8 rounded-2xl border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="como-vota" className="font-mono text-sm font-bold uppercase tracking-widest">
          Como vota no Parlamento
        </h2>
        <span className="font-mono text-xs text-muted">
          {new Intl.NumberFormat("pt-PT", { useGrouping: "always" }).format(summary.total)} votações
          {summary.legislature ? ` · ${summary.legislature} Legislatura` : ""}
        </span>
      </div>

      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        {positions.map((item) => (
          <span key={item.key} className={item.className} style={{ width: `${share(item.value, counted)}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
        {positions.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2.5 rounded-sm ${item.className}`} />
            {item.label} <span className="font-bold">{formatPercent(share(item.value, counted))}</span>
          </li>
        ))}
      </ul>

      {most.length > 0 && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Alignment title={`Vota mais vezes com`} items={most} />
          {least.length > 0 && <Alignment title="E menos vezes com" items={least} />}
        </div>
      )}

      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
        <span>Sem contar votações por unanimidade. Os votos são registados por grupo parlamentar.</span>
        <Link href={href} className="font-mono font-bold text-link underline">
          Ver as votações do {acronym} →
        </Link>
      </p>
    </section>
  );
}

function Alignment({ title, items }: { title: string; items: Summary["agreement"] }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-xs text-muted">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.slug} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-2 font-mono text-xs">
            <span className="font-bold">{item.acronym}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              <span className="block h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: partyColor(item.slug) }} />
            </span>
            <span className="text-right">{formatPercent(item.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
