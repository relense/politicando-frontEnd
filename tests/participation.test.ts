import { describe, expect, it } from "vitest";
import { ASK_NEEDS, needsAccount, PARTICIPATIONS } from "@/lib/participation";

describe("taking part", () => {
  it("needs an account, every kind of it", () => {
    for (const what of PARTICIPATIONS) expect(needsAccount(what)).toBe(true);
    expect(Object.keys(ASK_NEEDS).sort()).toEqual([
      "follow",
      "forum",
      "idea",
      "importa",
      "like",
      "post",
      "predict",
      "report",
      "save",
      "vote",
    ]);
  });
});
