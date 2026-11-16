import Link from "next/link";
import type { ContractGroup, ContractParty, ContractSummary } from "@/lib/api/contracts";
import { competitionOf, contractsLabel, formatEuros, formatEurosShort, share } from "@/lib/api/contracts";
import { formatDate, formatPercent } from "@/lib/format";

/** A body or company, linked to its page when BASE published its NIF. */
export function PartyName({ party }: { party: ContractParty }) {
  return party.nif ? (
    <Link href={`/contratos/entidade/${party.nif}`} className="text-link underline-offset-2 hover:underline">
      {party.name}
    </Link>
  ) : (
    <span>{party.name}</span>
  );
}

/** The colour of each kind of procedure, the same in the bars, the table and the badges. */
export const COMPETITION_COLOR = {
  open: "var(--stage-law)",
  limited: "var(--stage-stopped)",
  other: "var(--stage-submitted)",
} as const;

export function ProcedureBadge({ kind, label }: { kind: string; label: string }) {
  const color = COMPETITION_COLOR[competitionOf(kind)];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

const names = (parties: ContractParty[]) =>
  parties.map((party, index) => (
    <span key={`${party.nif}-${index}`}>
      {index > 0 && ", "}
      <PartyName party={party} />
    </span>
  ));

/** One contract in a list: what was bought, by whom and from whom on the left; the price and the source on the right. */
export function ContractItem({ contract }: { contract: ContractSummary }) {
  return (
    <li className="grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ProcedureBadge kind={contract.procedure.kind} label={contract.procedure.label} />
          <span className="font-mono text-xs text-muted">{formatDate(contract.publishedAt ?? contract.signedAt)}</span>
        </div>
        <h3 className="mt-2 break-words font-bold leading-snug">
          <Link href={`/contratos/${contract.id}`} className="hover:underline">
            {contract.object}
          </Link>
        </h3>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          {contract.entities.length > 0 && (
            <>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-muted sm:pt-0.5">Quem contratou</dt>
              <dd className="min-w-0 break-words">{names(contract.entities)}</dd>
            </>
          )}
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted sm:pt-0.5">Adjudicado a</dt>
          <dd className="min-w-0 break-words">{contract.suppliers.length === 0 ? "Não publicado" : names(contract.suppliers)}</dd>
        </dl>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
        <p className="text-right">
          <span className="block text-xl font-bold tabular-nums">
            {contract.price === null ? "Preço não publicado" : formatEuros(contract.price)}
          </span>
          {contract.price !== null && <span className="block font-mono text-[11px] text-muted">sem IVA</span>}
        </p>
        {contract.baseUrl && (
          <a
            href={contract.baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-[11px] font-bold hover:bg-surface"
          >
            Ver no BASE <span aria-hidden="true">↗</span>
            <span className="sr-only"> (abre noutra janela)</span>
          </a>
        )}
      </div>
    </li>
  );
}

export function ContractList({ contracts, label }: { contracts: ContractSummary[]; label: string }) {
  return (
    <ul aria-label={label} className="space-y-3">
      {contracts.map((contract) => (
        <ContractItem key={contract.id} contract={contract} />
      ))}
    </ul>
  );
}

/** A top-N list with a bar for each total, relative to the first. */
export function Ranking({
  title,
  items,
  href,
  note,
}: {
  title: string;
  items: ContractGroup[];
  href?: (key: string) => string | null;
  note?: string;
}) {
  const max = items[0]?.total ?? 0;
  return (
    <section className="rounded-2xl border border-line p-4">
      <h3 className="font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem dados.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((item, index) => {
            const link = href?.(item.key) ?? null;
            return (
              <li key={item.key} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">
                    <span className="mr-1 font-mono text-xs text-muted">{index + 1}.</span>
                    {link ? (
                      <Link href={link} className="text-link underline-offset-2 hover:underline">
                        {item.label}
                      </Link>
                    ) : (
                      item.label
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-bold tabular-nums">{formatEurosShort(item.total)}</span>
                </div>
                <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-surface">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(1, share(item.total, max))}%` }} />
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-muted">{contractsLabel(item.count)}</p>
              </li>
            );
          })}
        </ol>
      )}
      {note && <p className="mt-3 text-xs leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

/** "Fonte: Portal BASE / IMPIC", with when it was last imported. */
export function ContractsSource({ updatedAt, source }: { updatedAt?: string | null; source?: string | null }) {
  return (
    <p className="mt-10 border-t border-line pt-4 font-mono text-xs leading-relaxed text-muted">
      Fonte:{" "}
      {source ? (
        <a href={source} target="_blank" rel="noopener noreferrer" className="underline">
          Portal BASE / IMPIC
        </a>
      ) : (
        "Portal BASE / IMPIC"
      )}
      {updatedAt && ` · atualizado a ${formatDate(updatedAt.replace(" ", "T").replace(/\+00$/, "Z"))}`}. Valores sem IVA, tal como
      publicados pelas entidades públicas. Os textos dos contratos aparecem como foram publicados.
    </p>
  );
}

/** "12,3%" of something, or nothing for an empty whole. */
/** "14,5%", or "menos de 0,1%" for a sliver that would otherwise round to nothing. */
export const percentOf = (part: number, whole: number) => {
  if (whole <= 0) return null;
  const value = share(part, whole);
  return part > 0 && value < 0.05 ? "menos de 0,1%" : formatPercent(value);
};
