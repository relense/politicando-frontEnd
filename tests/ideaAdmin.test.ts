import { describe, expect, it } from "vitest";
import { ideaStatusBody } from "@/lib/ideaAdmin";

const idea = { id: 501, status: "planned" as const, answer: "Para dezembro.", expectedOn: "2026-12-15", duplicateOf: null };

describe("ideaStatusBody", () => {
  it("sends the status and the answer, trimmed; an empty answer clears it", () => {
    expect(ideaStatusBody(idea, { status: "in_progress", answer: "  Já começámos. ", expectedOn: "2026-12-15", duplicateOf: "" })).toEqual({
      ok: true,
      body: { status: "in_progress", answer: "Já começámos." },
    });
    expect(ideaStatusBody(idea, { status: null, answer: "   ", expectedOn: "2026-12-15", duplicateOf: "" })).toEqual({
      ok: true,
      body: { status: null, answer: null },
    });
  });

  it("leaves the expected date out when unchanged, and sends null to clear it", () => {
    const form = { status: "planned" as const, answer: "Para dezembro.", duplicateOf: "" };
    expect(ideaStatusBody(idea, { ...form, expectedOn: "2027-01-10" })).toEqual({
      ok: true,
      body: { status: "planned", answer: "Para dezembro.", expectedOn: "2027-01-10" },
    });
    expect(ideaStatusBody(idea, { ...form, expectedOn: "" })).toEqual({
      ok: true,
      body: { status: "planned", answer: "Para dezembro.", expectedOn: null },
    });
  });

  it("a duplicate needs the number of another idea", () => {
    const form = { status: "duplicate" as const, answer: "", expectedOn: "2026-12-15" };
    expect(ideaStatusBody(idea, { ...form, duplicateOf: "#12" })).toEqual({
      ok: true,
      body: { status: "duplicate", answer: null, duplicateOf: 12 },
    });
    expect(ideaStatusBody(idea, { ...form, duplicateOf: "" })).toEqual({ ok: false, error: "Escreve o número da ideia original." });
    expect(ideaStatusBody(idea, { ...form, duplicateOf: "abc" })).toEqual({ ok: false, error: "Escreve o número da ideia original." });
    expect(ideaStatusBody(idea, { ...form, duplicateOf: "501" })).toEqual({
      ok: false,
      error: "Uma ideia não pode ser duplicada de si própria.",
    });
  });
});
