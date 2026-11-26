import { getBudgetProposals, getBudgets } from "@/lib/api/budget";
import { getFeedPage, getInitiatives, getParliament, getParties } from "@/lib/api/client";
import { getContracts } from "@/lib/api/contracts";
import { getBoards, getThreads } from "@/lib/api/forums";
import { localOfficialPath, searchLocalOfficials, type LocalOfficialHit } from "@/lib/api/localOfficials";
import { getPlaces } from "@/lib/api/places";
import { getStories, storyPath } from "@/lib/api/stories";
import { FEATURES } from "@/lib/features";
import { fold, formatDate } from "@/lib/format";
import { initiativePath } from "@/lib/initiatives";
import { partyPath } from "@/lib/parties";

/**
 * One search across the site (/procurar): each section the API can already search (news, stories, initiatives, the
 * Budget, contracts, the forum) asked together, and the lists we have whole (deputies, mayors, places, parties)
 * matched here. A few hits per section; a section that fails is left out, and only all of them failing is an error.
 * Anyone elected locally comes from the backend's name search; an older API without it still has the mayors.
 */

export type SearchHit = { title: string; meta: string | null; href: string };
export type SearchGroup = { key: string; label: string; hits: SearchHit[]; more: string | null };
export type SiteSearch = { state: "too_short" } | { state: "error" } | { state: "done"; groups: SearchGroup[] };

export const MIN_QUERY = 3;
const SHOWN = 5;

/** Every word of the query is in the text, accents and case ignored, parts of words too. */
export function matchesAll(text: string, query: string): boolean {
  const haystack = fold(text);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** Names starting with the query first, then the rest as they came. */
const byStart = <T>(items: T[], name: (item: T) => string, query: string) => {
  const start = fold(query.trim());
  return [...items].sort((a, b) => Number(fold(name(b)).startsWith(start)) - Number(fold(name(a)).startsWith(start)));
};

const LEVELS = { district: "Distrito", municipality: "Município", parish: "Freguesia" } as const;

const BODIES = { CM: "Câmara Municipal", AM: "Assembleia Municipal", AF: "Assembleia de Freguesia" } as const;

/** «Presidente da Junta de Freguesia de Margaride (Felgueiras) · PS»: what they were elected to, and the list. */
function localMeta(item: LocalOfficialHit, acronym: Map<string, string>): string {
  const where = `${item.place.name}${item.municipality ? ` (${item.municipality.name})` : ""}`;
  const body =
    item.president && item.organ === "CM"
      ? `Presidente da Câmara Municipal de ${where}`
      : item.president && item.organ === "AF"
        ? `Presidente da Junta de Freguesia de ${where}`
        : `${BODIES[item.organ]} de ${where}`;
  const list = item.parties.map((slug) => acronym.get(slug) ?? slug.toUpperCase()).join(", ") || item.label || item.list;
  return list ? `${body} · ${list}` : body;
}

async function people(q: string): Promise<SearchHit[]> {
  const [parliament, local, parties] = await Promise.all([
    getParliament().catch(() => null),
    searchLocalOfficials(q, SHOWN * 2).catch(() => null),
    getParties().catch(() => []),
  ]);
  // Without the local search (an older API), the mayors from the places list.
  const municipalities = local ? null : await getPlaces({ level: "municipality" }).catch(() => null);
  if (!parliament && !local && !municipalities) throw new Error("people unavailable");
  const acronym = new Map(parties.map((party) => [party.slug, party.acronym]));
  const deputies = byStart(
    (parliament?.deputies ?? []).filter((deputy) => matchesAll(deputy.name, q)),
    (deputy) => deputy.name,
    q,
  ).map((deputy) => ({
    title: deputy.name,
    meta: [`Deputado à Assembleia da República`, deputy.group, deputy.constituency].filter(Boolean).join(" · "),
    href: `/deputados/${deputy.id}`,
  }));
  const elected = (local ?? []).map((item) => ({
    title: item.name,
    meta: localMeta(item, acronym),
    href: item.localOfficialId ? localOfficialPath(item.localOfficialId) : `/sitios/${item.place.key}#orgaos`,
  }));
  const mayors = byStart(
    (municipalities ?? []).filter((place) => place.mayor && matchesAll(place.mayor.name, q)),
    (place) => place.mayor!.name,
    q,
  ).map((place) => {
    const mayor = place.mayor!;
    const list = mayor.parties.map((slug) => acronym.get(slug) ?? slug.toUpperCase()).join(", ") || mayor.label;
    return {
      title: mayor.name,
      meta: `Presidente da Câmara Municipal de ${place.name}${list ? ` · ${list}` : ""}`,
      href: mayor.id ? localOfficialPath(mayor.id) : `/sitios/${place.key}`,
    };
  });
  // The same person once (a mayor is in both lists' answers only through an older API, but a page links once).
  const seen = new Set<string>();
  return [...deputies, ...elected, ...mayors].filter(
    (hit) => !seen.has(`${hit.title}|${hit.href}`) && seen.add(`${hit.title}|${hit.href}`),
  );
}

async function places(q: string): Promise<SearchHit[]> {
  const [districts, municipalities, parishes] = await Promise.all(
    (["district", "municipality", "parish"] as const).map((level) => getPlaces({ level }).catch(() => null)),
  );
  if (!districts && !municipalities && !parishes) throw new Error("places unavailable");
  const names = new Map([...(districts ?? []), ...(municipalities ?? [])].map((place) => [place.key, place.name]));
  const all = [...(districts ?? []), ...(municipalities ?? []), ...(parishes ?? [])].filter((place) => matchesAll(place.name, q));
  return byStart(all, (place) => place.name, q).map((place) => {
    const parent = place.parentKey ? names.get(place.parentKey) : undefined;
    const level = LEVELS[place.level as keyof typeof LEVELS] ?? null;
    const where = parent ? (place.level === "municipality" ? `distrito de ${parent}` : parent) : null;
    return { title: place.name, meta: [level, where].filter(Boolean).join(" · ") || null, href: `/sitios/${place.key}` };
  });
}

async function parties(q: string): Promise<SearchHit[]> {
  return (await getParties())
    .filter((party) => matchesAll(`${party.acronym} ${party.name}`, q))
    .map((party) => ({ title: party.name, meta: party.acronym, href: partyPath(party.slug) }));
}

async function news(q: string): Promise<SearchHit[]> {
  const page = await getFeedPage({ q, limit: SHOWN });
  return page.articles.map((article) => ({
    title: article.title,
    meta: [article.source, formatDate(article.publishedAt)].filter(Boolean).join(" · "),
    href: `/article/${article.id}`,
  }));
}

async function stories(q: string): Promise<SearchHit[]> {
  const page = await getStories({ q, limit: SHOWN });
  return page.stories.map((story) => ({ title: story.title, meta: `${story.sourceCount} jornais`, href: storyPath(story) }));
}

async function initiatives(q: string): Promise<SearchHit[]> {
  const page = await getInitiatives({ q, limit: SHOWN });
  return page.initiatives.map((item) => ({
    title: item.title,
    meta: [item.type, item.number ? `n.º ${item.number}` : null].filter(Boolean).join(" · ") || null,
    href: initiativePath(item.id),
  }));
}

async function budget(q: string): Promise<{ hits: SearchHit[]; year: number } | null> {
  const budgets = await getBudgets();
  const current = budgets?.items.find((item) => item.proposals > 0);
  if (!current) return null;
  const page = await getBudgetProposals(current.year, { q, limit: SHOWN });
  return {
    year: current.year,
    hits: page.items.map((item) => ({
      title: item.title,
      meta: `OE ${item.year} · proposta n.º ${item.number}`,
      href: `/orcamento/${item.year}/proposta/${item.id}`,
    })),
  };
}

async function contracts(q: string): Promise<SearchHit[]> {
  const page = await getContracts({ q, limit: SHOWN });
  return page.items.map((item) => ({
    title: item.object,
    meta: [item.entities[0]?.name, formatDate(item.signedAt ?? item.publishedAt)].filter(Boolean).join(" · ") || null,
    href: `/contratos/${encodeURIComponent(item.id)}`,
  }));
}

async function forum(q: string): Promise<SearchHit[]> {
  const boards = await getBoards();
  const found = await Promise.all(
    boards.map(async (board) =>
      ((await getThreads(board.board, { q, limit: 3 }).catch(() => null))?.items ?? []).map((thread) => ({ thread, board })),
    ),
  );
  return found
    .flat()
    .slice(0, SHOWN)
    .map(({ thread, board }) => ({ title: thread.title, meta: `Fórum · ${board.name}`, href: `/forum/${board.board}/${thread.id}` }));
}

export async function searchSite(input: string): Promise<SiteSearch> {
  const q = input.trim().slice(0, 100);
  if (q.length < MIN_QUERY) return { state: "too_short" };
  const query = encodeURIComponent(q);
  const asks: { key: string; label: string; run: () => Promise<{ hits: SearchHit[]; more: string | null } | null> }[] = [
    { key: "pessoas", label: "Pessoas", run: async () => ({ hits: await people(q), more: null }) },
    { key: "sitios", label: "Sítios", run: async () => ({ hits: await places(q), more: null }) },
    { key: "partidos", label: "Partidos", run: async () => ({ hits: await parties(q), more: null }) },
    { key: "noticias", label: "Notícias", run: async () => ({ hits: await news(q), more: `/?q=${query}` }) },
    ...(FEATURES.stories ? [{ key: "historias", label: "Histórias", run: async () => ({ hits: await stories(q), more: null }) }] : []),
    {
      key: "iniciativas",
      label: "Iniciativas no Parlamento",
      run: async () => ({ hits: await initiatives(q), more: `/iniciativas?q=${query}` }),
    },
    {
      key: "orcamento",
      label: "Orçamento do Estado",
      run: async () => {
        const found = await budget(q);
        return found ? { hits: found.hits, more: `/orcamento?q=${query}#propostas` } : null;
      },
    },
    { key: "contratos", label: "Contratos públicos", run: async () => ({ hits: await contracts(q), more: `/contratos?q=${query}` }) },
    { key: "forum", label: "Fórum", run: async () => ({ hits: await forum(q), more: null }) },
  ];
  const settled = await Promise.allSettled(asks.map((ask) => ask.run()));
  if (settled.every((entry) => entry.status === "rejected")) return { state: "error" };
  const groups = asks.flatMap((ask, index) => {
    const entry = settled[index]!;
    if (entry.status !== "fulfilled" || !entry.value || entry.value.hits.length === 0) return [];
    return [{ key: ask.key, label: ask.label, hits: entry.value.hits.slice(0, SHOWN), more: entry.value.more }];
  });
  return { state: "done", groups };
}
