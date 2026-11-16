import type { ApiGovernmentHistoryInput, ApiTimelineInput } from "@/lib/api/schemas";

/** A made-up history for the mock API: fictional Prime Ministers and Presidents, on real-shaped dates. */

const ps = { slug: "ps", acronym: "PS", name: "Partido Socialista" };
const psd = { slug: "psd", acronym: "PSD", name: "Partido Social Democrata" };
const cds = { slug: "cds-pp", acronym: "CDS-PP", name: "CDS - Partido Popular" };

const government = (
  code: string,
  name: string,
  primeMinister: string,
  start: string,
  end: string | null,
  parties: (typeof ps)[],
  support: string,
  endReason: string,
  endNote: string | null = null,
) => ({
  code,
  kind: code.startsWith("gp") ? "provisional" : "constitutional",
  name,
  primeMinister,
  start,
  end,
  days: Math.round((Date.parse(end ?? "2026-11-15") - Date.parse(start)) / 86_400_000),
  parties,
  support,
  endReason,
  endNote,
  portalUrl: code >= "gc21" && code.startsWith("gc") ? `https://www.portugal.gov.pt/pt/${code}` : null,
  current: end === null,
});

export const governmentHistory: ApiGovernmentHistoryInput = {
  items: [
    government(
      "gc25",
      "XXV Governo Constitucional",
      "Henrique Valadares",
      "2025-06-05",
      null,
      [psd, cds],
      "Coligação PSD e CDS-PP, minoria",
      "in_office",
    ),
    government(
      "gc24",
      "XXIV Governo Constitucional",
      "Henrique Valadares",
      "2024-04-02",
      "2025-06-05",
      [psd, cds],
      "Coligação PSD e CDS-PP, minoria",
      "confidence_rejected",
      "O Parlamento rejeitou uma moção de confiança; eleições antecipadas.",
    ),
    government("gc23", "XXIII Governo Constitucional", "Beatriz Lacerda", "2019-10-26", "2024-04-02", [ps], "Minoria do PS", "end_of_term"),
    government(
      "gc02",
      "II Governo Constitucional",
      "Rui Montalvão",
      "1978-01-23",
      "1978-08-29",
      [ps, cds],
      "Coligação PS e CDS",
      "dismissed",
    ),
    government(
      "gc01",
      "I Governo Constitucional",
      "Rui Montalvão",
      "1976-07-23",
      "1978-01-23",
      [ps],
      "Minoria do PS",
      "confidence_rejected",
    ),
    government("gp1", "I Governo Provisório", "Afonso Reis Tavares", "1974-05-16", "1976-07-23", [], "Governo provisório", "provisional"),
  ],
  source: "https://www.portugal.gov.pt/",
};

export const timeline: ApiTimelineInput = {
  items: [
    { kind: "president", date: "2026-03-09", endDate: null, title: "Presidente da República: Teresa Albuquerque", detail: null, ref: null },
    {
      kind: "election",
      date: "2025-05-18",
      endDate: null,
      title: "Legislativas 2025",
      detail: "Mais votado: AD - Coligação PSD/CDS (32,10%)",
      ref: { kind: "election", id: "legislativas-2025" },
    },
    { kind: "event", date: "2024-01-01", endDate: null, title: "Um tipo que o site ainda não conhece", detail: null, ref: null },
    { kind: "election", date: "1979-12-02", endDate: null, title: "Legislativas 1979", detail: null, ref: null },
    {
      kind: "president",
      date: "1976-07-14",
      endDate: "2026-03-09",
      title: "Presidente da República: Jorge Vilalobos",
      detail: null,
      ref: null,
    },
  ],
};
