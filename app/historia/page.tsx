import type { Metadata } from "next";
import { connection } from "next/server";
import { HistoryExplorer } from "@/components/HistoryExplorer";
import { ApiError, getGovernmentHistory, getTimeline } from "@/lib/api/client";
import { daysLabel, END_COLOR, END_LABELS, endTone, groupsOf, historyStats, TONE_COLOR, type HistoryGroup } from "@/lib/history";
import { partyColor } from "@/lib/parliament";
import type { GovernmentEndReason, GovernmentHistory, TimelineEvent } from "@/lib/types";

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

/** Legislativas decide governments and presidenciais the President; the other elections would crowd the list. */
const SHOWN_ELECTIONS = /^(Legislativas|Presidenciais)\b/;
const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";
const YEAR = 365.25;

const LED: { key: HistoryGroup; label: string; color: string }[] = [
  { key: "ps", label: "PS (sozinho ou em coligação)", color: partyColor("ps") },
  { key: "psd", label: "PSD (sozinho ou em coligação)", color: partyColor("psd") },
  { key: "presidential", label: "Iniciativa presidencial", color: "var(--stage-president)" },
  { key: "provisional", label: "Governos provisórios", color: "var(--muted)" },
];

const oneDecimal = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default async function HistoryPage() {
  await connection();
  const [history, events] = await Promise.all([loadHistory(), getTimeline().catch((): TimelineEvent[] => [])]);
  const today = new Date().toISOString().slice(0, 10);

  const header = (
    <header className="mb-6">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Desde o 25 de Abril de 1974</p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
        Os governos da <span className={MARKER}>democracia</span>
      </h1>
    </header>
  );

  if (!history || history.governments.length === 0) {
    return (
      <div data-wide>
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
  const elections = events.filter((event) => event.kind === "election" && SHOWN_ELECTIONS.test(event.title));

  // Years in power by who led the government; a coalition counts for the party that led it.
  const led = LED.map((item) => ({
    ...item,
    years:
      governments.filter((government) => groupsOf(government).includes(item.key)).reduce((sum, government) => sum + government.days, 0) /
      YEAR,
  })).filter((item) => item.years > 0);
  const mostYears = Math.max(...led.map((item) => item.years), 1);

  // How the constitutional governments ended, most common first; the one in office last.
  const endings = new Map<GovernmentEndReason, number>();
  for (const government of governments) {
    if (government.kind !== "constitutional" || !government.endReason) continue;
    endings.set(government.endReason, (endings.get(government.endReason) ?? 0) + 1);
  }
  const endingList = [...endings].sort((a, b) => (a[0] === "in_office" ? 1 : b[0] === "in_office" ? -1 : b[1] - a[1]));
  const endingTotal = endingList.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div data-wide>
      {header}
      <p className="-mt-4 mb-6 max-w-2xl leading-relaxed text-muted">
        Depois da revolução houve {stats.provisional} governos provisórios, até à Constituição de 1976. Desde então, {stats.constitutional}{" "}
        governos constitucionais, cada um nomeado pelo Presidente da República depois de eleições ou da queda do anterior.
      </p>

      <section aria-labelledby="resumo" className="mb-6">
        <h2 id="resumo" className="sr-only">
          Em resumo
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact
            value={String(stats.total)}
            label="governos desde 1974"
            note={`${stats.provisional} provisórios, ${stats.constitutional} constitucionais`}
          />
          <Fact
            value={`${stats.lasted} de ${stats.ended}`}
            label="cumpriram a legislatura"
            note="dos constitucionais que já terminaram"
            color={TONE_COLOR.lasted}
          />
          <Fact
            value={String(stats.fell)}
            label="caíram no Parlamento"
            note="moção de censura, de confiança ou programa rejeitado"
            color={TONE_COLOR.fell}
          />
          <Fact
            value={daysLabel(stats.averageDays)}
            label="duração média"
            note="de um governo constitucional que já terminou"
            color="var(--stage-debate)"
          />
        </dl>
      </section>

      <HistoryExplorer governments={governments} presidents={presidents} elections={elections} today={today}>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="mais-tempo" className="rounded-2xl border border-line p-4 sm:p-5">
            <h2 id="mais-tempo" className="font-mono text-xs font-bold uppercase tracking-widest">
              Quem governou mais tempo
            </h2>
            <p className="mt-1 text-sm text-muted">Anos de governo desde 1974, pelo partido do Primeiro-Ministro.</p>
            <ul className="mt-4 space-y-3">
              {led.map((item) => (
                <li key={item.key}>
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-bold">
                      <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="whitespace-nowrap font-mono text-sm font-bold">{oneDecimal.format(item.years)} anos</span>
                  </p>
                  <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-surface">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(item.years / mostYears) * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[11px] text-muted">O Bloco Central (PS e PSD) conta para o PS, que o liderou.</p>
          </section>

          <section aria-labelledby="como-acabaram" className="rounded-2xl border border-line p-4 sm:p-5">
            <h2 id="como-acabaram" className="font-mono text-xs font-bold uppercase tracking-widest">
              Como acabaram os governos
            </h2>
            <p className="mt-1 text-sm text-muted">Os {endingTotal} governos constitucionais, pelo que os fez terminar.</p>
            <div aria-hidden="true" className="mt-4 flex h-3 overflow-hidden rounded-full">
              {endingList.map(([reason, count]) => (
                <span
                  key={reason}
                  className="border-r border-paper last:border-0"
                  style={{ width: `${(count / endingTotal) * 100}%`, backgroundColor: END_COLOR[reason] }}
                />
              ))}
            </div>
            <ul className="mt-3 divide-y divide-line">
              {endingList.map(([reason, count]) => (
                <li key={reason} className="flex items-center gap-2 py-1.5 text-sm">
                  <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: END_COLOR[reason] }} />
                  <span className="flex-1">
                    {END_LABELS[reason]}
                    {endTone(reason) === "fell" && <span className="ml-2 font-mono text-[11px] text-muted">caiu no Parlamento</span>}
                  </span>
                  <span className="font-mono text-sm font-bold">{count}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </HistoryExplorer>

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

function Fact({ value, label, note, color }: { value: string; label: string; note: string; color?: string }) {
  return (
    <div
      className="flex flex-col-reverse justify-end rounded-2xl border border-line p-4"
      style={
        color
          ? {
              borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${color} 7%, transparent)`,
            }
          : undefined
      }
    >
      <dd className="mt-1 text-xs leading-snug text-muted">{note}</dd>
      <dt className="font-mono text-[11px] font-bold uppercase tracking-wider" style={color ? { color } : undefined}>
        {label}
      </dt>
      <dd className="text-3xl font-bold leading-tight">{value}</dd>
    </div>
  );
}
