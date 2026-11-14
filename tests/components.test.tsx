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
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const withQuery = (ui: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })}>{ui}</QueryClientProvider>);

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
    const link = screen.getByRole("link", { name: /RTP/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
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
    expect(image).toHaveAttribute("alt", "");
    const link = image.closest("a")!;
    expect(link).toHaveAttribute("href", "/article/7");
    expect(link).not.toHaveAttribute("target");
    expect(link).toHaveAttribute("tabindex", "-1");
  });

  it("invites the first comment", () => {
    render(<ArticleCard article={article({ id: 7 })} />);
    expect(screen.getByRole("link", { name: "Comentar" })).toHaveAttribute("href", "/article/7#comentarios");
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

  it("rejects an empty comment and a missing captcha with a message", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={100} initialComments={[]} />);

    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escreve um comentário");

    await user.type(screen.getByLabelText("Comentário"), "   ");
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escreve um comentário");

    await user.type(screen.getByLabelText("Comentário"), "olá");
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("não és um robô");
  });

  it("posts a comment without blanking the page, then clears the form", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={50} initialComments={[]} />);
    await user.type(screen.getByLabelText("Comentário"), "Novo comentário");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("Novo comentário")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Comentário")).toHaveValue(""));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("removes the optimistic comment and keeps the text when the API fails", async () => {
    server.use(http.post(`${API}/articles/:id/comments`, () => HttpResponse.json({}, { status: 500 })));
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={51} initialComments={[]} />);
    await user.type(screen.getByLabelText("Comentário"), "Vai falhar");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível publicar");
    expect(screen.getByLabelText("Comentário")).toHaveValue("Vai falhar");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("explains rate limiting using the API's error code", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={54} initialComments={[]} />);
    await user.type(screen.getByLabelText("Comentário"), "ERRO-LIMITE");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("depressa demais");
  });

  it("shows the captcha only once something is written", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={55} initialComments={[]} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.type(screen.getByLabelText("Comentário"), "a");
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("resets only the captcha of the form that posted", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={52} initialComments={initial} />);
    await user.click(screen.getAllByRole("button", { name: "responder" })[0]!);

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
    withQuery(<CommentSection articleId={56} initialComments={initial} />);
    await user.click(screen.getAllByRole("button", { name: "responder" })[0]!);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Resposta")).toBeNull();
  });

  it("shows replies nested under their parent, with anonymous names and post numbers", async () => {
    const user = userEvent.setup();
    withQuery(<CommentSection articleId={53} initialComments={initial} />);

    const root = document.getElementById("comentario-1")!;
    const reply = within(root).getByText("Filho").closest<HTMLElement>("[id^=comentario-]")!;
    expect(reply.id).toBe("comentario-2");
    expect(within(reply).getByText("anon")).toBeInTheDocument();
    expect(within(reply).getByText("#2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recolher comentário de ana" }));
    expect(screen.queryByText("Raiz")).toBeNull();
    expect(screen.queryByText("Filho")).toBeNull();
    expect(screen.getByText("(1 resposta)")).toBeInTheDocument();
  });
});
