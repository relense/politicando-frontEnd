import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { StoryRow } from "@/components/FeedRow";
import { StoryCard } from "@/components/StoryCard";
import { getStories, type Story } from "@/lib/api/stories";
import { API, handlers } from "@/mocks/handlers";

// Story cards say what they are (backend note): «Opinião», «Podcast» or «Newsletter»; news, the usual, says nothing.
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const story = (kind: Story["kind"]): Story => ({
  id: 7,
  title: "Uma história de teste",
  excerpt: null,
  imageUrl: null,
  firstPublishedAt: "2026-11-20T08:00:00.000Z",
  lastPublishedAt: "2026-11-20T09:00:00.000Z",
  sourceCount: 1,
  recentSourceCount: null,
  versions: [
    {
      source: "Jornal Exemplo",
      sourceDomain: "exemplo.pt",
      articleId: 70,
      title: "Uma história de teste",
      url: null,
      publishedAt: "2026-11-20T08:00:00.000Z",
    },
  ],
  parties: [],
  deputies: [],
  government: [],
  president: null,
  people: [],
  initiatives: [],
  importa: 0,
  importance: 0,
  commentCount: 0,
  tags: [],
  debate: null,
  mergedFrom: [],
  kind,
});

const withQueries = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

describe("a story's kind", () => {
  it("comes with each card; an opinion piece or a podcast is a card of its own", async () => {
    const { stories } = await getStories({ limit: 50 });
    const byId = new Map(stories.map((item) => [item.id, item]));
    expect(byId.get(93)?.kind).toBe("opinion");
    expect(byId.get(92)?.kind).toBe("podcast");
    expect(byId.get(92)?.sourceCount).toBe(1);
    expect(byId.get(100)?.kind).toBe("news");
  });

  it("an older API sends none, or one the site doesn't know: no label, nothing breaks", async () => {
    const raw = (await (await fetch(`${API}/stories?limit=1`)).json()) as { items: Record<string, unknown>[] };
    const { kind: _kind, ...older } = raw.items[0]!;
    server.use(
      http.get(`${API}/stories`, () => HttpResponse.json({ items: [older, { ...older, id: 2, kind: "video" }], nextCursor: null })),
    );
    const { stories } = await getStories();
    expect(stories.map((item) => item.kind)).toEqual([null, null]);
  });

  it("reads under the outlet on the card and the row, but not for news", () => {
    const { unmount } = withQueries(<StoryCard story={story("opinion")} />);
    expect(screen.getByText("Opinião", { exact: true })).toBeInTheDocument();
    unmount();
    withQueries(<StoryRow story={story("podcast")} why="" />);
    expect(screen.getByText("Podcast", { exact: true })).toBeInTheDocument();
  });

  it("news, the usual, says nothing", () => {
    withQueries(
      <>
        <StoryCard story={story("news")} />
        <StoryRow story={story("news")} why="" />
      </>,
    );
    expect(screen.queryByText("Notícia", { exact: true })).not.toBeInTheDocument();
  });
});
