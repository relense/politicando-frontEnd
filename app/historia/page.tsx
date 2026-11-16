import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PartyLogo } from "@/components/PartyLogo";
import { ApiError, getGovernmentHistory, getTimeline } from "@/lib/api/client";
import { electionPath } from "@/lib/elections";
import { formatDate, formatLongDate } from "@/lib/format";
import {
  daysLabel,
  decadeTicks,
  durationLabel,
  END_LABELS,
  endOf,
  endTone,
  historyStats,
  REVOLUTION,
  spanOnAxis,
  timelineByDecade,
  type EndTone,
} from "@/lib/history";
import { partyColor } from "@/lib/parliament";
import type { GovernmentHistory, HistoricalGovernment, TimelineEvent } from "@/lib/types";

export const metadata: Metadata = {
  title: "História",
  description: "Os governos de Portugal desde o 25 de Abril de 1974: quem governou, com que partidos, quanto tempo durou e como acabou.",
  alternates: { canonical: "/historia" },
};

/** Null while the API does not serve the history yet, so the page can say so calmly. */
async function loadHistory(): Promise<GovernmentHistory | null> {
  try {
    return await getGovernmentHistory();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Legislativas decide governments and presidenciais the President; the other elections would crowd the line. */
const SHOWN_ELECTIONS = /^(Legislativas|Presidenciais)\b/;

export default async function HistoryPage() {
  await connection();
  const [history, events] = await Promise.all([loadHistory(), getTimeline().catch((): TimelineEvent[] => [])]);
  const today = new Date().toISOString().slice(0, 10);

  const header = (
    <header className="mb-8">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Desde o 25 de Abril de 1974</p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Os governos da democracia</h1>
    </header>
  );

  if (!history || history.governments.length === 0) {
    return (
      <div>
        {header}
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          A história dos governos estará disponível em breve.
        </p>
      </div>
    );
  }

  const { governments } = history;
  const stats = historyStats(governments);
  const presidents = events.filter((event) => event.kind === "president");
  const decades = timelineByDecade(
    governments,
    events.filter((event) => event.kind === "president" || SHOWN_ELECTIONS.test(event.title)),
  );

  return (
    <div>
      {header}
      <p className="-mt-4 mb-8 max-w-2xl leading-relaxed text-muted">
        Depois da revolução houve {stats.provisional} governos provisórios, até à Constituição de 1976. Desde então, {stats.constitutional}{" "}
        governos constitucionais, cada um nomeado pelo Presidente da República depois de eleições ou da queda do anterior. Um governo
        constitucional que já terminou durou, em média, {daysLabel(stats.averageDays)}.
      </p>

      <section aria-labelledby="resumo" className="mb-10">
        <h2 id="resumo" className="sr-only">
          Em resumo
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact
            value={String(stats.total)}
            label="governos desde 1974"
            note={`${stats.provisional} provisórios, ${stats.constitutional} constitucionais`}
          />
          <Fact value={`${stats.lasted} de ${stats.ended}`} label="cumpriram a legislatura" note="dos constitucionais que já terminaram" />
          <Fact value={String(stats.fell)} label="caíram no Parlamento" note="moção de censura, de confiança ou programa rejeitado" />
          {stats.longest && (
            <Fact
              value={daysLabel(stats.longest.days)}
              label="o mais longo"
              note={`${stats.longest.primeMinister}, ${stats.longest.name.replace(" Governo Constitucional", "")}`}
            />
          )}
        </dl>
      </section>

      <Overview governments={governments} presidents={presidents} today={today} />

      <section aria-labelledby="governo-a-governo" className="mt-12">
        <h2 id="governo-a-governo" className="mb-6 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          Governo a governo
        </h2>
        {decades.map((decade) => (
          <section key={decade.label} aria-labelledby={`decada-${decade.label}`} className="mb-10">
            <h3 id={`decada-${decade.label}`} className="mb-4 text-2xl font-bold">
              {decade.label}
            </h3>
            <ol className="relative ml-2 border-l-2 border-line">
              {decade.entries.map((entry) =>
                entry.kind === "government" ? (
                  <GovernmentEntry key={entry.government.code} government={entry.government} today={today} />
                ) : (
                  <EventEntry key={`${entry.event.kind}-${entry.event.date}-${entry.event.title}`} event={entry.event} />
                ),
              )}
            </ol>
          </section>
        ))}
      </section>

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: datas segundo a lista de chefes do Governo do{" "}
        {history.source ? (
          <a href={history.source} className="text-link underline" target="_blank" rel="noopener noreferrer">
            portal do Governo
          </a>
        ) : (
          "portal do Governo"
        )}
        ; partidos, apoio parlamentar e o fim de cada governo segundo o registo histórico, resumidos pela redação.
      </p>
    </div>
  );
}

function Fact({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="flex flex-col-reverse justify-end rounded-xl border border-line p-4">
      <dd className="mt-1 text-xs leading-snug text-muted">{note}</dd>
      <dt className="font-mono text-xs font-bold uppercase tracking-wider">{label}</dt>
      <dd className="text-2xl font-bold leading-tight">{value}</dd>
    </div>
  );
}

/** A party's colour, stripes of each partner for a coalition, hatching for the provisional governments. */
function fillOf(government: HistoricalGovernment): string {
  const colors = government.parties.map((party) => partyColor(party.slug));
  if (colors.length === 0) return "repeating-linear-gradient(135deg, var(--muted) 0 2px, transparent 2px 6px)";
  if (colors.length === 1) return colors[0]!;
  const stripe = 5;
  const stops = colors.map((color, index) => `${color} ${index * stripe}px ${(index + 1) * stripe}px`).join(", ");
  return `repeating-linear-gradient(135deg, ${stops})`;
}

const accentOf = (government: HistoricalGovernment) => (government.parties[0] ? partyColor(government.parties[0].slug) : "var(--line)");

/** Every government on one bar from the revolution to today, sized by how long it lasted, with the Presidents below. */
function Overview({ governments, presidents, today }: { governments: HistoricalGovernment[]; presidents: TimelineEvent[]; today: string }) {
  const ordered = [...governments].reverse();
  const legend = new Map<string, { label: string; fill: string }>();
  for (const government of ordered) {
    const key = government.parties.map((party) => party.slug).join("+") || "provisorio";
    if (legend.has(key)) continue;
    const label = government.parties.length === 0 ? "Provisório" : government.parties.map((party) => party.acronym).join(" + ");
    legend.set(key, { label, fill: fillOf(government) });
  }
  const summary = ordered
    .filter((item) => item.kind === "constitutional")
    .map((item) => `${item.primeMinister} (${item.parties.map((party) => party.acronym).join(" e ")}, ${daysLabel(item.days)})`)
    .join("; ");

  return (
    <figure className="rounded-2xl border border-line p-4 sm:p-5">
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-widest">De 1974 a hoje</span>
        <span className="font-mono text-xs text-muted">cada bloco é um governo, do tamanho do tempo que durou</span>
      </figcaption>
      <div role="img" aria-label={`Governos constitucionais, do primeiro ao atual: ${summary}.`}>
        <div className="relative h-12 overflow-hidden rounded-md bg-surface">
          {ordered.map((government) => {
            const { left, width } = spanOnAxis(government.start, endOf(government, today), REVOLUTION, today);
            return (
              <div
                key={government.code}
                title={`${government.name}: ${government.primeMinister}, ${durationLabel(government.start, endOf(government, today))}`}
                className="absolute inset-y-0 border-r border-paper"
                style={{ left: `${left}%`, width: `${width}%`, background: fillOf(government) }}
              />
            );
          })}
        </div>
        {presidents.length > 0 && (
          <div className="relative mt-1 h-6">
            {presidents.map((president, index) => {
              const { left, width } = spanOnAxis(president.date, president.endDate ?? today, REVOLUTION, today);
              return (
                <div
                  key={president.date}
                  title={president.title}
                  className={`absolute inset-y-0 flex items-center overflow-hidden rounded-sm border-r border-paper px-1.5 ${index % 2 ? "bg-line" : "bg-surface"}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="truncate font-mono text-[10px] text-ink">
                    <span className="sm:hidden">{presidentName(president.title).split(" ").at(-1)}</span>
                    <span className="hidden sm:inline">{presidentName(president.title)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="relative mt-1 h-5" aria-hidden="true">
          {decadeTicks(REVOLUTION, today).map((year) => {
            const { left } = spanOnAxis(`${year}-01-01`, `${year}-01-01`, REVOLUTION, today);
            return (
              <span key={year} className="absolute -translate-x-1/2 font-mono text-[11px] text-muted" style={{ left: `${left}%` }}>
                {year}
              </span>
            );
          })}
        </div>
      </div>
      <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {[...legend.values()].map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 font-mono text-xs">
            <span aria-hidden="true" className="size-3 rounded-sm border border-line" style={{ background: item.fill }} />
            {item.label}
          </li>
        ))}
        {presidents.length > 0 && <li className="font-mono text-xs text-muted">Por baixo: o Presidente da República</li>}
      </ul>
    </figure>
  );
}

const presidentName = (title: string) => title.replace(/^Presidente da República:\s*/, "");

const TONE_STYLES: Record<EndTone, string> = {
  lasted: "border-ink",
  fell: "border-danger text-danger",
  early: "border-dashed border-muted text-muted",
  current: "border-ink bg-ink text-paper",
  provisional: "border-dashed border-muted text-muted",
  unknown: "border-dashed border-muted text-muted",
};

function EndBadge({ government }: { government: HistoricalGovernment }) {
  if (!government.endReason) return null;
  const tone = endTone(government.endReason);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold ${TONE_STYLES[tone]}`}
    >
      {tone === "lasted" && <span aria-hidden="true">✓&nbsp;</span>}
      {END_LABELS[government.endReason]}
    </span>
  );
}

function GovernmentEntry({ government, today }: { government: HistoricalGovernment; today: string }) {
  const end = endOf(government, today);
  return (
    <li id={government.code} className="relative scroll-mt-24 pb-6 pl-6">
      <span
        aria-hidden="true"
        className="absolute -left-[7px] top-5 size-3 rounded-full ring-4 ring-paper"
        style={{ background: accentOf(government) }}
      />
      <article
        aria-labelledby={`${government.code}-nome`}
        className="rounded-2xl border border-t-4 border-line p-4 sm:p-5"
        style={{ borderTopColor: accentOf(government) }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs text-muted">{government.name}</p>
          <EndBadge government={government} />
        </div>
        <h4 id={`${government.code}-nome`} className="mt-1 text-xl font-bold leading-tight">
          {government.primeMinister}
        </h4>
        <p className="mt-1 font-mono text-xs text-muted">
          {formatDate(government.start)} → {government.end ? formatDate(government.end) : "hoje"} · {durationLabel(government.start, end)}
        </p>
        {(government.parties.length > 0 || government.support) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {government.parties.map((party) => (
              <span
                key={party.slug}
                className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-0.5 pr-2.5 font-mono text-xs font-bold"
              >
                <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
                {party.acronym}
              </span>
            ))}
            {government.support && government.kind === "constitutional" && <span className="text-sm text-muted">{government.support}</span>}
          </div>
        )}
        {government.endNote && <p className="mt-3 text-sm leading-relaxed">{government.endNote}</p>}
        {(government.current || government.portalUrl) && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
            {government.current && (
              <Link href="/governo" className="font-bold text-link underline">
                Quem governa agora →
              </Link>
            )}
            {government.portalUrl && (
              <a href={government.portalUrl} className="text-link underline" target="_blank" rel="noopener noreferrer">
                No portal do Governo
                <span className="sr-only"> (abre noutra janela)</span>
              </a>
            )}
          </p>
        )}
      </article>
    </li>
  );
}

function EventEntry({ event }: { event: TimelineEvent }) {
  const isPresident = event.kind === "president";
  return (
    <li className="relative pb-6 pl-6">
      <span aria-hidden="true" className="absolute -left-[6px] top-1.5 size-2.5 rounded-full border-2 border-muted bg-paper" />
      <p className="font-mono text-xs text-muted">{formatLongDate(event.date)}</p>
      <p className="font-bold">{isPresident ? `${presidentName(event.title)} toma posse como Presidente da República` : event.title}</p>
      {event.detail && <p className="text-sm text-muted">{event.detail}</p>}
      {event.electionId && (
        <Link href={electionPath(event.electionId)} className="font-mono text-xs text-link underline">
          Ver resultados →
        </Link>
      )}
    </li>
  );
}
