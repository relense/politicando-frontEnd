import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AddToCalendar } from "@/components/AddToCalendar";
import { PartyLogo } from "@/components/PartyLogo";
import { AGENDA_KINDS, DISTRICTS, isAgendaKind, KIND_LABELS, mapUrl, placeLabel, type AgendaItem, type AgendaKind } from "@/lib/agenda";
import { getAgenda } from "@/lib/api/agenda";
import { getElectionsMenu } from "@/lib/api/client";
import { formatDayHeading, formatLongDate, formatTime, lisbonDay } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import type { UpcomingElection } from "@/lib/types";

/** The time of this request, for "Hoje" and "Amanhã". */
const requestTime = () => Date.now();

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const metadata: Metadata = {
  title: "Agenda política",
  description:
    "O que vem aí na política portuguesa: sessões do Parlamento, audições, conselhos de ministros, congressos, assembleias municipais e eleições, com onde e como assistir.",
  alternates: { canonical: "/agenda" },
};

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

type Filter = { kinds: AgendaKind[]; district: string | null; open: boolean };

function filterOf(params: Record<string, string | string[] | undefined>): Filter {
  const kinds = (first(params.tipo) ?? "").split(",").filter(isAgendaKind);
  const district = DISTRICTS.find((name) => name === first(params.distrito)) ?? null;
  return { kinds: [...new Set(kinds)], district, open: first(params.aberto) === "1" };
}

function hrefOf(filter: Filter, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  if (filter.kinds.length > 0) query.set("tipo", filter.kinds.join(","));
  if (filter.district) query.set("distrito", filter.district);
  if (filter.open) query.set("aberto", "1");
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  return query.size > 0 ? `/agenda?${query.toString().replaceAll("%2C", ",")}` : "/agenda";
}

export default async function AgendaPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const filter = filterOf(params);
  const cursor = first(params.depois);
  const [page, menu] = await Promise.all([
    getAgenda({ kinds: filter.kinds, district: filter.district ?? undefined, open: filter.open, cursor }).catch(() => null),
    getElectionsMenu().catch(() => null),
  ]);
  const now = requestTime();
  const days = groupByDay(page?.items ?? []);
  const filtered = filter.kinds.length > 0 || filter.district !== null || filter.open;
  const chip = (pressed: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-bold ${
      pressed ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
    }`;

  return (
    <div data-wide className="pb-4">
      <header className="mb-6 max-w-3xl">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">O que vem aí</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Agenda <span className={MARKER}>política</span>
        </h1>
        <p className="mt-2 leading-relaxed text-muted">
          Sessões do Parlamento, audições, conselhos de ministros, congressos dos partidos, assembleias municipais e eleições. Muitas são
          abertas ao público: vê onde são, como assistir, e junta-as ao teu calendário.
        </p>
      </header>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {page && (
            <nav aria-label="Filtrar a agenda" className="mb-6 space-y-3">
              <ul aria-label="Tipo" className="flex flex-wrap gap-2">
                <li>
                  <Link
                    href={hrefOf({ ...filter, kinds: [] })}
                    aria-current={filter.kinds.length === 0 ? "true" : undefined}
                    className={chip(filter.kinds.length === 0)}
                  >
                    Tudo
                  </Link>
                </li>
                {AGENDA_KINDS.filter((kind) => kind !== "other").map((kind) => {
                  const pressed = filter.kinds.includes(kind);
                  const kinds = pressed ? filter.kinds.filter((item) => item !== kind) : [...filter.kinds, kind];
                  return (
                    <li key={kind}>
                      <Link href={hrefOf({ ...filter, kinds })} aria-current={pressed ? "true" : undefined} className={chip(pressed)}>
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: KIND_LABELS[kind].color }} />
                        {KIND_LABELS[kind].plural}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action="/agenda" className="flex flex-wrap items-center gap-3 font-mono text-xs">
                {filter.kinds.length > 0 && <input type="hidden" name="tipo" value={filter.kinds.join(",")} />}
                <label className="flex items-center gap-2">
                  Distrito
                  <select
                    name="distrito"
                    defaultValue={filter.district ?? ""}
                    className="rounded-full border border-line bg-paper px-3 py-1.5"
                  >
                    <option value="">Todo o país</option>
                    {DISTRICTS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="aberto" value="1" defaultChecked={filter.open} className="size-4 accent-[var(--ink)]" />
                  Só abertos ao público
                </label>
                <button type="submit" className="rounded-full bg-ink px-4 py-1.5 font-bold text-paper hover:opacity-90">
                  Aplicar
                </button>
                {filtered && (
                  <Link href="/agenda" className="text-muted underline hover:text-ink">
                    Limpar
                  </Link>
                )}
              </form>
            </nav>
          )}

          {!page ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              A agenda completa estará disponível em breve. Para já, ficam as próximas eleições.
            </p>
          ) : days.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              {filtered ? "Nada marcado com estes filtros." : "Nada marcado para os próximos dias."}
            </p>
          ) : (
            <>
              {page.total !== null && (
                <p className="mb-4 font-mono text-xs text-muted" aria-live="polite">
                  <b className="text-ink">{page.total === 1 ? "1 evento" : `${page.total} eventos`}</b> marcados
                  {filter.district ? ` · ${filter.district}` : ""}
                  {filter.open ? " · abertos ao público" : ""}
                </p>
              )}
              {days.map(({ day, items }) => (
                <section key={day} aria-labelledby={`dia-${day}`} className="mb-8">
                  <h2 id={`dia-${day}`} className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold">
                    {formatDayHeading(items[0]!.start.length === 10 ? `${day}T12:00:00Z` : items[0]!.start, now)}
                  </h2>
                  <ol className="space-y-3">
                    {items.map((item) => (
                      <li key={item.id} id={`evento-${item.id}`} className="scroll-mt-24">
                        <AgendaCard item={item} />
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              {page.nextCursor && (
                <Link
                  href={hrefOf(filter, { depois: page.nextCursor })}
                  className="block rounded-2xl border border-line p-3 text-center font-mono text-xs font-bold hover:bg-surface"
                >
                  Mais à frente →
                </Link>
              )}
            </>
          )}
        </div>

        <aside aria-label="Mais sobre a agenda" className="flex flex-col gap-4 xl:sticky xl:top-20">
          {menu && menu.upcoming.length > 0 && <UpcomingElections upcoming={menu.upcoming} />}
          <section aria-labelledby="como-assistir" className="rounded-2xl border border-line p-4 text-sm leading-relaxed">
            <h2 id="como-assistir" className="mb-2 font-mono text-xs font-bold uppercase tracking-widest">
              Como assistir
            </h2>
            <p>
              <b>Parlamento.</b> As sessões plenárias são públicas e podem ser vistas das galerias, com um documento de identificação.
              Grupos marcam a visita com antecedência. Também passam em direto no Canal Parlamento.
            </p>
            <p className="mt-2">
              <b>Câmaras e assembleias municipais.</b> As reuniões públicas têm um período aberto à intervenção de quem assiste: podes fazer
              perguntas aos eleitos do teu concelho.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function groupByDay(items: AgendaItem[]): { day: string; items: AgendaItem[] }[] {
  const days = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const day = item.allDay ? item.start.slice(0, 10) : (lisbonDay(item.start) ?? item.start.slice(0, 10));
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days].map(([day, list]) => ({ day, items: list }));
}

/** "14:30–17:00", "Todo o dia", or "Até 22 de novembro" for an event over several days. */
export function whenOf(item: AgendaItem): string {
  if (item.allDay) {
    const end = item.end?.slice(0, 10);
    // The year would wrap the narrow column; the day heading above already says it.
    return end && end !== item.start.slice(0, 10) ? `Até ${formatLongDate(end)?.replace(/ de \d{4}$/, "")}` : "Todo o dia";
  }
  const start = formatTime(item.start);
  const end = item.end && lisbonDay(item.end) === lisbonDay(item.start) ? formatTime(item.end) : null;
  return end ? `${start}–${end}` : (start ?? "");
}

function AgendaCard({ item }: { item: AgendaItem }) {
  const kind = KIND_LABELS[item.kind];
  const off = item.status !== "scheduled";
  return (
    <article
      aria-labelledby={`evento-${item.id}-titulo`}
      className="grid gap-3 rounded-2xl border border-l-4 border-line p-4 sm:grid-cols-[6.5rem_minmax(0,1fr)]"
      style={{ borderLeftColor: kind.color }}
    >
      <p className="font-mono text-sm font-bold">
        <time dateTime={item.start}>{whenOf(item)}</time>
      </p>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span
            className="rounded px-1.5 py-0.5 font-bold"
            style={{ color: kind.color, backgroundColor: `color-mix(in srgb, ${kind.color} 14%, transparent)` }}
          >
            {kind.label}
          </span>
          {item.status === "cancelled" && (
            <span className="rounded bg-[var(--stage-stopped)] px-1.5 py-0.5 font-bold text-paper">Cancelado</span>
          )}
          {item.status === "postponed" && (
            <span className="rounded bg-[var(--stage-debate)] px-1.5 py-0.5 font-bold text-paper">Adiado</span>
          )}
          {item.attend.open && !off && (
            <span className="rounded border border-[var(--stage-approved)] px-1.5 py-0.5 font-bold text-[var(--stage-approved)]">
              Aberto ao público
            </span>
          )}
          {item.organizer && !item.title.includes(item.organizer) && <span className="text-muted">{item.organizer}</span>}
        </p>
        <h3 id={`evento-${item.id}-titulo`} className={`mt-1 text-lg font-bold leading-snug ${off ? "line-through decoration-2" : ""}`}>
          {item.title}
        </h3>
        {item.summary && <p className="mt-1 whitespace-pre-line leading-relaxed">{item.summary}</p>}
        {item.place && (
          <p className="mt-2 text-sm">
            <span aria-hidden="true">📍 </span>
            <a href={mapUrl(item.place)} target="_blank" rel="noopener noreferrer" className="underline hover:text-link">
              {placeLabel(item.place)}
              <span className="sr-only"> (mapa, abre num novo separador)</span>
            </a>
          </p>
        )}
        {item.attend.how && (
          <p className="mt-1 text-sm text-muted">
            <b className="text-ink">Como assistir:</b> {item.attend.how}
            {item.attend.url && (
              <>
                {" "}
                <a href={item.attend.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                  Inscrição<span className="sr-only"> (abre num novo separador)</span>
                </a>
              </>
            )}
          </p>
        )}
        {item.parties.length > 0 && (
          <ul aria-label="Partidos" className="mt-2 flex flex-wrap gap-1.5">
            {item.parties.map((party) => (
              <li key={party.slug}>
                <Link
                  href={`/partido/${party.slug}`}
                  className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-0.5 pr-2.5 font-mono text-xs font-bold hover:bg-surface"
                >
                  <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-white">
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={16} />
                  </span>
                  {party.acronym}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!off && (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
            <AddToCalendar
              item={item}
              pageUrl={`${SITE_URL}/agenda#evento-${item.id}`}
              className="rounded-full border border-line px-3 py-1.5 font-bold hover:bg-surface"
            />
            {item.online && (
              <a href={item.online.url} target="_blank" rel="noopener noreferrer" className="font-bold text-link underline">
                Ver em direto{item.online.label ? ` · ${item.online.label}` : ""}
                <span className="sr-only"> (abre num novo separador)</span>
              </a>
            )}
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted underline hover:text-ink">
                Fonte<span className="sr-only"> (abre num novo separador)</span>
              </a>
            )}
          </p>
        )}
      </div>
    </article>
  );
}

function UpcomingElections({ upcoming }: { upcoming: UpcomingElection[] }) {
  return (
    <section aria-labelledby="proximas-eleicoes" className="rounded-2xl border border-line p-4">
      <h2 id="proximas-eleicoes" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
        Próximas eleições
      </h2>
      <ul className="space-y-3 text-sm">
        {upcoming.map((election) => (
          <li key={`${election.type}-${election.name}`}>
            <b>{election.name}</b>
            <span className="block font-mono text-[11px] text-muted">
              {election.date ? formatLongDate(election.date) : (election.window ?? "Data por marcar")}
              {!election.confirmed && election.date ? " · por confirmar" : ""}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/eleicoes" className="mt-3 inline-block font-mono text-xs font-bold text-link underline">
        Todas as eleições →
      </Link>
    </section>
  );
}
