import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapEditorialPost, safeEmbedUrl } from "@/lib/api/mappers";
import { editorialPostSchema } from "@/lib/api/schemas";
import { plainText, renderMarkdown } from "@/lib/markdown";
import { editorialPosts } from "@/mocks/editorialFixtures";

const html = (source: string) => renderToStaticMarkup(<>{renderMarkdown(source)}</>);

describe("markdown", () => {
  it("renders the blocks editors use, with headings from h2", () => {
    expect(html("# Título\n\nUm *pouco* de **texto**.")).toBe("<h2>Título</h2><p>Um <em>pouco</em> de <strong>texto</strong>.</p>");
    expect(html("- um\n- dois")).toBe("<ul><li>um</li><li>dois</li></ul>");
    expect(html("1. um\n2. dois")).toBe("<ol><li>um</li><li>dois</li></ol>");
    expect(html("> citação")).toBe("<blockquote><p>citação</p></blockquote>");
    expect(html("```\n<b>x</b>\n```")).toBe("<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>");
    expect(html("---")).toBe("<hr/>");
  });

  it("escapes raw HTML and keeps only http(s) links and images", () => {
    expect(html("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(html("[mau](javascript:alert(1))")).not.toContain("<a");
    expect(html("[bom](https://example.pt)")).toContain('<a href="https://example.pt" target="_blank" rel="noopener noreferrer">bom</a>');
    expect(html("![foto](data:image/png;base64,AAA)")).toBe("<p>foto</p>");
    expect(html("snake_case_name")).toBe("<p>snake_case_name</p>");
  });

  it("strips the marks for descriptions", () => {
    expect(plainText("## Olá\n\nUm [link](https://x.pt) e **negrito**.")).toBe("Olá Um link e negrito.");
  });
});

describe("editorial API", () => {
  it("allows players only from the known providers", () => {
    expect(safeEmbedUrl("https://open.spotify.com/embed/episode/1")).toBe("https://open.spotify.com/embed/episode/1");
    expect(safeEmbedUrl("https://www.youtube-nocookie.com/embed/x")).not.toBeNull();
    expect(safeEmbedUrl("https://www.youtube.com/embed/x")).toBeNull();
    expect(safeEmbedUrl("http://open.spotify.com/embed/episode/1")).toBeNull();
    expect(safeEmbedUrl("javascript:alert(1)")).toBeNull();
  });

  it("maps posts and drops unknown players", () => {
    const [podcast, opinion] = editorialPosts.map((post) => mapEditorialPost(editorialPostSchema.parse(post)));
    expect(podcast).toMatchObject({ kind: "podcast", media: { provider: "spotify" }, featured: true });
    expect(opinion).toMatchObject({ kind: "opinion", media: null, authorName: "Tomás Varela" });
  });
});
