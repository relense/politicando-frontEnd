import type { Metadata } from "next";
import { ScrollToTop } from "@/components/ScrollToTop";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { cache } from "react";
import { proposedBy } from "@/components/InitiativeItem";
import { RelativeTime } from "@/components/RelativeTime";
import { ApiError } from "@/lib/api/client";
import { getPresidency, type Presidency } from "@/lib/api/presidency";
import { formatDate, formatLongDate, formatNumber } from "@/lib/format";
import { headlineOf, initiativePath, presidencyLabel, toneColor, type StageTone } from "@/lib/initiatives";
import { partyColor } from "@/lib/parliament";
import { SITE_URL } from "@/lib/site";
import type { Initiative } from "@/lib/types";

/** The Presidency's photo store, which the image optimiser accepts (next.config.ts). */
const PRESIDENCY_PHOTO = /^https:\/\/www\.presidencia\.pt\/media\//;
/** Paragraphs of the biography shown before "Ler a biografia completa". */
const BIO_LEAD = 2;

/** Null while the API doesn't serve the Presidency yet, so the page can say so calmly. */
const loadPresidency = cache(async (): Promise<Presidency | null> => {
  try {
    return await getPresidency();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadPresidency();
  const name = data?.president.name;
  return {
    title: name ? `${name}, Presidente da República` : "Presidente da República",
    description: name
      ? `${name}, Presidente da República: biografia, leis promulgadas e vetadas, o que está à espera de decisão e as notícias.`
      : "O Presidente da República: o que faz, as leis que promulgou e vetou, e as notícias.",
    alternates: { canonical: "/presidente" },
  };
}

function jsonLd({ president }: Presidency) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: president.name,
    alternateName: president.fullName !== president.name ? president.fullName : undefined,
    jobTitle: "Presidente da República Portuguesa",
    image: president.photoUrl ?? undefined,
    url: `${SITE_URL}/presidente`,
    sameAs: president.url ? [president.url] : undefined,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const POWERS: { title: string; text: string; icon: string; tone: StageTone }[] = [
  {
    title: "Promulga ou veta as leis",
    icon: "M5 10.5l3.5 3.5L15 6.5",
    tone: "law",
    text: "As leis aprovadas no Parlamento só entram em vigor depois de o Presidente as promulgar. Se discordar, pode vetá-las: voltam ao Parlamento, que as pode confirmar por maioria absoluta dos deputados (em alguns casos, dois terços). Nesse caso, o Presidente é obrigado a promulgar.",
  },
  {
    title: "Pode pedir ao Tribunal Constitucional",
    icon: "M10 3v14M4 7h12M4 7l-2 5h4zM16 7l-2 5h4zM6 17h8",
    tone: "submitted",
    text: "Antes de decidir, pode enviar uma lei ao Tribunal Constitucional para verificar se respeita a Constituição. Se o Tribunal disser que não, o Presidente tem de a vetar.",
  },
  {
    title: "Nomeia o Primeiro-Ministro",
    icon: "M10 9a3 3 0 100-6 3 3 0 000 6zM4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5",
    tone: "debate",
    text: "Depois das eleições legislativas, ouve os partidos e nomeia o Primeiro-Ministro tendo em conta os resultados. O Governo responde perante o Parlamento.",
  },
  {
    title: "Pode dissolver o Parlamento",
    icon: "M3 8l7-4 7 4M5 8v7M10 8v7M15 8v7M3 17h14",
    tone: "stopped",
    text: "Pode dissolver a Assembleia da República e marcar eleições antecipadas, depois de ouvir os partidos e o Conselho de Estado. Não o pode fazer nos seis meses depois de eleições nem no último semestre do seu mandato.",
  },
];

/** Days the Constitution gives the President to promulgate or veto a decree of Parliament (art. 136). */
const DECISION_DAYS = 20;
const DAY = 86_400_000;
/** The time of this request; the page is rendered per request (connection()), so it is today's. */
const requestTime = () => Date.now();

const tinted = (tone: StageTone, amount = 14) => ({
  color: toneColor(tone),
  backgroundColor: `color-mix(in srgb, ${toneColor(tone)} ${amount}%, transparent)`,
});

export default async function PresidentPage() {
  await connection();
  const data = await loadPresidency();

  if (!data) {
    return (
      <div data-wide>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">Presidente</span>{" "}
          da República
        </h1>
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Esta página ainda não está disponível. Volta em breve.
        </p>
      </div>
    );
  }

  const { president, legislation, former } = data;
  const now = requestTime();
  const lead = president.bio.slice(0, BIO_LEAD);
  const rest = president.bio.slice(BIO_LEAD);
  const born = president.birthDate ? atNoon(president.birthDate) : null;
  const facts = [
    born && !Number.isNaN(born.getTime()) ? { label: "Nasceu", value: shortDate(born) } : null,
    president.birthPlace ? { label: "Natural de", value: president.birthPlace } : null,
    president.residence ? { label: "Reside em", value: president.residence } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <article data-wide>
      <ScrollToTop id="presidente" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />

      <header className="mb-6">
        <p className="mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold"
            style={tinted("president")}
          >
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: toneColor("president") }} />
            Chefe de Estado
          </span>
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          O{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">Presidente</span>{" "}
          da República
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Quem é, que leis do Parlamento promulgou e vetou neste mandato, e o que está à espera da sua decisão.
        </p>
      </header>

      <section
        aria-label={president.name}
        className="grid overflow-hidden rounded-2xl border border-line md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
      >
        <figure className="relative bg-surface">
          {president.photoUrl ? (
            <Image
              src={president.photoUrl}
              alt={`Fotografia oficial de ${president.name}`}
              width={704}
              height={469}
              sizes="(min-width: 768px) 18rem, 100vw"
              unoptimized={!PRESIDENCY_PHOTO.test(president.photoUrl)}
              priority
              className="aspect-[3/2] h-full w-full object-cover md:aspect-auto"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex aspect-[3/2] h-full w-full items-center justify-center text-5xl font-bold text-muted md:aspect-auto"
            >
              {initials(president.name)}
            </div>
          )}
          {president.photoUrl && (
            <figcaption className="absolute bottom-2 left-2 rounded bg-paper/85 px-1.5 py-0.5 font-mono text-[10px] text-muted">
              Fotografia oficial · presidencia.pt
            </figcaption>
          )}
        </figure>
        <div className="flex flex-col justify-center p-5 sm:p-7">
          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{president.name}</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Presidente da República desde <time dateTime={president.termStart}>{formatLongDate(president.termStart)}</time>
          </p>
          {president.fullName !== president.name && (
            <p className="mt-1 font-mono text-xs text-muted">Nome completo: {president.fullName}</p>
          )}
          <TermBar start={president.termStart} now={now} />
        </div>
      </section>

      <section aria-labelledby="leis" className="mt-10">
        <h2 id="leis" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          As leis do Parlamento neste mandato
        </h2>
        <LawsSummary legislation={legislation} termStart={president.termStart} />

        <Pending items={legislation.pendingNow} total={legislation.pending} now={now} />

        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <DecisionGroup
            id="vetos"
            title="Vetos"
            count={legislation.vetoed}
            items={legislation.latestVetoes}
            empty="Ainda não vetou nenhuma lei."
            more={{ status: "vetoed", label: "Ver todos os vetos" }}
          />
          <DecisionGroup
            id="promulgadas"
            title="Promulgadas recentemente"
            count={legislation.promulgated}
            items={legislation.latestPromulgated.slice(0, Math.max(3, legislation.latestVetoes.length + 1))}
            empty="Ainda não promulgou nenhuma lei."
            more={{ status: "promulgated", label: "Ver todas as leis publicadas" }}
          />
        </div>
      </section>

      <section aria-labelledby="o-que-faz" className="mt-14">
        <h2 id="o-que-faz" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          O que faz o Presidente da República
        </h2>
        <p className="max-w-3xl text-lg leading-relaxed">
          É o chefe de Estado, eleito diretamente por cinco anos, no máximo dois mandatos seguidos. Não governa: quem governa é o Governo,
          que responde perante o Parlamento. O seu poder do dia a dia é sobre as leis.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {POWERS.map((power) => (
            <li key={power.title} className="rounded-2xl border border-line p-5">
              <span aria-hidden="true" className="mb-4 flex size-9 items-center justify-center rounded-lg" style={tinted(power.tone, 18)}>
                <svg
                  viewBox="0 0 20 20"
                  className="size-5 fill-none stroke-current stroke-[1.6]"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={power.icon} />
                </svg>
              </span>
              <h3 className="font-bold leading-snug">{power.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{power.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="biografia">
          <h2 id="biografia" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
            Biografia
          </h2>
          {facts.length > 0 && (
            <dl className="mb-5 grid gap-3 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-line px-4 py-3">
                  <dt className="font-mono text-[11px] text-muted">{fact.label}</dt>
                  <dd className="mt-0.5 font-mono font-bold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-col gap-3 leading-relaxed">
            {lead.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {rest.length > 0 && (
            <details className="mt-4">
              <summary className="inline-block cursor-pointer rounded-full border border-ink px-4 py-1.5 font-mono text-sm font-bold hover:bg-surface">
                Ler a biografia completa
              </summary>
              <div className="mt-4 flex flex-col gap-3 leading-relaxed">
                {rest.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </details>
          )}
          {president.url && (
            <p className="mt-4 font-mono text-xs text-muted">
              Biografia oficial:{" "}
              <a href={president.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                presidencia.pt<span className="sr-only"> (abre num novo separador)</span>
              </a>
            </p>
          )}
        </section>

        <aside>
          {data.articles.length > 0 && (
            <section aria-labelledby="noticias">
              <h2 id="noticias" className="mb-2 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                Nas notícias
              </h2>
              <ul className="divide-y divide-line">
                {data.articles.slice(0, 5).map((article) => (
                  <li key={article.id} className="py-3">
                    <Link href={`/article/${article.id}`} className="font-bold leading-snug hover:underline">
                      {article.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {article.source} · <RelativeTime value={article.publishedAt} />
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {former.length > 0 && (
            <section aria-labelledby="anteriores" className="mt-8">
              <h2 id="anteriores" className="mb-2 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                Presidentes anteriores
              </h2>
              <ul className="divide-y divide-line">
                {former.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                    <span className="font-bold">{item.name}</span>
                    <span className="font-mono text-xs text-muted">
                      {item.termStart.slice(0, 4)}–{item.termEnd?.slice(0, 4) ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-sm">
                <Link href="/historia" className="text-link underline">
                  Os Presidentes e os governos desde 1974
                </Link>
              </p>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)![0] : ""}`.toUpperCase();
};

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const atNoon = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`);
const shortDate = (date: Date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** How far into the five-year term: months gone, the years marked along the way. */
function TermBar({ start, now }: { start: string; now: number }) {
  const from = atNoon(start);
  if (Number.isNaN(from.getTime())) return null;
  const to = new Date(from);
  to.setUTCFullYear(from.getUTCFullYear() + 5);
  const span = to.getTime() - from.getTime();
  const share = Math.min(1, Math.max(0, (now - from.getTime()) / span));
  const months = Math.max(0, Math.floor(share * 60));
  const years = Array.from({ length: 5 }, (_, index) => from.getUTCFullYear() + index + 1);
  const at = (date: Date) => `${((date.getTime() - from.getTime()) / span) * 100}%`;

  return (
    <div className="mt-6">
      <p className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs">
        <span>
          <span className="font-bold">Mandato:</span> {months === 1 ? "1 mês" : `${months} meses`} de 5 anos
        </span>
        <span className="text-muted">
          até {MONTHS[to.getUTCMonth()]!.replace(".", "")} de {to.getUTCFullYear()}
        </span>
      </p>
      <div
        role="meter"
        aria-label="Tempo de mandato cumprido"
        aria-valuemin={0}
        aria-valuemax={60}
        aria-valuenow={months}
        aria-valuetext={`${months} de 60 meses`}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"
      >
        <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: toneColor("president") }} />
      </div>
      <div aria-hidden="true" className="relative mt-1.5 hidden h-4 font-mono text-[10px] text-muted sm:block">
        <span className="absolute left-0">{shortDate(from)}</span>
        {years.map((year) => {
          const jan = new Date(Date.UTC(year, 0, 1, 12));
          return jan < to ? (
            <span key={year} className="absolute -translate-x-1/2" style={{ left: at(jan) }}>
              {year}
            </span>
          ) : null;
        })}
      </div>
    </div>
  );
}

/** One bar for every decree that reached Belém, split by what the President did, and the three figures beside it. */
function LawsSummary({ legislation, termStart }: { legislation: Presidency["legislation"]; termStart: string }) {
  const parts: { key: string; value: number; label: string; tone: StageTone }[] = [
    {
      key: "promulgated",
      value: legislation.promulgated,
      label: legislation.promulgated === 1 ? "promulgada" : "promulgadas",
      tone: "law",
    },
    { key: "vetoed", value: legislation.vetoed, label: legislation.vetoed === 1 ? "veto" : "vetos", tone: "stopped" },
    { key: "pending", value: legislation.pending, label: "à espera", tone: "president" },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <>
      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
            {parts.map((part) =>
              part.value > 0 ? (
                <span
                  key={part.key}
                  className="h-full min-w-1.5"
                  style={{ width: `${(part.value / Math.max(total, 1)) * 100}%`, backgroundColor: toneColor(part.tone) }}
                />
              ) : null,
            )}
          </div>
          <p className="mt-2 text-sm">
            <span className="font-bold">{formatNumber(total)}</span>{" "}
            {total === 1 ? "decreto da Assembleia da República chegou" : "decretos da Assembleia da República chegaram"} a Belém.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 md:w-[24rem]">
          {parts.map((part) => (
            <div
              key={part.key}
              className="flex flex-col-reverse justify-end rounded-xl border px-3 py-2.5"
              style={{
                borderColor: `color-mix(in srgb, ${toneColor(part.tone)} 45%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${toneColor(part.tone)} 10%, transparent)`,
              }}
            >
              <dt className="font-mono text-xs font-bold" style={{ color: toneColor(part.tone) }}>
                {part.label}
              </dt>
              <dd className="text-3xl font-bold tabular-nums">{formatNumber(part.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      {legislation.allTime && <AllTime allTime={legislation.allTime} termStart={termStart} />}
      <p className="mt-3 text-xs text-muted">
        Só decretos da Assembleia da República. Os vetos incluem leis que o Parlamento voltou a aprovar. Os decretos do Governo ainda não
        estão incluídos.
      </p>
    </>
  );
}

/** What is on the President's desk now, with the days left of the twenty the Constitution gives. */
function Pending({ items, total, now }: { items: Initiative[]; total: number; now: number }) {
  const color = toneColor("president");
  return (
    <section
      aria-labelledby="pendentes"
      className="mt-8 rounded-2xl border p-5 sm:p-6"
      style={{
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 6%, transparent)`,
      }}
    >
      <h3 id="pendentes" className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color }}>
        Na secretária do Presidente · {formatNumber(total)}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-muted">Nada à espera de decisão agora.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((initiative) => (
            <li key={initiative.id} className="py-4 last:pb-0">
              <PendingItem initiative={initiative} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingItem({ initiative, now }: { initiative: Initiative; now: number }) {
  const presidency = initiative.presidency;
  const daysSince = (date: string | null | undefined) => {
    const from = date ? atNoon(date) : null;
    return from && !Number.isNaN(from.getTime()) ? Math.max(0, Math.floor((now - from.getTime()) / DAY)) : null;
  };
  const days = daysSince(presidency?.sentAt);
  // Past the twenty days the clock may well be stopped: a request to the Constitutional Court stops it, and the
  // Parliament's record doesn't show those requests. So it just waits, never "late".
  const counting = days !== null && days <= DECISION_DAYS;
  const color = toneColor("president");
  const options = [
    { label: "Promulga", tone: "law" as const, mark: "✓" },
    { label: "Veta", tone: "stopped" as const, mark: "✕" },
    { label: "Envia ao Tribunal Constitucional", tone: "submitted" as const, mark: "→" },
  ];

  return (
    <article>
      <p className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs text-muted">
        <span>
          {initiative.type}
          {initiative.number && ` · n.º ${initiative.number}`}
        </span>
        {initiative.presidency?.sentAt && <span>Chegou a Belém a {formatDate(initiative.presidency.sentAt)}</span>}
      </p>
      <h4 className="mt-2 text-xl font-bold leading-snug sm:text-2xl">
        <Link href={initiativePath(initiative.id)} className="hover:underline">
          {headlineOf(initiative)}
        </Link>
      </h4>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        {counting ? (
          <div>
            <p className="flex justify-between gap-2 font-mono text-xs">
              <span className="font-bold">Prazo para decidir</span>
              <span style={{ color }}>
                dia {days} de {DECISION_DAYS}
              </span>
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              <span className="block h-full rounded-full" style={{ width: `${(days / DECISION_DAYS) * 100}%`, backgroundColor: color }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              A Constituição dá {DECISION_DAYS} dias para promulgar ou vetar um decreto do Parlamento.
            </p>
          </div>
        ) : (
          <div>
            <p className="font-mono text-xs">
              <span className="rounded-full px-2.5 py-1 font-bold" style={tinted("president")}>
                À espera de decisão
              </span>
            </p>
            <p className="mt-2 text-xs text-muted">
              A Constituição dá {DECISION_DAYS} dias para promulgar ou vetar. O prazo para quando o Presidente pede ao Tribunal
              Constitucional que verifique a lei, e o registo do Parlamento não mostra esses pedidos.
            </p>
          </div>
        )}
        <ul aria-label="O que pode fazer" className="flex flex-wrap gap-1.5 font-mono text-[11px] font-bold">
          {options.map((option) => (
            <li key={option.label} className="rounded-full px-2.5 py-1" style={tinted(option.tone)}>
              <span aria-hidden="true">{option.mark} </span>
              {option.label}
            </li>
          ))}
        </ul>
      </div>
      <Authors initiative={initiative} className="mt-4" />
    </article>
  );
}

function Authors({ initiative, className = "" }: { initiative: Initiative; className?: string }) {
  const { authors } = initiative;
  const chips = authors.other
    ? [{ key: "other", label: authors.other, color: "var(--ink)" }]
    : authors.parties.map((party) => ({ key: party.slug, label: party.acronym, color: partyColor(party.slug) }));
  if (chips.length === 0 && initiative.topics.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 font-mono text-[11px] ${className}`}>
      {chips.map((chip) => (
        <li key={chip.key} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: chip.color }} />
          {chip.label}
        </li>
      ))}
      {initiative.topics.slice(0, 2).map((topic) => (
        <li key={topic.slug} className="rounded-full border border-line px-2.5 py-0.5 text-muted">
          # {topic.label}
        </li>
      ))}
    </ul>
  );
}

const DECISION_TONE: Record<string, StageTone> = {
  vetoed: "stopped",
  promulgated: "law",
  pending: "president",
};

function DecisionGroup({
  id,
  title,
  count,
  items,
  empty,
  more,
}: {
  id: string;
  title: string;
  count: number;
  items: Initiative[];
  empty: string;
  more: { status: "vetoed" | "promulgated"; label: string };
}) {
  return (
    <section aria-labelledby={id}>
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h3 id={id} className="font-mono text-sm font-bold uppercase tracking-widest">
          {title}
        </h3>
        <span className="font-mono text-sm font-bold" style={{ color: toneColor(DECISION_TONE[more.status]!) }}>
          {formatNumber(count)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-muted">{empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {items.map((initiative) => (
              <li key={initiative.id} className="py-4">
                <DecisionItem initiative={initiative} />
              </li>
            ))}
          </ul>
          {/* Only when there are more than these: a veto Parliament overrode is no longer in the "Vetada" phase. */}
          {count > items.length && (
            <Link
              href={`/iniciativas?fase=${more.status === "vetoed" ? "vetoed" : "published"}`}
              className="mt-2 inline-block rounded-full border border-ink px-4 py-1.5 font-mono text-sm font-bold hover:bg-surface"
            >
              {more.label}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

/** A decided law, in a few lines: what the President did, what it is, who proposed it. */
function DecisionItem({ initiative }: { initiative: Initiative }) {
  const { presidency } = initiative;
  const tone = DECISION_TONE[presidency?.status ?? "pending"]!;
  // When the promulgation isn't in the Parliament's record, the date shown is the publication's.
  const when =
    presidency?.status === "vetoed" ? presidency.vetoedAt : (presidency?.promulgatedAt ?? initiative.publishedAt ?? initiative.phaseDate);
  return (
    <article>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        {presidency && (
          <span className="rounded-full px-2 py-0.5 font-bold" style={tinted(tone)}>
            {presidencyLabel(presidency)}
          </span>
        )}
        <span>
          {initiative.type} · {proposedBy(initiative)}
          {initiative.number && ` · n.º ${initiative.number}`}
        </span>
        {when && <span className="ml-auto">{formatDate(when)}</span>}
      </p>
      <h4 className="mt-2 text-lg font-bold leading-snug">
        <Link href={initiativePath(initiative.id)} className="hover:underline">
          {headlineOf(initiative)}
        </Link>
      </h4>
      <Authors initiative={initiative} className="mt-2" />
    </article>
  );
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Every President since the data starts: "Desde julho de 2025", never "desde sempre". */
function AllTime({ allTime, termStart }: { allTime: NonNullable<Presidency["legislation"]["allTime"]>; termStart: string }) {
  const since = allTime.since ? atNoon(allTime.since) : null;
  const from =
    since && !Number.isNaN(since.getTime()) ? `Desde ${MONTH_NAMES[since.getUTCMonth()]} de ${since.getUTCFullYear()}` : "No total";
  const unconstitutional = allTime.vetoedUnconstitutional;
  return (
    <p className="mt-3 font-mono text-xs">
      <span className="font-bold">{from}</span>
      {allTime.since && allTime.since < termStart ? ", contando com o Presidente anterior" : ""}: {formatNumber(allTime.promulgated)}{" "}
      promulgadas e {formatNumber(allTime.vetoed)} {allTime.vetoed === 1 ? "veto" : "vetos"}
      {unconstitutional ? `, ${formatNumber(unconstitutional)} ${unconstitutional === 1 ? "dele" : "deles"} por inconstitucionalidade` : ""}
      .
    </p>
  );
}
