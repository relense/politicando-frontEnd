import { describe, expect, it } from "vitest";
import { articleKindLabel, mapArticle, safeHttpUrl } from "@/lib/api/mappers";
import { articleSchema, type ApiArticle } from "@/lib/api/schemas";
import { buildBacklinks, buildCommentTree, countReplies, displayName, mentionsOf, splitMentions } from "@/lib/comments";
import { commentLinkLabel, commentsLabel, excerpt, formatDateTime, formatLongDateTime, formatRelative } from "@/lib/format";
import { findPartyByParam, getPartyLogo, partyPath } from "@/lib/parties";
import { getPartyProfile } from "@/lib/partyProfiles";
import { comingSoon, publicationCount } from "@/lib/editorial";
import type { Comment, EditorialKind, EditorialPost } from "@/lib/types";

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
  // Backend docs/articles-api.md, kind: a gray label under the outlet, so opinion is never taken for news.
  it("reads what kind of article it is, labelled; an older API or an unknown kind has none", () => {
    expect(mapArticle(apiArticle({ kind: "opinion" } as Partial<ApiArticle>)).kind).toBe("opinion");
    expect(mapArticle(apiArticle()).kind).toBeNull();
    expect(mapArticle(apiArticle({ kind: "essay" } as Partial<ApiArticle>)).kind).toBeNull();
    expect(articleKindLabel("news")).toBe("Notícia");
    expect(articleKindLabel("opinion")).toBe("Opinião");
    expect(articleKindLabel("podcast")).toBe("Podcast");
    expect(articleKindLabel("newsletter")).toBe("Newsletter");
    expect(articleKindLabel(null)).toBeNull();
  });

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

describe("party profiles", () => {
  const slugs = [
    "atua",
    "adn",
    "be",
    "cds-pp",
    "chega",
    "il",
    "jpp",
    "livre",
    "mas",
    "nova-direita",
    "nc",
    "pcp",
    "pctp-mrpp",
    "pev",
    "pls",
    "ppm",
    "psd",
    "ps",
    "ptp",
    "mpt",
    "pan",
    "rir",
    "tu",
    "volt",
  ];

  it("has a short, sourced summary and a logo for every party", () => {
    for (const slug of slugs) {
      const profile = getPartyProfile(slug);
      expect(profile, slug).toBeDefined();
      expect(profile!.summary.length, slug).toBeGreaterThan(200);
      expect(profile!.summary.length, slug).toBeLessThan(420);
      expect(profile!.sourceUrl, slug).toMatch(/^https:\/\//);
      expect(getPartyLogo(slug), slug).toBeDefined();
    }
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

  it("falls back to anon and keeps the post number out of the name", () => {
    expect(displayName(comment(2))).toBe("anon");
    expect(displayName(comment(12, null, "joao7"))).toBe("joao7");
  });

  it("finds >>123 mentions in a comment", () => {
    expect(splitMentions(">>12 sim\n>>3>>4 não")).toEqual([{ mention: 12 }, " sim\n", { mention: 3 }, { mention: 4 }, " não"]);
    expect(splitMentions("sem nada > aqui")).toEqual(["sem nada > aqui"]);
    expect(mentionsOf({ id: 5, text: ">>5 >>1 >>1 >>2" })).toEqual([1, 2]);
  });

  it("links each post to the replies and mentions that answer it", () => {
    const mention = (id: number, text: string, parentId: number | null = null): Comment => ({ ...comment(id, parentId), text });
    const backlinks = buildBacklinks([
      comment(1),
      mention(4, ">>1"),
      comment(2, 1),
      mention(3, ">>1 >>2", 1),
      { ...mention(-9, ">>1"), pending: true },
    ]);
    expect(backlinks.get(1)).toEqual([2, 3, 4]);
    expect(backlinks.get(2)).toEqual([3]);
  });
});

describe("format", () => {
  it("formats dates in Lisbon time", () => {
    expect(formatDateTime("2026-07-01T12:05:00Z")).toBe("01-07-2026 | 13:05");
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime("nonsense")).toBeNull();
    expect(formatLongDateTime("2026-11-14T17:59:00Z")).toBe("Sábado, 14 de novembro de 2026, 17:59");
  });

  it("only adds an ellipsis when text was cut", () => {
    expect(excerpt("curto")).toBe("curto");
    expect(excerpt("a".repeat(300))).toHaveLength(211);
  });

  it("labels comments in Portuguese", () => {
    expect([0, 1, 2].map(commentsLabel)).toEqual(["Comentários", "1 Comentário", "2 Comentários"]);
    expect([0, 1, 3].map(commentLinkLabel)).toEqual(["0 comentários", "1 comentário", "3 comentários"]);
  });

  it("shows recent dates relative to now, and older ones as a date", () => {
    const now = Date.parse("2026-07-10T12:00:00Z");
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(formatRelative(ago(20_000), now)).toBe("agora");
    expect(formatRelative(ago(5 * 60_000), now)).toBe("há 5 min");
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe("há 3 h");
    expect(formatRelative(ago(30 * 3_600_000), now)).toBe("há 1 dia");
    expect(formatRelative(ago(3 * 86_400_000), now)).toBe("há 3 dias");
    expect(formatRelative("2026-07-01T12:05:00Z", now)).toBe("01-07-2026");
    expect(formatRelative(ago(-60_000), now)).toBe("agora");
    expect(formatRelative(null, now)).toBeNull();
  });
});

describe("the blog's formats still to come", () => {
  const post = (kind: EditorialKind) => ({ kind }) as EditorialPost;
  it("lists the formats with no posts", () => {
    expect(comingSoon([post("article"), post("opinion")], { podcastShow: false })).toEqual(["podcast", "interview", "video"]);
  });
  it("never lists podcasts while the show is on Spotify, posts or not", () => {
    expect(comingSoon([post("article")], { podcastShow: true })).toEqual(["opinion", "interview", "video"]);
  });
});

describe("the blog's count of what a filter shows", () => {
  it("counts the posts", () => {
    expect(publicationCount(1, { showInstead: false })).toBe("1 publicação");
    expect(publicationCount(0, { showInstead: false })).toBe("0 publicações");
  });
  it("says nothing when the podcast show stands in for the posts (19 Nov: «0 publicações» above today's episode)", () => {
    expect(publicationCount(0, { showInstead: true })).toBeNull();
  });
});
