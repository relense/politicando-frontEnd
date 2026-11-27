import { fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { TodayCounts } from "@/components/TodayCounts";
import { getTodayCounts } from "@/lib/api/todayCounts";
import { dayStart } from "@/lib/todayCounts";
import { API, handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const at = (iso: string) => new Date(iso).getTime();

describe("when «hoje» starts: 05:00 in Lisbon", () => {
  it("is this morning's 05:00, in winter (Lisbon on UTC) and in summer (UTC+1)", () => {
    expect(dayStart(at("2026-11-27T10:00:00Z"))).toBe("2026-11-27T05:00:00.000Z");
    expect(dayStart(at("2026-07-10T10:00:00Z"))).toBe("2026-07-10T04:00:00.000Z");
    expect(dayStart(at("2026-11-27T05:00:00Z"))).toBe("2026-11-27T05:00:00.000Z");
  });
  it("before 05:00, is yesterday's", () => {
    expect(dayStart(at("2026-11-27T03:00:00Z"))).toBe("2026-11-26T05:00:00.000Z");
    expect(dayStart(at("2026-07-10T03:30:00Z"))).toBe("2026-07-09T04:00:00.000Z");
    expect(dayStart(at("2026-01-01T00:10:00Z"))).toBe("2025-12-31T05:00:00.000Z");
  });
});

describe("the counts from the API", () => {
  const since = "2026-11-27T05:00:00.000Z";
  it("asks both with since, and gives the total, the outlets and the parties, most first", async () => {
    const counts = await getTodayCounts(since);
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.sources.length).toBeGreaterThan(0);
    expect(counts.parties.length).toBeGreaterThan(0);
    expect(counts.sources[0]!.count).toBeGreaterThanOrEqual(counts.sources.at(-1)!.count);
  });
  it("an older API that ignores since (no total) shows nothing rather than all-time counts", async () => {
    server.use(http.get(`${API}/articles/sources`, () => HttpResponse.json({ items: [{ name: "publico.pt", count: 9000 }] })));
    expect((await getTodayCounts(since)).sources).toEqual([]);
  });
  it("without the parties endpoint, only the outlets", async () => {
    server.use(http.get(`${API}/articles/parties`, () => HttpResponse.json({ error: { code: "not_found", message: "x" } }, { status: 404 })));
    const counts = await getTodayCounts(since);
    expect(counts.parties).toEqual([]);
    expect(counts.sources.length).toBeGreaterThan(0);
  });
});

const sources = ["A", "B", "C", "D", "E", "F", "G"].map((name, index) => ({ key: name, label: `Jornal ${name}`, count: 70 - index * 10 }));
const parties = [
  { key: "ps", label: "PS", count: 40, color: "#f0f" },
  { key: "psd", label: "PSD", count: 20, color: "#f80" },
];

describe("the box", () => {
  it("shows the day's total and the top 5 outlets, then all with «Ver todos»", () => {
    render(<TodayCounts total={214} sources={sources} parties={parties} />);
    expect(screen.getByRole("heading", { name: "Hoje: 214 notícias" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Jornal A")).toBeInTheDocument();
    expect(screen.queryByText("Jornal F")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos (7)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Ver menos" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
  it("each bar is its count against the most", () => {
    render(<TodayCounts total={214} sources={sources} parties={[]} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("70");
    expect(rows[0]!.querySelector("[data-bar]")).toHaveStyle({ width: "100%" });
    expect(rows[1]!.querySelector("[data-bar]")).toHaveStyle({ width: `${(60 / 70) * 100}%` });
    // Without parties, no tabs.
    expect(screen.queryByRole("button", { name: "Partidos" })).not.toBeInTheDocument();
  });
  it("switches to the parties, with the note that one article can be about several", () => {
    render(<TodayCounts total={214} sources={sources} parties={parties} />);
    fireEvent.click(screen.getByRole("button", { name: "Partidos" }));
    expect(screen.getByRole("button", { name: "Partidos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("PS")).toBeInTheDocument();
    expect(screen.getByText(/Uma notícia pode falar de vários partidos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver todos/ })).not.toBeInTheDocument();
  });
  it("one article reads «1 notícia»", () => {
    render(<TodayCounts total={1} sources={sources.slice(0, 1)} parties={[]} />);
    expect(screen.getByRole("heading", { name: "Hoje: 1 notícia" })).toBeInTheDocument();
  });
});
