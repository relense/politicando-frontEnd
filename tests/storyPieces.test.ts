import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStory, laterPieces } from "@/lib/api/stories";
import type { Article } from "@/lib/types";
import { handlers } from "@/mocks/handlers";

// A story's later pieces: GET /stories/:id sends every article, oldest first; an outlet's first is its chip, and every
// later one from the same outlet is a development (backend docs/stories-api.md).
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

const piece = (id: number, sourceDomain: string, publishedAt: string) =>
  ({ id, title: `Peça ${id}`, source: sourceDomain, sourceDomain, publishedAt }) as Article;

describe("a story's later pieces", () => {
  it("every article that isn't its outlet's first, newest first", () => {
    const articles = [
      piece(1, "rtp.pt", "2026-11-26T10:06:00Z"),
      piece(2, "expresso.pt", "2026-11-26T10:40:00Z"),
      piece(3, "rtp.pt", "2026-11-26T18:00:00Z"),
      piece(4, "expresso.pt", "2026-11-26T22:57:00Z"),
    ];
    expect(laterPieces({ articles }).map((item) => item.id)).toEqual([4, 3]);
    // In whatever order they came, an outlet's first is the earliest.
    expect(laterPieces({ articles: [...articles].reverse() }).map((item) => item.id)).toEqual([4, 3]);
    expect(laterPieces({ articles: articles.slice(0, 2) })).toEqual([]);
  });

  it("the mock story sends one source per outlet and every article, as the API does", async () => {
    const story = await getStory(100);
    expect(story!.versions.map((item) => item.articleId)).toEqual([85, 90, 95, 100]);
    expect(story!.articles.map((item) => item.id)).toEqual([85, 90, 94, 95, 100]);
    expect(laterPieces(story!).map((item) => item.id)).toEqual([94]);
    expect(story!.lastPublishedAt).toBe(story!.articles.at(-1)!.publishedAt);
  });
});
