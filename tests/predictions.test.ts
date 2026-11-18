import { describe, expect, it } from "vitest";
import { tallyText, timeLeft, topicInsight } from "@/components/Predictions";
import { predictionSchema } from "@/lib/api/engagement";

const NOW = Date.parse("2026-11-18T12:00:00Z");

describe("timeLeft", () => {
  it("counts down in minutes, hours and days, and is gone once passed", () => {
    expect(timeLeft("2026-11-18T12:15:00Z", NOW)).toBe("15 min");
    expect(timeLeft("2026-11-18T22:55:00Z", NOW)).toBe("10 h 55 min");
    expect(timeLeft("2026-11-20T12:00:00Z", NOW)).toBe("2 dias");
    expect(timeLeft("2026-11-18T11:00:00Z", NOW)).toBeNull();
    expect(timeLeft(null, NOW)).toBeNull();
  });
});

type Item = Parameters<typeof topicInsight>[0][number];
const item = (outcome: Item["outcome"], slug: string, label: string): Item => ({
  initiativeId: Math.random(),
  title: "x",
  pick: "pass",
  outcome,
  voteDate: null,
  voteResult: null,
  updatedAt: "",
  split: null,
  topics: [{ slug, label }],
  tally: null,
});

describe("topicInsight", () => {
  it("names the best and worst topics, from decided ones with at least two", () => {
    const items = [
      ...Array.from({ length: 4 }, () => item("hit", "habitacao", "Habitação")),
      item("hit", "economia", "Economia"),
      item("miss", "economia", "Economia"),
      item("miss", "economia", "Economia"),
      item(null, "economia", "Economia"),
      item("hit", "saude", "Saúde"),
    ];
    expect(topicInsight(items)).toBe("Acertas mais em habitação (4 de 4) do que em economia (1 de 3).");
  });

  it("says nothing when topics tie or there's only one", () => {
    expect(topicInsight([item("hit", "a", "A"), item("hit", "a", "A")])).toBeNull();
    expect(topicInsight([item("hit", "a", "A"), item("miss", "a", "A"), item("hit", "b", "B"), item("miss", "b", "B")])).toBeNull();
  });
});

describe("predictionSchema", () => {
  it("accepts an older answer without the new fields", () => {
    const parsed = predictionSchema.parse({ id: 1, title: "T", myPick: null, split: null });
    expect(parsed).toMatchObject({ state: "open", count: null, plain: null, topics: [], opensAt: null, threadId: null });
  });
});

describe("tallyText", () => {
  const none = { unanimous: false, favor: [], against: [], abstention: [] };
  it("words the result by group, never by deputy totals", () => {
    expect(
      tallyText("Aprovado", {
        ...none,
        favor: [
          { party: "PSD", count: null },
          { party: "CDS-PP", count: null },
        ],
        against: [{ party: "PS", count: null }],
        abstention: [{ party: "CH", count: 3 }],
      }),
    ).toBe("Aprovado com os votos a favor de PSD e CDS-PP, contra de PS e a abstenção de CH (3)");
  });
  it("says unanimous, and falls back to the result alone", () => {
    expect(tallyText("Aprovado", { ...none, unanimous: true })).toBe("Aprovado por unanimidade");
    expect(tallyText("Rejeitado", null)).toBe("Rejeitado");
    expect(tallyText("Rejeitado", none)).toBe("Rejeitado");
  });
});
