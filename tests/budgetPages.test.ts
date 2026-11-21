import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const { getBudgets } = vi.hoisted(() => ({ getBudgets: vi.fn() }));
vi.mock("@/lib/api/budget", () => ({ getBudgets }));

describe("loadBudgets", () => {
  beforeEach(() => {
    getBudgets.mockReset();
  });

  it("reads as none when the API doesn't serve Budgets (404), strict or not", async () => {
    const { loadBudgets } = await import("@/lib/budgetPages");
    getBudgets.mockImplementation(() => Promise.reject(new ApiError("Not found", 404, "not_found")));
    expect(await loadBudgets()).toBeNull();
    expect(await loadBudgets({ strict: true })).toBeNull();
  });

  it("strict: the API down throws (an error page to retry), never «não encontrada»", async () => {
    const { loadBudgets } = await import("@/lib/budgetPages");
    getBudgets.mockImplementation(() => Promise.reject(new ApiError("Network error")));
    expect(await loadBudgets()).toBeNull();
    await expect(loadBudgets({ strict: true })).rejects.toThrow("Network error");
  });
});
