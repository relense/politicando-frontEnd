import Link from "next/link";
import { getFeedPage, getGovernment, getInitiatives } from "@/lib/api/client";
import { getPresidency } from "@/lib/api/presidency";
import { editorialPath, KIND_LABELS } from "@/lib/editorial";
import { commentLinkLabel, formatLongDate, formatNumber } from "@/lib/format";
import { durationLabel } from "@/lib/history";
import type { Article, EditorialPost } from "@/lib/types";

export type PowerFigure = { label: string; value: string; href: string; color: string };
export type NewsSidebarData = { power: PowerFigure[]; mostCommented: Article[] };

const DAY = 86_400_000;
const lisbonToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
const requestTime = () => Date.now();

/**
 * The figures beside the news, each from its own page's data. One that fails is left out, never the page.
 * The most commented come from the latest 50 articles, kept to the last 24 hours.
 */
export async function loadNewsSidebar(): Promise<NewsSidebarData> {
  const [presidency, initiatives, government, latest] = await Promise.all([
    getPresidency().catch(() => null),
    getInitiatives({ limit: 1 }).catch(() => null),
    getGovernment().catch(() => null),
    getFeedPage({ limit: 50 }).catch(() => null),
  ]);
  const stage = (key: string) => initiatives?.stages.find((item) => item.key === key)?.count;
  const discussing =
    stage("submitted") !== undefined || stage("debate") !== undefined ? (stage("submitted") ?? 0) + (stage("debate") ?? 0) : null;
  const laws = stage("published") ?? null;

  const power: (PowerFigure | null | false)[] = [
    presidency && {
      label: "Na secretária do Presidente",
      value: formatNumber(presidency.legislation.pending),
      href: "/presidente",
      color: "var(--stage-president)",
    },
    discussing !== null && {
      label: "Iniciativas em discussão",
      value: formatNumber(discussing),
      href: "/iniciativas?fase=debate",
      color: "var(--stage-debate)",
    },
    laws !== null && { label: "Já são lei", value: formatNumber(laws), href: "/iniciativas?fase=published", color: "var(--stage-law)" },
    government?.startDate
      ? { label: "Governo em funções há", value: durationLabel(government.startDate, lisbonToday()), href: "/governo", color: "var(--ink)" }
      : null,
  ];

  const since = requestTime() - DAY;
  const mostCommented = (latest?.articles ?? [])
    .filter((article) => article.commentsCount > 0 && Date.parse(article.publishedAt) >= since)
    .sort((a, b) => b.commentsCount - a.commentsCount)
    .slice(0, 3);

  return { power: power.filter((item): item is PowerFigure => Boolean(item)), mostCommented };
}

const box = "rounded-2xl border border-line p-4";
const label = "font-mono text-xs font-bold uppercase tracking-widest";

/** One post from the blog, in a box, so our own writing has a place without pushing the news down. */
export function BlogSpotlight({ post }: { post: EditorialPost }) {
  const href = editorialPath(post.slug);
  return (
    <section aria-labelledby="destaque-blog" className={`${box} bg-[color-mix(in_srgb,var(--marker)_22%,transparent)]`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`${label} text-[color:var(--stage-debate)]`}>Destaque · Blog</p>
        <span className="font-mono text-xs text-muted">{KIND_LABELS[post.kind]}</span>
      </div>
      <h2 id="destaque-blog" className="mt-2 text-xl font-bold leading-snug">
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

/** Who holds power now, in four numbers, each opening its page. */
export function PowerNow({ figures }: { figures: PowerFigure[] }) {
  if (figures.length === 0) return null;
  return (
    <section aria-labelledby="agora-no-poder" className={box}>
      <h2 id="agora-no-poder" className={label}>
        Agora no poder
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {figures.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="-mx-2 flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-surface">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1">{item.label}</span>
              <span className="shrink-0 font-mono text-xs font-bold">{item.value}</span>
            </Link>
          </li>
        ))}
      </ul>
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
