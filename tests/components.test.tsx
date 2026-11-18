import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommentSection } from "@/components/CommentSection";
import { mapArticle } from "@/lib/api/mappers";
import type { ApiArticle } from "@/lib/api/schemas";
import { API, handlers } from "@/mocks/handlers";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, "aria-hidden": hidden }: { src: string; alt: string; "aria-hidden"?: boolean | "true" }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} aria-hidden={hidden} />
  ),
}));

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const withQuery = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })}>{ui}</QueryClientProvider>,
  );

const article = (overrides: Partial<ApiArticle> = {}) =>
  mapArticle({
    id: 1,
    title: "T",
    url: "https://rtp.pt/a",
    source: "rtp.pt",
    imageUrl: null,
    publishedAt: "2026-10-30T12:00:00.000Z",
    commentCount: 0,
    parties: [],
    excerpt: "",
    ...overrides,
  });

describe("ArticleCard", () => {
  it("renders a hostile title as text, not HTML", () => {
    const { container } = render(<ArticleCard article={article({ title: "<script>alert(1)</script><b>x</b>" })} />);
    expect(container.querySelector("script, b")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("<script>alert(1)</script><b>x</b>");
  });

  it("does not crash without parties or text", () => {
    render(<ArticleCard article={article()} />);
    expect(screen.getByRole("heading")).toHaveTextContent("T");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows a neutral badge, not the PS logo, for an unknown party", () => {
    render(<ArticleCard article={article({ parties: [{ slug: "novo", acronym: "NOVO", name: "Novo" }] })} />);
    expect(screen.getByTestId("party-badge")).toHaveTextContent("NOV");
    expect(document.querySelector('img[src*="ps_logo"]')).toBeNull();
  });

  it("uses the slug for logos and links, and the acronym for the label", () => {
    render(<ArticleCard article={article({ parties: [{ slug: "livre", acronym: "L", name: "LIVRE" }] })} />);
    expect(screen.getByRole("link", { name: "L" })).toHaveAttribute("href", "/partido/livre");
    expect(document.querySelector('img[src*="l_logo"]')).not.toBeNull();
  });

  it("opens the source safely in a new tab", () => {
    render(<ArticleCard article={article()} />);
    // The outlet's name at the top and "Ler em RTP" at the bottom.
    for (const link of screen.getAllByRole("link", { name: /RTP/ })) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("shortens the excerpt in lists and shows all of it on the article page", () => {
    const long = "a".repeat(300);
    const { unmount } = render(<ArticleCard article={article({ excerpt: long })} />);
    expect(screen.getByText(/^a+…$/).textContent).toHaveLength(211);
    unmount();
    render(<ArticleDetail article={article({ excerpt: long })} />);
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it("links clearly to the original on the article page", () => {
    render(<ArticleDetail article={article()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("T");
    const link = screen.getByRole("link", { name: /Ler o artigo completo em RTP/ });
    expect(link).toHaveAttribute("href", "https://rtp.pt/a");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("hides the original link when the url is unsafe", () => {
    render(<ArticleDetail article={article({ url: "javascript:alert(1)" })} />);
    expect(screen.queryByRole("link", { name: /Ler o artigo/ })).toBeNull();
  });

  it("sends the image to our article page, keeping it out of the tab order", () => {
    render(<ArticleCard article={article({ id: 7, imageUrl: "https://rtp.pt/i.jpg" })} />);
    const image = document.querySelector('img[src="https://rtp.pt/i.jpg"]')!;
    // The headline as alt text for search engines, hidden from screen readers, which read the headline already.
    expect(image).toHaveAttribute("alt", article({}).title);
    expect(image).toHaveAttribute("aria-hidden", "true");
    const link = image.closest("a")!;
    expect(link).toHaveAttribute("href", "/article/7");
    expect(link).not.toHaveAttribute("target");
    expect(link).toHaveAttribute("tabindex", "-1");
  });

  it("shows the reads when the API counts them, and nothing otherwise", () => {
    const { rerender } = render(<ArticleCard article={article({ views: 1284 })} />);
    expect(screen.getByText(/^1\s284 leituras$/)).toBeInTheDocument();
    rerender(<ArticleCard article={article({ views: null })} />);
    expect(screen.queryByText(/leituras?$/)).toBeNull();
  });

  it("invites the first comment", () => {
    render(<ArticleCard article={article({ id: 7 })} />);
    expect(screen.getByRole("link", { name: "0 comentários" })).toHaveAttribute("href", "/article/7#comentarios");
  });

  it("drops a javascript: source link", () => {
    render(<ArticleCard article={article({ source: "mau", url: "javascript:alert(1)" })} />);
    expect(screen.queryByRole("link", { name: /mau/ })).toBeNull();
  });
});

describe("comments", () => {
  const initial = [
    { id: 1, username: "ana", text: "Raiz", parentId: null, createdAt: null },
    { id: 2, username: null, text: "Filho", parentId: 1, createdAt: null },
  ];
  const openBox = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Junta-te à conversa…" }));

  it("opens the comment box from a single line and closes it with Cancelar, like Reddit", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/57" initialComments={[]} />);
    expect(screen.queryByLabelText("Comentário")).toBeNull();
    await openBox(user);
    expect(screen.getByLabelText("Comentário")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Comentário")).toBeNull();
  });

  it("rejects an empty comment and a missing captcha with a message", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/100" initialComments={[]} />);
    await openBox(user);

    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escreve um comentário");

    await user.type(screen.getByLabelText("Comentário"), "   ");
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escreve um comentário");

    await user.type(screen.getByLabelText("Comentário"), "olá");
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("não és um robô");
  });

  it("posts a comment without blanking the page, then closes the box", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/50" initialComments={[]} />);
    await openBox(user);
    await user.type(screen.getByLabelText("Comentário"), "Novo comentário");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("Novo comentário")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Comentário")).toBeNull());
    expect(screen.getByRole("button", { name: "Junta-te à conversa…" })).toBeInTheDocument();
  });

  it("removes the optimistic comment and keeps the text when the API fails", async () => {
    server.use(http.post(`${API}/articles/:id/comments`, () => HttpResponse.json({}, { status: 500 })));
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/51" initialComments={[]} />);
    await openBox(user);
    await user.type(screen.getByLabelText("Comentário"), "Vai falhar");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível publicar");
    expect(screen.getByLabelText("Comentário")).toHaveValue("Vai falhar");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("explains rate limiting using the API's error code", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/54" initialComments={[]} />);
    await openBox(user);
    await user.type(screen.getByLabelText("Comentário"), "ERRO-LIMITE");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("depressa demais");
  });

  it("shows the captcha only once something is written", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/55" initialComments={[]} />);
    await openBox(user);
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.type(screen.getByLabelText("Comentário"), "a");
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("hides the captcha completely when it is switched off for testing", async () => {
    vi.stubEnv("NEXT_PUBLIC_CAPTCHA_MODE", "off");
    let token: unknown;
    server.use(
      http.post(`${API}/articles/:id/comments`, async ({ request }) => {
        token = ((await request.json()) as { recaptchaToken: string }).recaptchaToken;
        return HttpResponse.json({ id: 900, username: null, text: "Sem captcha", parentId: null, createdAt: null }, { status: 201 });
      }),
    );
    try {
      const user = userEvent.setup();
      withQuery(<CommentSection target="/articles/58" initialComments={[]} />);
      await openBox(user);
      await user.type(screen.getByLabelText("Comentário"), "Sem captcha");
      expect(screen.queryByRole("checkbox")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Publicar" }));
      await waitFor(() => expect(token).toBe("captcha-disabled"));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("resets only the captcha of the form that posted", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/52" initialComments={initial} />);
    await openBox(user);
    await user.click(screen.getAllByRole("button", { name: "Responder" })[0]!);

    await user.type(screen.getByLabelText("Comentário"), "Principal");
    await user.type(screen.getByLabelText("Resposta"), "Resposta nova");
    const mainForm = screen.getByLabelText("Comentário").closest("form")!;
    const replyForm = screen.getByLabelText("Resposta").closest("form")!;
    await user.click(within(mainForm).getByRole("checkbox"));
    await user.click(within(replyForm).getByRole("checkbox"));
    await user.click(within(replyForm).getByRole("button", { name: "Publicar" }));

    await waitFor(() => expect(screen.queryByLabelText("Resposta")).toBeNull());
    expect(within(mainForm).getByRole("checkbox")).toBeChecked();
    expect(await screen.findByText("Resposta nova")).toBeInTheDocument();
  });

  it("closes a reply form with Cancelar", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/56" initialComments={initial} />);
    await user.click(screen.getAllByRole("button", { name: "Responder" })[0]!);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Resposta")).toBeNull();
  });

  it("shows replies nested under their parent, with anonymous names and post numbers", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/53" initialComments={initial} />);

    const root = document.getElementById("comentario-1")!;
    const reply = within(root).getByText("Filho").closest<HTMLElement>("[id^=comentario-]")!;
    expect(reply.id).toBe("comentario-2");
    expect(within(reply).getByText("anon")).toBeInTheDocument();
    expect(within(reply).getByText("No.2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recolher comentário de ana" }));
    expect(screen.queryByText("Raiz")).toBeNull();
    expect(screen.queryByText("Filho")).toBeNull();
    expect(screen.getByText("(1 resposta)")).toBeInTheDocument();
  });

  it("turns >>123 into a link with a preview, and strikes through posts that are not here", async () => {
    const user = userEvent.setup();
    const comments = [...initial, { id: 3, username: null, text: ">>1 concordo, >>999 não", parentId: null, createdAt: null }];
    withQuery(<CommentSection target="/articles/59" initialComments={comments} />);

    const post = document.getElementById("comentario-3")!;
    const mention = within(post).getByRole("link", { name: ">>1" });
    expect(mention).toHaveAttribute("href", "#comentario-1");
    expect(within(post).queryByRole("link", { name: ">>999" })).toBeNull();
    expect(within(post).getByText(">>999")).toHaveClass("line-through");

    await user.hover(mention);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Raiz");
  });

  it("lists the posts that answer a post, as 4chan backlinks", () => {
    const comments = [...initial, { id: 3, username: null, text: ">>1 concordo", parentId: null, createdAt: null }];
    withQuery(<CommentSection target="/articles/60" initialComments={comments} />);
    const root = document.getElementById("comentario-1")!;
    const backlinks = within(root).getByText("Respostas:").parentElement!;
    expect(
      within(backlinks)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([">>2", ">>3"]);
  });

  it("quotes a post into the comment box when its number is clicked", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection target="/articles/61" initialComments={initial} />);
    await user.click(screen.getByRole("button", { name: "No.2, citar este comentário" }));
    expect(screen.getByLabelText("Comentário")).toHaveValue(">>2\n");
    await user.click(screen.getAllByRole("button", { name: /Citar$/ })[0]!);
    expect(screen.getByLabelText("Comentário")).toHaveValue(">>2\n>>1\n");
  });

  it("sorts top-level comments by oldest or newest", async () => {
    const user = userEvent.setup();
    const comments = [...initial, { id: 3, username: "rui", text: "Outro", parentId: null, createdAt: null }];
    withQuery(<CommentSection target="/articles/62" initialComments={comments} />);
    const order = () => screen.getAllByRole("article").map((node) => node.id);
    expect(order()).toEqual(["comentario-1", "comentario-2", "comentario-3"]);
    await user.click(screen.getByRole("button", { name: "Mais recentes" }));
    expect(order()).toEqual(["comentario-3", "comentario-1", "comentario-2"]);
  });
});
