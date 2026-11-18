import { http, HttpResponse } from "msw";
import { editorialPosts } from "./editorialFixtures";
import { elections } from "./electionFixtures";
import { parties } from "./fixtures";
import { government } from "./governmentFixtures";
import { deputies, initiatives } from "./parliamentFixtures";

const API = "*/api/v2";

const members = [
  government.primeMinister!,
  ...government.ministries!.flatMap((m) => [m.minister!, ...(m.secretaries ?? [])]),
  ...government.former!,
];

/** The ids the real `/sitemap` would list, from the other fixtures. */
const kinds: Record<string, { id: string | number; lastmod: string | null; level?: string }[]> = {
  party: parties.map((party) => ({ id: party.slug, lastmod: null })),
  deputy: deputies.map((deputy) => ({ id: deputy.id, lastmod: null })),
  "government-member": [...new Set(members.map((member) => member.id))].map((id) => ({ id, lastmod: null })),
  president: [{ id: "presidente-ficticio", lastmod: null }],
  election: elections.items.filter((election) => election.imported).map((election) => ({ id: election.id, lastmod: null })),
  place: [
    { id: "LOCAL-010000", lastmod: null, level: "district" },
    { id: "LOCAL-010100", lastmod: null, level: "municipality" },
    { id: "LOCAL-110000", lastmod: null, level: "district" },
    { id: "LOCAL-111100", lastmod: null, level: "municipality" },
  ],
  initiative: initiatives.slice(0, 5).map((initiative) => ({ id: initiative.id, lastmod: "2026-11-01T10:00:00Z" })),
  editorial: editorialPosts.map((post) => ({ id: post.slug, lastmod: post.publishedAt })),
  case: [],
  "local-official": [{ id: "marta-quintela", lastmod: "2026-11-17T20:00:00Z" }],
  "something-new": [{ id: "x", lastmod: null }],
};

export const sitemapHandlers = [
  http.get(`${API}/sitemap`, () =>
    HttpResponse.json({ pageSize: 10000, kinds: Object.entries(kinds).map(([kind, items]) => ({ kind, count: items.length, pages: 1 })) }),
  ),
  http.get(`${API}/sitemap/:kind`, ({ params }) => {
    const items = kinds[String(params.kind)];
    return items
      ? HttpResponse.json({ kind: params.kind, page: 1, pages: 1, items })
      : HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });
  }),
];
