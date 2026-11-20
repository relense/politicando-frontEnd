import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapEditorialPost, safeEmbedUrl } from "@/lib/api/mappers";
import { editorialPostSchema } from "@/lib/api/schemas";
import { plainText, renderMarkdown } from "@/lib/markdown";
import { editorialPosts } from "@/mocks/editorialFixtures";

const html = (source: string) => renderToStaticMarkup(<>{renderMarkdown(source)}</>);

describe("markdown", () => {
  it("renders the blocks editors use, with headings from h2", () => {
    expect(html("# Título\n\nUm *pouco* de **texto**.")).toBe(
      '<h2 id="titulo">Título</h2><p>Um <em>pouco</em> de <strong>texto</strong>.</p>',
    );
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

describe("sectionsOf", () => {
  it("lists the top-level headings with the anchors the renderer gives them", async () => {
    const { sectionsOf } = await import("@/lib/markdown");
    expect(sectionsOf("Intro\n\n## Quem pode ser deputado\n\ntexto\n\n### Detalhe\n\n## Os 22 círculos")).toEqual([
      { id: "quem-pode-ser-deputado", title: "Quem pode ser deputado" },
      { id: "os-22-circulos", title: "Os 22 círculos" },
    ]);
  });
});

describe("tables and our own addresses", () => {
  const html = async (source: string) => {
    const { renderMarkdown } = await import("@/lib/markdown");
    return renderToStaticMarkup(<>{renderMarkdown(source)}</>);
  };

  it("draws a GFM table in a box that scrolls, with alignment and a row header when the corner is empty", async () => {
    const out = await html("| | Deputados |\n|---|---:|\n| **A favor** | 91 |\n| Contra | 79 |");
    expect(out).toContain('<div class="post-table" role="region" aria-label="Tabela" tabindex="0"><table>');
    expect(out).toContain('<th scope="col" style="text-align:right">Deputados</th>');
    expect(out).toContain('<th scope="row"><strong>A favor</strong></th><td style="text-align:right">91</td>');
  });

  it("opens links to politicando.pt in place, as paths, and other sites in a new tab", async () => {
    const out = await html("[PS](https://politicando.pt/partido/ps) e [CNE](https://www.cne.pt)");
    expect(out).toContain('<a href="/partido/ps">PS</a>');
    expect(out).toContain('<a href="https://www.cne.pt" target="_blank" rel="noopener noreferrer">CNE</a>');
  });

  it("never takes a path that browsers read as another site for one of ours", async () => {
    const out = await html("[a](/\\evil.example/login) [b](/partido/ps)");
    expect(out).not.toMatch(/href="\/\\/);
    expect(out).toContain('<a href="/partido/ps">b</a>');
  });
});

describe("escapes", () => {
  it("shows a backslash-escaped mark as the character itself", async () => {
    const { renderMarkdown, plainText } = await import("@/lib/markdown");
    expect(renderToStaticMarkup(<>{renderMarkdown("\\* *Aprovados sobre os decididos.*")}</>)).toBe(
      "<p>* <em>Aprovados sobre os decididos.</em></p>",
    );
    expect(plainText("\\* *nota*")).toBe("* nota");
  });
});
