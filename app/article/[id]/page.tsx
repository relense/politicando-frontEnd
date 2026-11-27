import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommentSection } from "@/components/CommentSection";
import { CountRead } from "@/components/CountRead";
import {
  DebatePair,
  HowEachToldList,
  ImportaBox,
  StoryContextBox,
  StoryDevelopments,
  StoryUpdated,
  StoryVersions,
  FollowStoryBox,
} from "@/components/StoryParts";
import { MarkStoryRead } from "@/components/TodayInFive";
import { getStory } from "@/lib/api/stories";
import { FEATURES } from "@/lib/features";
import { ArticleSidebar, type ArticleContext } from "@/components/ArticleSidebar";
import type { MoreAboutGroup } from "@/components/MoreAbout";
import { ApiError, getArticle, getComments, getFeedPage, getInitiative, getInitiatives } from "@/lib/api/client";
import { excerpt } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { clip, OG_BASE, pageTitle } from "@/lib/seo";
import { articleComments, type Article } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const MORE_COUNT = 3;

async function loadArticle(param: string) {
  if (!/^\d+$/.test(param)) notFound();
  try {
    return await getArticle(Number(param));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

/** Other news about each party the article mentions, up to three parties. A party that fails is left out. */
async function loadMore(article: Article): Promise<MoreAboutGroup[]> {
  const groups = await Promise.all(
    article.parties.slice(0, 3).map(async (party) => {
      try {
        const page = await getFeedPage({ party: party.slug, limit: 4 });
        return {
          slug: party.slug,
          acronym: party.acronym,
          articles: page.articles
            .filter((item) => item.id !== article.id)
            .slice(0, MORE_COUNT)
            .map(({ id, title, source, publishedAt }) => ({ id, title, source, publishedAt })),
        };
      } catch {
        return null;
      }
    }),
  );
  return groups.filter((group): group is MoreAboutGroup => group !== null);
}

/**
 * What is happening in Parliament on the article's subject: the topic of the first initiative it mentions and how
 * many initiatives share it. Without a topic, that initiative itself; without one, nothing.
 */
async function loadContext(article: Article): Promise<ArticleContext | null> {
  const first = article.initiatives[0];
  if (!first) return null;
  const fallback: ArticleContext = {
    kicker: "Contexto · No Parlamento",
    title: first.title,
    linkLabel: "Ver a iniciativa",
    href: `/iniciativas/${first.id}`,
  };
  try {
    const topic = (await getInitiative(first.id)).topics[0];
    if (!topic) return fallback;
    const total = (await getInitiatives({ topic: topic.slug, limit: 1 })).total;
    if (!total) return fallback;
    return {
      kicker: `Contexto · ${topic.label}`,
      title: `${total} ${total === 1 ? "iniciativa" : "iniciativas"} sobre ${topic.label.toLocaleLowerCase("pt")} no Parlamento`,
      linkLabel: "Ver o que está em discussão",
      href: `/iniciativas?tema=${encodeURIComponent(topic.slug)}`,
    };
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await loadArticle((await params).id);
  // Never undefined: that would drop the site's description too, leaving the page with none.
  const description =
    excerpt(article.excerpt, 160) ||
    clip(`Notícia do ${article.source}: ${article.title}. Os partidos e as pessoas referidas, e o debate no Politicando.`);
  const path = `/article/${article.id}`;
  return {
    title: pageTitle(article.title),
    description,
    alternates: { canonical: path },
    // Only another outlet's headline and excerpt: kept out of search results (links are still followed), so search
    // engines judge the site by its own pages. Sharing still works.
    robots: { index: false, follow: true },
    openGraph: {
      ...OG_BASE,
      type: "article",
      title: article.title,
      description,
      url: path,
      publishedTime: article.publishedAt,
    },
  };
}

/** The request's time, for «Atualizado às» (today) or with the date (another day). */
const requestTime = () => Date.now();

export default async function ArticlePage({ params }: Props) {
  await connection();
  const article = await loadArticle((await params).id);
  // One outlet's version of a story: the others, the story's debate and its Importa (FEATURES.stories).
  const story = FEATURES.stories && article.storyId ? await getStory(article.storyId).catch(() => null) : null;
  const target = story ? `/stories/${story.id}` : articleComments(article.id);
  const [comments, more, context] = await Promise.all([
    // Comments are live: if they fail, the article still shows, without its comments (as on the blog).
    getComments(target).catch(() => null),
    loadMore(article),
    loadContext(article),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: excerpt(article.excerpt, 160) || undefined,
    datePublished: article.publishedAt,
    image: article.imageUrl ?? undefined,
    url: `${SITE_URL}/article/${article.id}`,
    isBasedOn: article.url ?? undefined,
    publisher: { "@type": "Organization", name: article.source },
  };

  return (
    <>
      <CountRead path={`/articles/${article.id}/view`} />
      <script
        type="application/ld+json"
        // "<" is escaped so a hostile title cannot close this script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div data-wide className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {story && <MarkStoryRead id={story.id} />}
          <ArticleDetail
            // A story names everyone across its versions; one article alone may name fewer.
            article={story && story.people.length > 0 ? { ...article, people: story.people } : article}
            versions={
              story && (
                <>
                  <StoryVersions story={story} current={article.id} />
                  <StoryDevelopments story={story} current={article.id} />
                </>
              )
            }
            updated={story && <StoryUpdated story={story} current={article.id} now={requestTime()} />}
          />
          {story && <HowEachToldList story={story} current={article.id} />}
          {/* On narrower screens, before the comments: in a long thread they'd be lost below it. */}
          {story && (
            <div className="mt-8 flex flex-col gap-4 xl:hidden">
              <ImportaBox story={story} headingId="importa-topo" />
              <FollowStoryBox story={story} headingId="seguir-historia-topo" />
            </div>
          )}
          {comments && (
            <CommentSection
              target={target}
              initialComments={comments}
              title={story ? "Debate" : "Comentários"}
              stances={Boolean(story && story.initiatives.length > 0)}
              intro={
                story && (
                  <>
                    {story.sourceCount > 1 && (
                      <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
                        Há uma só conversa por história, seja qual for o jornal por onde chegaste.
                      </p>
                    )}
                    {story.debate && <DebatePair debate={story.debate} />}
                  </>
                )
              }
            />
          )}
        </div>
        <ArticleSidebar
          articleId={article.id}
          parties={article.parties}
          more={more}
          context={context}
          top={
            story && (
              <>
                <div className="hidden flex-col gap-4 xl:flex">
                  <ImportaBox story={story} />
                  <FollowStoryBox story={story} />
                </div>
                <StoryContextBox story={story} />
              </>
            )
          }
        />
      </div>
    </>
  );
}
