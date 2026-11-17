import { describe, expect, it } from "vitest";
import { initiativeDetailSchema } from "@/lib/api/schemas";

const vote = (absent: unknown[]) => ({
  id: "139641",
  date: "2025-09-19",
  phase: "Generalidade",
  result: "Aprovado",
  unanimous: true,
  favor: [],
  against: [],
  abstention: [],
  absent,
  named: [],
});

describe("initiative votes", () => {
  it("reads absences sent as bare party slugs, as the API does", () => {
    const parsed = initiativeDetailSchema.shape.votes.parse([vote(["be", { party: "pcp", count: 2 }])]);
    expect(parsed[0]!.absent).toEqual([
      { party: "be", count: null },
      { party: "pcp", count: 2 },
    ]);
  });
});
