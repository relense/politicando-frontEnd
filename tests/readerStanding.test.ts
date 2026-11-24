import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { accountErrorMessage, standingMessage, standingShort } from "@/lib/api/account";
import { activityLabel } from "@/lib/adminReaders";
import { activitySchema } from "@/lib/api/admin";
import { forumErrorMessage } from "@/lib/api/forums";

// A suspended or banned reader stays logged in; login and every participation write answer 403 with the reason
// (backend docs/accounts-api.md). account_suspended's message ends with the end date (ISO, UTC).
const suspended = new ApiError("Account suspended until 2026-12-01", 403, "account_suspended");
const banned = new ApiError("Account banned", 403, "account_banned");

describe("a reader's standing, when the API refuses", () => {
  it("says suspended until the day the API gives, or banned", () => {
    expect(standingMessage(suspended)).toBe(
      "Esta conta está suspensa pela moderação até 01-12-2026. Se achas que é um engano, escreve-nos pela página de feedback.",
    );
    expect(standingMessage(banned)).toBe(
      "Esta conta foi banida pela moderação. Se achas que é um engano, escreve-nos pela página de feedback.",
    );
    expect(accountErrorMessage(suspended)).toBe(standingMessage(suspended));
  });

  it("without a date, no date; anything else isn't about standing", () => {
    const noDate = new ApiError("Account suspended", 403, "account_suspended");
    expect(standingMessage(noDate)).toBe(
      "Esta conta está suspensa pela moderação. Se achas que é um engano, escreve-nos pela página de feedback.",
    );
    expect(standingMessage(new ApiError("x", 429, "rate_limited"))).toBeNull();
    expect(standingMessage(new Error("x"))).toBeNull();
  });

  it("in a few words, for the small buttons (votes, likes, Importa)", () => {
    expect(standingShort(suspended)).toBe("Conta suspensa até 01-12-2026.");
    expect(standingShort(banned)).toBe("Conta banida pela moderação.");
    expect(standingShort(new ApiError("x", 500, null))).toBeNull();
  });
});

describe("a forum post refused for the account's standing", () => {
  it("says so, not «tenta novamente»", () => {
    expect(forumErrorMessage(banned)).toBe(standingMessage(banned));
  });
});

describe("what a reader read", () => {
  it("is a story ticked in «Hoje em 5»", () => {
    const item = activitySchema.parse({ at: "2026-11-23T21:40:00.000Z", kind: "read", text: null, target: null });
    expect(activityLabel(item)).toBe("Marcou como lida no «Hoje em 5»");
  });
});
