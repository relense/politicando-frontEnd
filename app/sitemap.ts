import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getElectionResult, getElections } from "@/lib/api/client";
import { getLegislatures, legislaturePath } from "@/lib/api/legislatures";
import { getSitemapItems, type SitemapItem, type SitemapKind } from "@/lib/api/sitemap";
import { localOfficialPath } from "@/lib/api/localOfficials";
import { editorialPath } from "@/lib/editorial";
import { FEATURES } from "@/lib/features";
import { LOCAL_POSTS } from "@/lib/localPosts";
import { electionPath } from "@/lib/elections";
import { partyPath } from "@/lib/parties";
import { SITE_URL } from "@/lib/site";
import type { Election } from "@/lib/types";

type Entry = MetadataRoute.Sitemap[number];
type Frequency = Entry["changeFrequency"];

const at = (path: string, extra: Omit<Entry, "url"> = {}): Entry => ({ url: `${SITE_URL}${path}`, ...extra });

/** Where each kind the backend lists lives on our site. `null`: no page of its own (the President has one page, below). */
const ROUTES: Record<SitemapKind, { path: ((id: string) => string) | null; changeFrequency: Frequency }> = {
  party: { path: partyPath, changeFrequency: "daily" },
  deputy: { path: (id) => `/deputados/${id}`, changeFrequency: "weekly" },
  "government-member": { path: (id) => `/governo/${id}`, changeFrequency: "monthly" },
  president: { path: null, changeFrequency: "monthly" },
  election: { path: (id) => electionPath(id), changeFrequency: "yearly" },
  place: { path: (id) => `/sitios/${id}`, changeFrequency: "monthly" },
  initiative: { path: (id) => `/iniciativas/${id}`, changeFrequency: "weekly" },
  editorial: { path: editorialPath, changeFrequency: "monthly" },
  case: { path: FEATURES.record ? (id) => `/registo/${id}` : null, changeFrequency: "monthly" },
  "local-official": { path: localOfficialPath, changeFrequency: "monthly" },
};

/** Districts and municipalities before parishes, as the backend suggests. */
const LEVEL_ORDER: Record<string, number> = { district: 0, municipality: 1, parish: 2 };

/** One section of the map; a section whose data is unavailable is left out instead of breaking the rest. */
async function section(load: () => Promise<Entry[]>): Promise<Entry[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

/** Our data pages, as listed by the backend's `/sitemap`, with their real last change when it is known. */
async function dataPages(): Promise<Entry[]> {
  const kinds = await getSitemapItems();
  return (Object.entries(kinds) as [SitemapKind, SitemapItem[]][]).flatMap(([kind, items]) => {
    const { path, changeFrequency } = ROUTES[kind];
    if (!path) return [];
    const ordered =
      kind === "place" ? [...items].sort((a, b) => (LEVEL_ORDER[a.level ?? ""] ?? 3) - (LEVEL_ORDER[b.level ?? ""] ?? 3)) : items;
    return ordered.map((item) => at(path(item.id), { changeFrequency, ...(item.lastmod ? { lastModified: item.lastmod } : {}) }));
  });
}

/**
 * For the latest election of each type, its district and municipality result pages: those are what people search
 * for ("resultados eleições Sintra"). Older elections' places stay reachable by links.
 */
async function latestElectionPlaces(): Promise<Entry[]> {
  const latest = new Map<string, Election>();
  for (const election of (await getElections()).filter((item) => item.imported)) {
    const current = latest.get(election.type);
    if (!current || election.date > current.date) latest.set(election.type, election);
  }
  const places = await Promise.all([...latest.values()].map((election) => section(() => placesOf(election.id))));
  return places.flat();
}

/** Down from the top level through the national territory to the districts and their municipalities. */
async function placesOf(id: string): Promise<Entry[]> {
  const top = await getElectionResult(id);
  const regions = top.children.filter((child) => child.level === "national" || child.level === "foreign");
  const districts = (await Promise.all(regions.map((region) => getElectionResult(id, { place: region.key }).catch(() => null))))
    .flatMap((result) => result?.children ?? [])
    .filter((child) => child.level === "district");
  const municipalities = (await Promise.all(districts.map((district) => getElectionResult(id, { place: district.key }).catch(() => null))))
    .flatMap((result) => result?.children ?? [])
    .filter((child) => child.level === "municipality");
  return [...regions, ...districts, ...municipalities].map((place) => at(electionPath(id, place.key), { changeFrequency: "yearly" }));
}

/**
 * Our own pages: the sections, then every data page the backend lists (parties, deputies, Government members,
 * elections, places, initiatives, posts, cases) and the latest elections' local results. Under Google's 50 000
 * URLs per file, so one file is enough. News pages are left out: they only carry another outlet's headline and
 * excerpt, and are marked noindex. Forum threads are readers' posts, also noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const fixed = [
    at("/", { changeFrequency: "hourly" }),
    at("/parlamento", { changeFrequency: "daily" }),
    at("/partidos", { changeFrequency: "weekly" }),
    at("/governo", { changeFrequency: "weekly" }),
    at("/presidente", { changeFrequency: "weekly" }),
    at("/agenda", { changeFrequency: "daily" }),
    at("/forum", { changeFrequency: "daily" }),
    at("/feedback", { changeFrequency: "daily" }),
    at("/feedback/correcoes", { changeFrequency: "weekly" }),
    at("/feedback/nova", { changeFrequency: "monthly" }),
    at("/legislaturas", { changeFrequency: "monthly" }),
    at("/privacidade", { changeFrequency: "yearly" }),
    at("/cookies", { changeFrequency: "yearly" }),
    at("/termos", { changeFrequency: "yearly" }),
    at("/sobre", { changeFrequency: "yearly" }),
    at("/previsoes", { changeFrequency: "daily" }),
    at("/iniciativas", { changeFrequency: "daily" }),
    at("/eleicoes", { changeFrequency: "monthly" }),
    at("/sitios", { changeFrequency: "monthly" }),
    at("/contratos", { changeFrequency: "weekly" }),
    at("/orcamento", { changeFrequency: "daily" }),
    at("/historia", { changeFrequency: "monthly" }),
    at("/percursos", { changeFrequency: "monthly" }),
    at("/editorial", { changeFrequency: "daily" }),
    at("/newsletter", { changeFrequency: "yearly" }),
  ];
  const own = LOCAL_POSTS.map((post) => at(editorialPath(post.slug), { lastModified: post.publishedAt, changeFrequency: "monthly" }));
  const [data, places, legislatures] = await Promise.all([
    section(dataPages),
    section(latestElectionPlaces),
    section(async () =>
      (await getLegislatures()).map((item) => at(legislaturePath(item.id), { changeFrequency: item.current ? "weekly" : "yearly" })),
    ),
  ]);
  const seen = new Set<string>();
  return [...fixed, ...own, ...data, ...places, ...legislatures].filter((entry) => !seen.has(entry.url) && Boolean(seen.add(entry.url)));
}
