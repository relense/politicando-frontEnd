import { describe, expect, it } from "vitest";
import { formatCardWhen } from "@/lib/format";

describe("formatCardWhen", () => {
  it("gives the short weekday, day and month with the Lisbon time", () => {
    expect(formatCardWhen("2026-11-15T21:41:00Z")).toBe("dom., 15 nov. · 21:41");
    expect(formatCardWhen("2026-07-01T11:05:00Z")).toBe("qua., 1 jul. · 12:05");
    expect(formatCardWhen("2026-02-03T09:00:00Z")).toBe("ter., 3 fev. · 09:00");
  });
});
