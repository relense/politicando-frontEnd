import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ParliamentView, type Selection } from "@/components/ParliamentView";
import { mapParliament } from "@/lib/api/mappers";
import { parliamentSchema } from "@/lib/api/schemas";
import { handlers } from "@/mocks/handlers";
import { parliament as apiParliament } from "@/mocks/parliamentFixtures";

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
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  // jsdom has neither; the view uses them to scroll the card into view on phones.
  window.matchMedia ??= ((query: string) => ({ matches: true, media: query }) as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => {
  server.resetHandlers();
  window.history.replaceState(null, "", "/parlamento");
});
afterAll(() => server.close());

const parliament = mapParliament(parliamentSchema.parse(apiParliament));
const ps = parliament.deputies.find((deputy) => deputy.partySlug === "ps")!;
const psSeat = parliament.seatMap.seats.find((seat) => seat.partySlug === "ps")!;

const renderView = (initialSelection: Selection = null) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })}>
      <ParliamentView parliament={parliament} initialInitiatives={null} initialSelection={initialSelection} />
    </QueryClientProvider>,
  );

const seats = () => within(screen.getByRole("group", { name: /Lugares do hemiciclo/ })).getAllByRole("button");

describe("ParliamentView", () => {
  it("draws the 230 official seats and invites a choice", () => {
    renderView();
    expect(seats()).toHaveLength(230);
    expect(screen.getByText("Carrega num lugar")).toBeInTheDocument();
    expect(screen.getByText(/maioria absoluta: 116/)).toBeInTheDocument();
  });

  it("opens the party's bench from a seat, then the deputy's profile from the bench", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: `Lugar ${psSeat.number}, Partido Socialista (PS)` }));

    const bench = screen.getByRole("region", { name: "Partido Socialista" });
    expect(within(bench).getByText(/58 deputados/)).toBeInTheDocument();
    expect(window.location.search).toBe("?partido=ps");
    // Only the PS bench stands out on the map.
    expect(seats().filter((seat) => seat.style.opacity === "1")).toHaveLength(58);

    await user.click(within(bench).getByRole("button", { name: new RegExp(`^${ps.name}`) }));
    const card = screen.getByRole("region", { name: ps.name });
    expect(window.location.search).toBe(`?deputado=${ps.id}`);
    expect(await within(card).findByText(/assinadas/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Ver ficha completa →" })).toHaveAttribute("href", `/deputados/${ps.id}`);
    await user.click(within(card).getByRole("tab", { name: "Percurso" }));
    expect(within(card).getByText("Comissão de Orçamento, Finanças e Administração Pública")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Biografia no Parlamento/ })).toHaveAttribute(
      "href",
      `https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx?BID=${ps.id}`,
    );

    await user.click(within(card).getByRole("button", { name: "← Bancada PS" }));
    expect(screen.getByRole("region", { name: "Partido Socialista" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByText("Carrega num lugar")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("opens with the deputy or party from the address, and ignores unknown ones", () => {
    const { unmount } = renderView({ party: "", deputy: ps.id });
    expect(screen.getByRole("region", { name: ps.name })).toBeInTheDocument();
    unmount();
    renderView({ party: "nao-existe", deputy: null });
    expect(screen.getByText("Carrega num lugar")).toBeInTheDocument();
  });

  it("moves between seats with the arrow keys and opens one with Enter", async () => {
    const user = userEvent.setup();
    renderView();
    const start = seats().find((seat) => seat.tabIndex === 0)!;
    start.focus();
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).not.toBe(start);
    expect(document.activeElement?.id).toMatch(/^lugar-/);
    await user.keyboard("{Enter}");
    expect(screen.queryByText("Carrega num lugar")).toBeNull();
  });

  it("opens a bench from the legend, with AD grouping PSD and CDS-PP", async () => {
    const user = userEvent.setup();
    renderView();
    const legend = screen.getByRole("list", { name: "Partidos no Parlamento" });
    expect(within(legend).getByText(/Aliança Democrática/)).toBeInTheDocument();
    await user.click(within(legend).getByRole("button", { name: /^CH/ }));
    expect(screen.getByRole("region", { name: "CHEGA" })).toBeInTheDocument();
  });

  it("tells the Parliament and the Government apart, and marks where each initiative comes from", async () => {
    renderView();
    const explainer = screen.getByRole("region", { name: /Parlamento ou Governo/ });
    expect(within(explainer).getByRole("heading", { name: /Assembleia da República/ })).toBeInTheDocument();
    expect(within(explainer).getByRole("heading", { name: /^Governo/ })).toBeInTheDocument();

    const section = screen.getByRole("region", { name: "Iniciativas" });
    const cards = await within(section).findAllByRole("article");
    const government = cards.find((card) => within(card).queryByText(/Proposta de Lei/));
    const parliament = cards.find((card) => within(card).queryByText(/Projeto de Lei/));
    expect(within(government!).getByText("Governo", { selector: "span" })).toBeInTheDocument();
    expect(within(parliament!).getByText("Parlamento", { selector: "span" })).toBeInTheDocument();
  });

  it("links a bench to its deputies page", () => {
    renderView({ party: "ps", deputy: null });
    expect(screen.getByRole("link", { name: /bancada com fotografias/ })).toHaveAttribute("href", "/deputados?partido=ps");
    expect(screen.queryByText(/Ver lista de deputados/)).toBeNull();
  });

  it("switches initiative tabs, shows a party-by-party vote on request and filters by the chosen deputy", async () => {
    const user = userEvent.setup();
    renderView({ party: "", deputy: ps.id });
    const section = screen.getByRole("region", { name: "Iniciativas" });
    expect(within(section).getByRole("button", { name: /Aprovadas/ })).toHaveTextContent(/\d/);

    await user.click((await within(section).findAllByRole("button", { name: "Ver votação por partido" }))[0]!);
    expect(await within(section).findByText("A favor")).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: /Em discussão/ }));
    expect((await within(section).findAllByText("Em discussão", { selector: "span" })).length).toBeGreaterThan(0);

    await user.click(within(section).getByRole("checkbox", { name: `Só as de ${ps.name}` }));
    expect(await within(section).findByText(/Não há iniciativas|Proposta por/)).toBeInTheDocument();
  });
});
