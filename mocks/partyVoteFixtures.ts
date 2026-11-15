import { http, HttpResponse } from "msw";
import type { ApiPartyVoteSummaryInput } from "@/lib/api/partyVotes";
import { initiatives, parliament } from "./parliamentFixtures";

const API = "*/api/v2";

/** Made-up totals: the bigger the group, the more it votes in favour; agreement falls with distance in the list. */
function summary(slug: string): ApiPartyVoteSummaryInput | null {
  const groups = parliament.groups ?? [];
  const index = groups.findIndex((group) => group.party.slug === slug);
  if (index < 0) return null;
  const favor = 900 - index * 40;
  return {
    legislature: "XVII",
    summary: { total: 1500, favor, against: 300 + index * 20, abstention: 1500 - favor - 300 - index * 20, absent: 0, split: 12 },
    agreement: groups
      .filter((group) => group.party.slug !== slug)
      .map((group, at) => ({ party: { slug: group.party.slug, acronym: group.party.acronym }, compared: 1400, same: 0, pct: 75 - at * 6 })),
    items: [],
    total: 1500,
  };
}

const POSITIONS = ["favor", "favor", "against", "abstention"] as const;

/** One made-up vote per initiative: the position cycles, and every tenth one split the group. */
function votes(slug: string) {
  const offset = slug.length;
  return initiatives.map((initiative, index) => ({
    initiative,
    vote: {
      id: String(90000 + index),
      date: initiative.phaseDate ?? null,
      phase: "Votação na generalidade",
      result: "Aprovado",
      unanimous: false,
    },
    position: POSITIONS[(index + offset) % POSITIONS.length]!,
    split: index % 10 === 3,
    basis: "group" as const,
  }));
}

export const partyVoteHandlers = [
  http.get(`${API}/parties/:slug/votes`, ({ params, request }) => {
    const slug = String(params.slug);
    const body = summary(slug);
    if (!body) return HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });
    const search = new URL(request.url).searchParams;
    const position = search.get("position");
    const page = Number(search.get("page") ?? 1);
    const limit = Number(search.get("limit") ?? 20);
    const matching = votes(slug).filter((item) => !position || (position === "split" ? item.split : item.position === position));
    return HttpResponse.json({ ...body, items: matching.slice((page - 1) * limit, page * limit), total: matching.length });
  }),
];
