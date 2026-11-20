import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/account", async (original) => ({
  ...(await original<typeof import("@/lib/api/account")>()),
  getAccountState: vi.fn(),
}));

describe("an account's lists when its session ended between visits", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("go when the page loads logged out, so the next person on this computer starts clean", async () => {
    const { markSignedOut } = await import("@/lib/account");
    window.localStorage.setItem("politicando:listas-da-conta", "1");
    window.localStorage.setItem("article-votes", JSON.stringify({ 12: 1 }));
    markSignedOut();
    expect(window.localStorage.getItem("article-votes")).toBeNull();
    expect(window.localStorage.getItem("politicando:listas-da-conta")).toBeNull();
  });

  it("stay for a reader who never logged in on this device", async () => {
    const { markSignedOut } = await import("@/lib/account");
    window.localStorage.setItem("article-votes", JSON.stringify({ 12: 1 }));
    markSignedOut();
    expect(window.localStorage.getItem("article-votes")).toBe(JSON.stringify({ 12: 1 }));
  });
});
