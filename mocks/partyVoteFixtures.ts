import { http, HttpResponse } from "msw";
import type { ApiPartyVoteSummaryInput } from "@/lib/api/partyVotes";
import { parliament } from "./parliamentFixtures";

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

export const partyVoteHandlers = [
  http.get(`${API}/parties/:slug/votes`, ({ params }) => {
    const body = summary(String(params.slug));
    return body ? HttpResponse.json(body) : HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });
  }),
];
