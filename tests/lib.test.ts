import { describe, expect, it } from "vitest";
import { mapArticle, safeHttpUrl } from "@/lib/api/mappers";
import { articleSchema, type ApiArticle } from "@/lib/api/schemas";
import { buildCommentTree, countReplies, displayName } from "@/lib/comments";
import { commentsLabel, excerpt, formatDateTime } from "@/lib/format";
import { findPartyByParam, getPartyLogo, partyPath } from "@/lib/parties";
import type { Comment } from "@/lib/types";

const comment = (id: number, parentId: number | null = null, username: string | null = null): Comment => ({
  id,
  parentId,
  username,
  text: `c${id}`,
  createdAt: null,
});

const apiArticle = (overrides: Partial<ApiArticle> = {}): ApiArticle => ({
  id: 1,
  title: "T",
  url: "https://example.com/a",
  source: "rtp.pt",
  imageUrl: null,
  publishedAt: "2026-10-30T12:00:00.000Z",
  commentCount: 0,
  parties: [],
  excerpt: "Resumo",
  ...overrides,
});

describe("mappers", () => {
  it("decodes entities in titles and excerpts", () => {
    const article = mapArticle(apiArticle({ title: "A &amp; B", excerpt: "C &amp; D" }));
    expect(article).toMatchObject({ title: "A & B", excerpt: "C & D" });
  });

  it("strips markup from excerpts, encoded or not", () => {
    expect(mapArticle(apiArticle({ excerpt: "<p>Um <b>texto</b></p> &lt;i&gt;aqui&lt;/i&gt;" })).excerpt).toBe("Um texto aqui");
  });

  it("names known outlets and falls back to the domain", () => {
    expect(mapArticle(apiArticle({ source: "cmjornal.pt" })).source).toBe("Correio da Manhã");
    expect(mapArticle(apiArticle({ source: "novo.pt" })).source).toBe("novo.pt");
  });

  it("rejects an API response with no excerpt", () => {
    expect(articleSchema.safeParse({ ...apiArticle(), excerpt: undefined }).success).toBe(false);
    expect(articleSchema.safeParse(apiArticle()).success).toBe(true);
  });

  it("rejects non-http urls", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(mapArticle(apiArticle({ url: "javascript:alert(1)" })).url).toBeNull();
  });
});

describe("parties", () => {
  const parties = [
    { slug: "cds-pp", acronym: "CDS-PP", name: "CDS" },
    { slug: "livre", acronym: "L", name: "LIVRE" },
    { slug: "be", acronym: "B.E.", name: "Bloco" },
    { slug: "pctp-mrpp", acronym: "PCTP/MRPP", name: "PCTP" },
  ];

  it("never gives an unknown party another party's logo", () => {
    expect(getPartyLogo("novo")).toBeUndefined();
  });

  it("resolves slugs and old acronym urls", () => {
    expect(findPartyByParam(parties, "cds-pp")?.slug).toBe("cds-pp");
    expect(findPartyByParam(parties, "l")?.slug).toBe("livre");
    expect(findPartyByParam(parties, "pctp")?.slug).toBe("pctp-mrpp");
    expect(findPartyByParam(parties, "BE")?.slug).toBe("be");
    expect(findPartyByParam(parties, "nada")).toBeUndefined();
    expect(findPartyByParam(parties, "%E0%A4%A")).toBeUndefined();
    expect(partyPath("cds-pp")).toBe("/partido/cds-pp");
  });
});

describe("comments", () => {
  it("builds a tree without changing the input", () => {
    const input = Object.freeze([comment(1), comment(2, 1), comment(3, 2), comment(4)]) as readonly Comment[];
    const tree = buildCommentTree(input);
    expect(tree.map((node) => node.id)).toEqual([1, 4]);
    expect(tree[0]!.replies[0]!.replies[0]!.id).toBe(3);
    expect(countReplies(tree[0]!)).toBe(2);
  });

  it("keeps orphaned and self-referencing replies at the top level", () => {
    expect(buildCommentTree([comment(2, 99), comment(3, 3)]).map((node) => node.id)).toEqual([2, 3]);
  });

  it("names the parent and falls back to anon", () => {
    const [root] = buildCommentTree([comment(1, null, "ana"), comment(2, 1)]);
    expect(root!.replies[0]!.parentName).toBe("ana1");
    expect(displayName(comment(2))).toBe("anon2");
  });
});

describe("format", () => {
  it("formats dates in Lisbon time", () => {
    expect(formatDateTime("2026-07-01T12:05:00Z")).toBe("01-07-2026 | 13:05");
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime("nonsense")).toBeNull();
  });

  it("only adds an ellipsis when text was cut", () => {
    expect(excerpt("curto")).toBe("curto");
    expect(excerpt("a".repeat(300))).toHaveLength(211);
  });

  it("labels comments in Portuguese", () => {
    expect([0, 1, 2].map(commentsLabel)).toEqual(["Comentários", "1 Comentário", "2 Comentários"]);
  });
});
