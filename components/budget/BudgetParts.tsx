import type { BudgetChoice, BudgetResult, BudgetVote } from "@/lib/api/budget";
import { CHOICE_COLORS, CHOICE_LABELS, partyLines, RESULT_LABELS, RESULT_TONES, type Tone } from "@/lib/budget";
import { formatNumber } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import type { Vote } from "@/lib/types";

/** The small pieces the State Budget pages share: the vote uses its own colour; the party's colour only marks who. */

const TONE_COLORS: Record<Tone, string> = {
  approved: "var(--favor)",
  rejected: "var(--contra)",
  pending: "var(--link)",
  neutral: "var(--muted)",
};

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const color = TONE_COLORS[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-bold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

export const ResultBadge = ({ result }: { result: BudgetResult }) => (
  <ToneBadge tone={RESULT_TONES[result]}>{RESULT_LABELS[result]}</ToneBadge>
);

const MARKS: Record<BudgetChoice, string> = { favor: "✓", against: "×", abstention: "–", absent: "○" };

/** One party's vote: a mark and colour for the vote, a dot in the party's colour, the acronym; read aloud as «PSD: a favor». */
export function VoteChip({ label, slug, vote }: { label: string; slug: string | null; vote: BudgetChoice | null }) {
  const color = vote ? CHOICE_COLORS[vote] : "var(--muted)";
  return (
    <li
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold"
      style={{
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: slug ? partyColor(slug) : "var(--muted)" }} />
      <span aria-hidden="true" style={{ color }}>
        {vote ? MARKS[vote] : "?"}
      </span>
      <span>{label}</span>
      <span className="sr-only">: {vote ? CHOICE_LABELS[vote] : "voto desconhecido"}</span>
    </li>
  );
}

/** A vote's groups as chips, in the source's order. */
export function VoteChips({ vote, label }: { vote: BudgetVote; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1">
      {partyLines(vote).map((line) => (
        <VoteChip key={line.key} label={line.label} slug={line.slug} vote={line.vote} />
      ))}
    </ul>
  );
}

const COLUMNS: { key: BudgetChoice; label: string }[] = [
  { key: "favor", label: "A favor" },
  { key: "abstention", label: "Abstenção" },
  { key: "against", label: "Contra" },
];

/** «A favor · Abstenção · Contra», each with its groups; deputies who voted apart under their group's column. */
export function ChoiceColumns({ vote }: { vote: BudgetVote }) {
  const lines = partyLines(vote);
  const absent = lines.filter((line) => line.vote === "absent");
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        {COLUMNS.map((column) => {
          const here = lines.filter((line) => line.vote === column.key);
          return (
            <div key={column.key} className="rounded-xl border border-line p-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: CHOICE_COLORS[column.key] }}>
                {column.label}
              </p>
              <p className="mt-1 font-mono text-sm font-bold">{here.length > 0 ? here.map((line) => line.label).join(" · ") : "—"}</p>
            </div>
          );
        })}
      </div>
      {absent.length > 0 && <p className="mt-2 font-mono text-xs text-muted">Ausentes: {absent.map((line) => line.label).join(" · ")}</p>}
      {lines.some((line) => line.apart.length > 0) && (
        <ul className="mt-2 font-mono text-xs text-muted">
          {lines
            .filter((line) => line.apart.length > 0)
            .map((line) => (
              <li key={line.key}>
                {line.label}: {line.vote ? CHOICE_LABELS[line.vote] : "voto desconhecido"} (
                {line.apart.map((entry) => `${entry.deputy}: ${entry.vote ? CHOICE_LABELS[entry.vote] : "voto desconhecido"}`).join("; ")})
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/** The parliament couldn't be read with certainty: said so, never guessed. */
export function AmbiguityNote({ vote }: { vote: BudgetVote }) {
  if (!vote.ambiguous) return null;
  return (
    <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-2 font-mono text-xs text-muted">
      Dados incompletos na fonte oficial{vote.ambiguity ? `: ${vote.ambiguity}` : ""}.
    </p>
  );
}

/** A bill's vote (generalidade, votação final global) in the same three columns, with acronyms from what we know. */
export function HeadlineColumns({ vote, acronymOf }: { vote: Vote; acronymOf: (slug: string) => string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(
        [
          ["A favor", vote.favor, CHOICE_COLORS.favor],
          ["Abstenção", vote.abstention, CHOICE_COLORS.abstention],
          ["Contra", vote.against, CHOICE_COLORS.against],
        ] as const
      ).map(([label, items, color]) => (
        <div key={label} className="rounded-xl border border-line p-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color }}>
            {label}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {items.length > 0 ? (
              items.map((item) => (
                <li key={item.partySlug} className="inline-flex items-center gap-1 font-mono text-sm font-bold">
                  <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: partyColor(item.partySlug) }} />
                  {acronymOf(item.partySlug)}
                  {item.count ? ` (${item.count})` : ""}
                </li>
              ))
            ) : (
              <li className="font-mono text-sm text-muted">—</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Approved, rejected and still to vote, as one bar of the whole. */
export function ProgressBar({ approved, rejected, total, label }: { approved: number; rejected: number; total: number; label: string }) {
  const pct = (value: number) => (total > 0 ? `${(value / total) * 100}%` : "0%");
  return (
    <div
      role="img"
      aria-label={`${label}: ${formatNumber(approved)} aprovadas, ${formatNumber(rejected)} rejeitadas, de ${formatNumber(total)}`}
      className="flex h-2 overflow-hidden rounded-full bg-[var(--line)]"
    >
      <span style={{ width: pct(approved), backgroundColor: "var(--favor)" }} />
      <span style={{ width: pct(rejected), backgroundColor: "var(--contra)" }} />
    </div>
  );
}

/** A party's votes on others' proposals: favour, abstention, against. */
export function SharesBar({ shares, label }: { shares: { favor: number; abstention: number; against: number }; label: string }) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${shares.favor}% a favor, ${shares.abstention}% abstenção, ${shares.against}% contra`}
      className="flex h-2 overflow-hidden rounded-full bg-[var(--line)]"
    >
      <span style={{ width: `${shares.favor}%`, backgroundColor: CHOICE_COLORS.favor }} />
      <span style={{ width: `${shares.abstention}%`, backgroundColor: CHOICE_COLORS.abstention }} />
      <span style={{ width: `${shares.against}%`, backgroundColor: CHOICE_COLORS.against }} />
    </div>
  );
}
