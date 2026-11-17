import Link from "next/link";
import { getElections, getGovernment, getMostCommented, getInitiatives, getParliament, getParties } from "@/lib/api/client";
import { getPresidency } from "@/lib/api/presidency";
import { editorialPath, KIND_LABELS } from "@/lib/editorial";
import { listLabel, listName } from "@/lib/elections";
import { commentLinkLabel, formatLongDate, formatNumber, formatPercent } from "@/lib/format";
import { durationLabel } from "@/lib/history";
import { majority, partyColor, SEAT_ORDER } from "@/lib/parliament";
import { GovernmentPortrait } from "./GovernmentPortrait";
import type { Article, EditorialPost } from "@/lib/types";

export type PowerFigure = { label: string; value: string; href: string; color: string };
type Person = { name: string; photoUrl: string | null };
/** Who holds power, in plain words: each part is left out when its data is missing. */
export type PowerNowData = {
  president: (Person & { since: string }) | null;
  government: {
    name: string;
    duration: string | null;
    primeMinister: (Person & { party: string | null; color: string | null }) | null;
    /** The list that won the legislativas, when the Prime Minister's party is in it ("AD"). */
    from: string | null;
  } | null;
  election: {
    id: string;
    name: string;
    winner: string;
    label: string;
    color: string;
    pct: string | null;
    mandates: number | null;
    total: number;
  } | null;
  parliament: { groups: { acronym: string; seats: number; color: string }[]; total: number } | null;
  figures: PowerFigure[];
};
export type NewsSidebarData = { power: PowerNowData; mostCommented: Article[] };

const lisbonToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
const rank = (slug: string) => (SEAT_ORDER.includes(slug) ? SEAT_ORDER.indexOf(slug) : SEAT_ORDER.length);

/**
 * The figures beside the news, each from its own page's data. One that fails is left out, never the page.
 * The most commented: the last 24 hours' articles with at least one comment, from the API.
 */
export async function loadNewsSidebar(): Promise<NewsSidebarData> {
  const [presidency, initiatives, government, mostCommented, legislativas, parliament, parties] = await Promise.all([
    getPresidency().catch(() => null),
    getInitiatives({ limit: 1 }).catch(() => null),
    getGovernment().catch(() => null),
    getMostCommented(3).catch(() => []),
    getElections("legislativas").catch(() => null),
    getParliament().catch(() => null),
    getParties().catch(() => []),
  ]);
  const stage = (key: string) => initiatives?.stages.find((item) => item.key === key)?.count;
  const discussing =
    stage("submitted") !== undefined || stage("debate") !== undefined ? (stage("submitted") ?? 0) + (stage("debate") ?? 0) : null;
  const laws = stage("published") ?? null;

  const figures: (PowerFigure | null | false)[] = [
    presidency && {
      label: "na secretária do Presidente",
      value: formatNumber(presidency.legislation.pending),
      href: "/presidente",
      color: "var(--stage-president)",
    },
    discussing !== null && {
      label: "iniciativas em discussão",
      value: formatNumber(discussing),
      href: "/iniciativas?fase=debate",
      color: "var(--stage-debate)",
    },
    laws !== null && { label: "já são lei", value: formatNumber(laws), href: "/iniciativas?fase=published", color: "var(--stage-law)" },
  ];

  // The newest legislativas with results: who won, and so who governs.
  const last = legislativas?.find((item) => item.imported && item.winner) ?? null;
  const winner = last?.winner ?? null;
  const pm = government?.primeMinister ?? null;
  const pmParty = pm?.partySlug ? (parties.find((party) => party.slug === pm.partySlug) ?? null) : null;

  const power: PowerNowData = {
    president: presidency
      ? { name: presidency.president.name, photoUrl: presidency.president.photoUrl, since: presidency.president.termStart }
      : null,
    government: government
      ? {
          name: government.name,
          duration: government.startDate ? durationLabel(government.startDate, lisbonToday()) : null,
          primeMinister: pm && {
            name: pm.name,
            photoUrl: pm.photoUrl,
            party: pmParty?.acronym ?? null,
            color: pm.partySlug ? partyColor(pm.partySlug) : null,
          },
          from: winner && pm?.partySlug && winner.partySlugs.includes(pm.partySlug) ? listLabel(winner, parties) : null,
        }
      : null,
    election:
      last && winner
        ? {
            id: last.id,
            name: last.name,
            winner: listName(winner, parties),
            label: listLabel(winner, parties),
            color: winner.partySlugs[0] ? partyColor(winner.partySlugs[0]) : "var(--muted)",
            pct: formatPercent(winner.validPct),
            mandates: winner.mandates,
            total: last.turnout?.totalMandates ?? 230,
          }
        : null,
    parliament:
      parliament && parliament.groups.length > 0
        ? {
            // Left to right, as the chamber is drawn.
            groups: [...parliament.groups]
              .sort((a, b) => rank(a.party.slug) - rank(b.party.slug))
              .map((item) => ({ acronym: item.party.acronym || item.group, seats: item.seats, color: partyColor(item.party.slug) })),
            total: parliament.groups.reduce((sum, item) => sum + item.seats, 0),
          }
        : null,
    figures: figures.filter((item): item is PowerFigure => Boolean(item)),
  };

  return { power, mostCommented };
}

const box = "rounded-2xl border border-line bg-[var(--card-hover)] p-4";
const label = "font-mono text-xs font-bold uppercase tracking-widest";

/** One post from the blog, in a box, so our own writing has a place without pushing the news down. */
export function BlogSpotlight({ post, headingId = "destaque-blog" }: { post: EditorialPost; headingId?: string }) {
  const href = editorialPath(post.slug);
  return (
    <section aria-labelledby={headingId} className={`${box} bg-[color-mix(in_srgb,var(--marker)_22%,transparent)]`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${label} text-[color:var(--stage-debate)]`}>Destaque · Blog</p>
        <span className="font-mono text-xs text-muted">{KIND_LABELS[post.kind]}</span>
      </div>
      <h2 id={headingId} className="mt-2 text-xl font-bold leading-snug">
        <Link href={href} className="hover:underline">
          {post.title}
        </Link>
      </h2>
      {post.subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{post.subtitle}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-xs">
        <time dateTime={post.publishedAt} className="text-muted">
          {formatLongDate(post.publishedAt)}
        </time>
        <Link href={href} className="font-bold hover:underline">
          Ler <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

const kicker = "font-mono text-[11px] uppercase tracking-widest text-muted";
const row = "-mx-2 block rounded-lg px-2 py-3 hover:bg-surface";

/**
 * Who holds power today, in plain words: the President, the Prime Minister and the party that won, how
 * Parliament is split, and what is waiting on each of them. Every part opens its page.
 */
export function PowerNow({ data }: { data: PowerNowData }) {
  const { president, government, election, parliament, figures } = data;
  if (!president && !government && !election && !parliament && figures.length === 0) return null;
  const pm = government?.primeMinister;
  const needed = parliament ? majority(parliament.total) : null;
  const top = parliament ? [...parliament.groups].sort((a, b) => b.seats - a.seats) : [];
  return (
    <section aria-labelledby="agora-no-poder" className={box}>
      <h2 id="agora-no-poder" className={label}>
        Agora no poder
      </h2>
      <div className="mt-1 divide-y divide-line">
        {president && (
          <Link href="/presidente" className={`${row} flex items-center gap-3`}>
            <GovernmentPortrait name={president.name} photoUrl={president.photoUrl} size="sm" />
            <span className="min-w-0">
              <span className={`${kicker} block`}>Presidente da República</span>
              <span className="block font-bold leading-snug">{president.name}</span>
              <span className="block font-mono text-xs text-muted">desde {formatLongDate(president.since)}</span>
            </span>
          </Link>
        )}
        {government && (
          <Link href="/governo" className={`${row} flex items-center gap-3`}>
            {pm && <GovernmentPortrait name={pm.name} photoUrl={pm.photoUrl} size="sm" />}
            <span className="min-w-0">
              <span className={`${kicker} block`}>Primeiro-Ministro</span>
              {pm && (
                <span className="flex flex-wrap items-center gap-x-2 font-bold leading-snug">
                  {pm.name}
                  {pm.party && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-bold">
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: pm.color ?? undefined }} />
                      {pm.party}
                    </span>
                  )}
                </span>
              )}
              <span className="block text-xs leading-snug text-muted">
                {government.name}
                {government.from && ` (${government.from})`}
                {government.duration && `, em funções há ${government.duration}`}
              </span>
            </span>
          </Link>
        )}
        {election && (
          <Link href={`/eleicoes/${election.id}`} className={row}>
            <span className={`${kicker} block`}>Quem ganhou as últimas legislativas</span>
            <span className="mt-1 flex items-baseline gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0 self-center rounded-full" style={{ backgroundColor: election.color }} />
              <span className="min-w-0 flex-1 font-bold leading-snug">{election.winner}</span>
              {election.pct && <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{election.pct}</span>}
            </span>
            <span className="mt-1 block text-xs leading-snug text-muted">
              {election.name}
              {election.mandates !== null &&
                `: ${election.mandates} de ${election.total} deputados, ${
                  election.mandates >= majority(election.total)
                    ? "com maioria absoluta"
                    : `sem maioria absoluta, que exige ${majority(election.total)}`
                }`}
            </span>
          </Link>
        )}
        {parliament && needed !== null && (
          <Link href="/parlamento" className={row}>
            <span className="flex items-baseline justify-between gap-2">
              <span className={kicker}>Parlamento hoje</span>
              <span className="font-mono text-xs text-muted">{parliament.total} deputados</span>
            </span>
            {/* The seats left to right, with a tick where a majority starts. */}
            <span aria-hidden="true" className="relative mt-2 flex h-3 overflow-hidden rounded-full">
              {parliament.groups.map((group) => (
                <span key={group.acronym} style={{ width: `${(group.seats / parliament.total) * 100}%`, backgroundColor: group.color }} />
              ))}
              <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--ink)]" />
            </span>
            <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
              {top.slice(0, 4).map((group) => (
                <span key={group.acronym} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="font-bold">{group.acronym}</span> {group.seats}
                </span>
              ))}
              {top.length > 4 && <span className="text-muted">+{top.length - 4} partidos</span>}
            </span>
            <span className="mt-1 block text-xs text-muted">Maioria a partir de {needed} deputados</span>
          </Link>
        )}
        {figures.length > 0 && (
          // The figures as a short list, label left and number right, each opening its page.
          <ul className="pt-2">
            {figures.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-surface">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1 first-letter:uppercase">{item.label}</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The articles with the most comments from the last day; left out when none has any. */
export function MostCommented({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="mais-comentadas" className={box}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="mais-comentadas" className={label}>
          Mais comentadas
        </h2>
        <span className="font-mono text-xs text-muted">últimas 24 h</span>
      </div>
      <ol className="mt-2 divide-y divide-line">
        {articles.map((article, index) => (
          <li key={article.id} className="flex gap-3 py-2.5">
            <span aria-hidden="true" className="text-xl font-bold leading-none text-[color:var(--stage-debate)]">
              {index + 1}
            </span>
            <span className="min-w-0">
              <Link href={`/article/${article.id}#comentarios`} className="block text-sm font-bold leading-snug hover:underline">
                {article.title}
              </Link>
              <span className="mt-0.5 block font-mono text-xs text-muted">
                {article.source} · {commentLinkLabel(article.commentsCount)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
