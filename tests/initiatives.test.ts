import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getInitiatives } from "@/lib/api/client";
import { mapInitiative } from "@/lib/api/mappers";
import { getInitiativeTopics, getPresidency, mapPresidency, presidencySchema } from "@/lib/api/presidency";
import { initiativeSchema } from "@/lib/api/schemas";
import { hasPlainTitle, headlineOf, presidencyLabel, stageProgress, stageTone, updatedOn } from "@/lib/initiatives";
import { handlers } from "@/mocks/handlers";
import { initiatives } from "@/mocks/parliamentFixtures";
import { presidency } from "@/mocks/presidencyFixtures";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("stageProgress", () => {
  it("walks a law from submission to publication", () => {
    expect(stageProgress("submitted", true)).toMatchObject({ reached: 1, ended: null, vetoed: false });
    expect(stageProgress("committee", true).reached).toBe(2);
    expect(stageProgress("approved", true).reached).toBe(3);
    expect(stageProgress("awaiting_president", true).reached).toBe(4);
    expect(stageProgress("published", true)).toMatchObject({ reached: 5, steps: ["Entregue", "Em debate", "Votada", "Presidente", "Lei"] });
  });

  it("gives each stage its colour family", () => {
    expect(stageTone("debate")).toBe("debate");
    expect(stageTone("approved_in_principle")).toBe("debate");
    expect(stageTone("awaiting_president")).toBe("president");
    expect(stageTone("published", true)).toBe("law");
    expect(stageTone("published", false)).toBe("approved");
    expect(stageTone("vetoed")).toBe("stopped");
    expect(stageTone("withdrawn")).toBe("withdrawn");
  });

  it("stops recommendations at the vote, and marks ended paths and vetoes", () => {
    const recommendation = stageProgress("published", false);
    expect(recommendation.steps).not.toContain("Presidente");
    expect(recommendation.reached).toBe(recommendation.steps.length);
    expect(stageProgress("rejected", true)).toMatchObject({ ended: "rejected", reached: 3 });
    expect(stageProgress("withdrawn", false)).toMatchObject({ ended: "withdrawn", reached: 1 });
    expect(stageProgress("vetoed", true)).toMatchObject({ vetoed: true, reached: 4 });
  });
});

describe("plain language", () => {
  const base = mapInitiative(initiativeSchema.parse(initiatives[0]!));

  it("maps plain, topics and presidency, and survives their absence", () => {
    expect(base.plain?.title).toBeTruthy();
    const bare = mapInitiative(initiativeSchema.parse({ ...initiatives[0]!, plain: undefined, topics: undefined, presidency: undefined }));
    expect(bare).toMatchObject({ plain: null, topics: [], presidency: null });
    expect(headlineOf(bare)).toBe(bare.title);
    expect(hasPlainTitle(bare)).toBe(false);

    // The API sends a null plain title when it couldn't make one: the official title is used, and the rest stays.
    const untitled = mapInitiative(initiativeSchema.parse({ ...initiatives[0]!, plain: { ...initiatives[0]!.plain!, title: null } }));
    expect(headlineOf(untitled)).toBe(untitled.title);
    expect(hasPlainTitle(untitled)).toBe(false);
    expect(untitled.plain?.type.label).toBeTruthy();
  });

  it("drops unknown stages and presidency states instead of failing", () => {
    const odd = mapInitiative(
      initiativeSchema.parse({
        ...initiatives[0]!,
        plain: { title: "X", type: { label: "Lei" }, status: { label: "Algo", stage: "teleported" } },
        presidency: { status: "abducted" },
      }),
    );
    expect(odd.plain).toMatchObject({ status: { stage: null }, type: { makesLaw: true, explainer: "" } });
    expect(odd.presidency).toBeNull();
  });

  it("says when a veto was overcome", () => {
    const presidency = {
      status: "promulgated" as const,
      sentAt: null,
      promulgatedAt: "2026-10-09",
      vetoedAt: null,
      promulgationRecorded: true,
      vetoKind: null,
      constitutionalCourt: [],
      vetoes: [],
      by: null,
    };
    expect(presidencyLabel(presidency)).toBe("Promulgada");
    expect(presidencyLabel({ ...presidency, vetoedAt: "2026-06-15" })).toBe("Vetada e depois promulgada");
    expect(presidencyLabel({ ...presidency, status: "vetoed", promulgatedAt: null, vetoKind: "unconstitutionality" })).toBe(
      "Vetada por inconstitucionalidade",
    );
  });
});

describe("presidency api", () => {
  it("loads the President and filters initiatives by the President's decision and topic", async () => {
    const data = await getPresidency();
    expect(data.president.name).toBe("Teresa Albuquerque");
    expect(data.legislation.pendingNow.every((item) => item.presidency?.status === "pending")).toBe(true);

    const vetoed = await getInitiatives({ presidency: "vetoed" });
    expect(vetoed.initiatives.length).toBeGreaterThan(0);
    expect(vetoed.initiatives.every((item) => item.presidency?.status === "vetoed")).toBe(true);

    const { items } = await getInitiativeTopics();
    const housing = await getInitiatives({ topic: "habitacao", limit: 50 });
    expect(housing.initiatives).toHaveLength(items.find((topic) => topic.slug === "habitacao")!.count);
  });

  it("keeps only https photos and safe links", () => {
    const data = mapPresidency(
      presidencySchema.parse({
        ...presidency,
        president: { ...presidency.president, photoUrl: "http://x/y.jpg", url: "javascript:alert(1)" },
      }),
    );
    expect(data.president.photoUrl).toBeNull();
    expect(data.president.url).toBeNull();
  });
});

describe("updatedOn: «Atualizada a» on the list", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  it("is the stage's date when it's today or before", () => {
    expect(updatedOn("2026-11-18", now)).toBe("2026-11-18");
    expect(updatedOn("2026-11-19", now)).toBe("2026-11-19");
  });
  it("is nothing for a date still to come (19 Nov: OE2027 «Atualizada a 23-11-2026») or none", () => {
    expect(updatedOn("2026-11-23", now)).toBeNull();
    expect(updatedOn(null, now)).toBeNull();
  });
});
