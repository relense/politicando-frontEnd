import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { featuredPath, getBecomeDeputy, getCandidates, getDhondt, listStanding, seatOrder } from "@/lib/api/becomeDeputy";
import { handlers } from "@/mocks/handlers";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

describe("how to become a deputy", () => {
  it("reads the explainer, keeping only safe source links", async () => {
    const explainer = await getBecomeDeputy();
    expect(explainer.sections.map((section) => section.id)).toContain("dhondt");
    expect(explainer.circles?.election).toBe("legislativas-2025");
    expect(explainer.sections[0]!.sources[0]!.url).toBe("https://example.com/constituicao");
  });

  it("numbers the seats in the order they were won, ties going to fewer votes", () => {
    const order = seatOrder([
      { list: "A", name: "A", partySlugs: [], votes: 100, seats: 2, quotients: [100, 50, 33.3], votesShortOfNextSeat: 1 },
      { list: "B", name: "B", partySlugs: [], votes: 60, seats: 1, quotients: [60, 30, 20], votesShortOfNextSeat: 1 },
      { list: "C", name: "C", partySlugs: [], votes: 50, seats: 1, quotients: [50, 25], votesShortOfNextSeat: 1 },
    ]);
    expect(order.get("A:0")).toBe(1);
    expect(order.get("B:0")).toBe(2);
    // A's second quotient and C's first are both 50: the seat goes first to C, with fewer votes.
    expect(order.get("C:0")).toBe(3);
    expect(order.get("A:1")).toBe(4);
    expect(order.get("B:1")).toBeUndefined();
  });

  it("finds the cut-off line and who entered from below it", async () => {
    const { lists } = await getCandidates("legislativas-2025", "LOCAL-120000");
    const ps = lists.find((list) => list.list === "PS")!;
    const { above, below, replacements } = listStanding(ps);
    expect(above).toHaveLength(1);
    expect(below.length).toBeGreaterThan(0);
    expect(replacements.map((candidate) => candidate.deputyId)).toEqual([1002]);
  });

  it("tidies list names, and links people to their pages", async () => {
    const dhondt = await getDhondt("legislativas-2025", "LOCAL-120000");
    expect(dhondt.lists.find((list) => list.list === "PPD/PSD.CDS-PP")!.name).toBe("AD - Coligação PSD/CDS");
    expect(featuredPath({ kind: "deputy", id: "1001" })).toBe("/deputados/1001");
    expect(featuredPath({ kind: "president", id: "x" })).toBe("/presidente");
  });
});
