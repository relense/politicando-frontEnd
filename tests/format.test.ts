import { describe, expect, it } from "vitest";
import { decodeParam, formatCardWhen, formatDayHeading } from "@/lib/format";

describe("formatCardWhen", () => {
  it("gives the short weekday, day and month with the Lisbon time", () => {
    expect(formatCardWhen("2026-11-15T21:41:00Z")).toBe("dom., 15 nov. · 21:41");
    expect(formatCardWhen("2026-07-01T11:05:00Z")).toBe("qua., 1 jul. · 12:05");
    expect(formatCardWhen("2026-02-03T09:00:00Z")).toBe("ter., 3 fev. · 09:00");
  });
});

describe("formatDayHeading", () => {
  it("«Ontem» by the Lisbon calendar, also the day after the clocks change", () => {
    // 00:30 on 30 March in Lisbon, after the 23-hour 29 March.
    const now = Date.parse("2026-03-29T23:30:00Z");
    expect(formatDayHeading("2026-03-29T10:00:00Z", now)).toMatch(/^Ontem · /);
    expect(formatDayHeading("2026-03-28T10:00:00Z", now)).not.toMatch(/^Ontem/);
    // 23:30 on 25 October (25 hours): tomorrow is the 26th, not the 27th.
    const late = Date.parse("2026-10-25T23:30:00Z");
    expect(formatDayHeading("2026-10-26T10:00:00Z", late)).toMatch(/^Amanhã · /);
  });
});

describe("decodeParam", () => {
  it("decodes once more, and gives null instead of throwing on a lone %", () => {
    expect(decodeParam("or%C3%A7amento")).toBe("orçamento");
    expect(decodeParam("%")).toBeNull();
    expect(decodeParam("a%E0%A4%A")).toBeNull();
  });
});
