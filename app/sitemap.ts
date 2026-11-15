import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getEditorial, getElectionResult, getElections, getGovernment, getParliament, getParties } from "@/lib/api/client";
import { editorialPath } from "@/lib/editorial";
import { electionPath } from "@/lib/elections";
import { partyPath } from "@/lib/parties";
import { SITE_URL } from "@/lib/site";
import type { Election, GovernmentMember } from "@/lib/types";

type Entry = MetadataRoute.Sitemap[number];

const EDITORIAL_PAGES = 20;

const at = (path: string, extra: Omit<Entry, "url"> = {}): Entry => ({ url: `${SITE_URL}${path}`, ...extra });

/** One section of the map; a section whose data is unavailable is left out instead of breaking the rest. */
async function section(load: () => Promise<Entry[]>): Promise<Entry[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

const parties = () => getParties().then((list) => list.map((party) => at(partyPath(party.slug), { changeFrequency: "daily" })));

const deputies = () =>
  getParliament().then((parliament) => parliament.deputies.map((deputy) => at(`/deputados/${deputy.id}`, { changeFrequency: "weekly" })));

async function government(): Promise<Entry[]> {
  const { primeMinister, ministries, former } = await getGovernment();
  const members = [primeMinister, ...ministries.flatMap((ministry) => [ministry.minister, ...ministry.secretaries]), ...former].filter(
    (member): member is GovernmentMember => member !== null,
  );
  return [...new Set(members.map((member) => member.id))].map((id) => at(`/governo/${id}`, { changeFrequency: "monthly" }));
}

/**
 * Every election with results, and, for the latest of each type, every district and municipality page: those are
 * the pages people search for ("resultados eleições Sintra"). Older elections' places stay reachable by links.
 */
async function elections(): Promise<Entry[]> {
  const imported = (await getElections()).filter((election) => election.imported);
  const latest = new Map<string, Election>();
  for (const election of imported) {
    const current = latest.get(election.type);
    if (!current || election.date > current.date) latest.set(election.type, election);
  }
  const places = await Promise.all([...latest.values()].map((election) => section(() => placesOf(election.id))));
  return [...imported.map((election) => at(electionPath(election.id), { changeFrequency: "yearly" })), ...places.flat()];
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

async function editorial(): Promise<Entry[]> {
  const entries: Entry[] = [];
  for (let page = 1; page <= EDITORIAL_PAGES; page++) {
    const { items, total } = await getEditorial({ page, limit: 50 });
    entries.push(...items.map((post) => at(editorialPath(post.slug), { lastModified: post.publishedAt, changeFrequency: "monthly" })));
    if (items.length === 0 || page * 50 >= total) break;
  }
  return entries;
}

/**
 * Our own pages: sections, parties, deputies, Government members, elections and places, and our posts. The news
 * pages are left out: they only carry another outlet's headline and excerpt, and are marked noindex.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const fixed = [
    at("/", { changeFrequency: "hourly" }),
    at("/parlamento", { changeFrequency: "daily" }),
    at("/deputados", { changeFrequency: "weekly" }),
    at("/governo", { changeFrequency: "weekly" }),
    at("/eleicoes", { changeFrequency: "monthly" }),
    at("/historia", { changeFrequency: "monthly" }),
    at("/editorial", { changeFrequency: "daily" }),
  ];
  const sections = await Promise.all([parties, deputies, government, elections, editorial].map(section));
  return [...fixed, ...sections.flat()];
}
