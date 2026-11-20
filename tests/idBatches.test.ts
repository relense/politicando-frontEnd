import { describe, expect, it } from "vitest";
import { idBatches } from "@/lib/api/client";

describe("idBatches: saved ids within the API's caps (100 ids, 50 a page)", () => {
  it("nothing for no ids, one request up to 50, two up to 100, and only the newest 100", () => {
    expect(idBatches([])).toEqual([]);
    expect(idBatches([1, 2, 3])).toEqual([[1, 2, 3]]);
    const sixty = Array.from({ length: 60 }, (_, index) => index + 1);
    expect(idBatches(sixty).map((batch) => batch.length)).toEqual([50, 10]);
    const many = Array.from({ length: 130 }, (_, index) => index + 1);
    const batches = idBatches(many);
    expect(batches.map((batch) => batch.length)).toEqual([50, 50]);
    expect(batches[0]![0]).toBe(31);
    expect(batches[1]!.at(-1)).toBe(130);
  });
});

describe("settledPages", () => {
  it("keeps the batches that answered, and fails only when all do", async () => {
    const { settledPages } = await import("@/lib/api/client");
    expect(await settledPages([Promise.resolve(1), Promise.reject(new Error("x")), Promise.resolve(3)])).toEqual([1, 3]);
    await expect(settledPages([Promise.reject(new Error("down"))])).rejects.toThrow("down");
    expect(await settledPages([])).toEqual([]);
  });
});
