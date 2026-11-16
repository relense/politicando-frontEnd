import type { ApiElectionResultInput, ApiElectionsInput } from "@/lib/api/schemas";

/**
 * Fictional results for the mock API: made-up numbers on a small, real-shaped tree of places (country, the
 * mainland and abroad, two districts, a few municipalities). Every level adds up from the municipalities below it.
 */

type Level = "global" | "national" | "foreign" | "district" | "municipality" | "parish";
type Node = { key: string; name: string; level: Level; dicofre: string | null; children: Node[]; seed: number };

const node = (key: string, name: string, level: Level, dicofre: string | null, seed: number, children: Node[] = []): Node => ({
  key,
  name,
  level,
  dicofre,
  children,
  seed,
});

const TREE = node("GLOBAL-990000", "Total", "global", null, 0, [
  node("LOCAL-500000", "Território nacional", "national", null, 0, [
    node("LOCAL-010000", "Aveiro", "district", "01", 0, [
      node("LOCAL-010100", "Águeda", "municipality", "0101", 3),
      node("LOCAL-010500", "Aveiro", "municipality", "0105", 7),
      node("LOCAL-011300", "Ovar", "municipality", "0113", 11),
    ]),
    node("LOCAL-110000", "Lisboa", "district", "11", 0, [
      node("LOCAL-110600", "Lisboa", "municipality", "1106", 5),
      node("LOCAL-111100", "Sintra", "municipality", "1111", 2),
    ]),
  ]),
  node("FOREIGN-600000", "Estrangeiro", "foreign", null, 0, [node("FOREIGN-610000", "Europa", "municipality", null, 9)]),
]);

const LISTS = [
  { list: "PPD/PSD.CDS-PP", name: "AD - Coligação PSD/CDS", partySlugs: ["psd", "cds-pp"], base: 3200 },
  { list: "PS", name: "Partido Socialista", partySlugs: ["ps"], base: 2400 },
  { list: "CH", name: "CHEGA", partySlugs: ["chega"], base: 2300 },
  { list: "IL", name: "Iniciativa Liberal", partySlugs: ["il"], base: 560 },
  { list: "L", name: "LIVRE", partySlugs: ["livre"], base: 400 },
  { list: "B.E.", name: "Bloco de Esquerda", partySlugs: ["be"], base: 200 },
  { list: "MFI", name: "Movimento Fictício Independente", partySlugs: [], base: 90 },
];

/** Made-up votes in one municipality: each list's base, nudged by the place's seed. */
const leafVotes = (seed: number) => LISTS.map((item, index) => Math.round(item.base * (1 + (((seed * (index + 3)) % 7) - 3) / 10)));

/** An earlier election: the same places, each list's votes moved a little (CHEGA smaller, PS bigger). */
const EARLIER = [1.05, 1.2, 0.8, 1, 1.3, 1.6, 1];

function votesOf(place: Node, earlier = false): number[] {
  if (place.children.length === 0)
    return leafVotes(place.seed).map((votes, index) => (earlier ? Math.round(votes * EARLIER[index]!) : votes));
  return place.children.map((child) => votesOf(child, earlier)).reduce((sum, votes) => sum.map((value, index) => value + votes[index]!));
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 10000) / 100 : null);

/** D'Hondt, as the real results do, for the totals only. */
function mandates(votes: number[], seats: number): number[] {
  const won = votes.map(() => 0);
  for (let seat = 0; seat < seats; seat++) {
    const next = votes.reduce((best, value, index) => (value / (won[index]! + 1) > votes[best]! / (won[best]! + 1) ? index : best), 0);
    won[next]!++;
  }
  return won;
}

function find(key: string, place: Node = TREE, path: Node[] = []): { place: Node; path: Node[] } | null {
  if (place.key === key) return { place, path };
  for (const child of place.children) {
    const found = find(key, child, [...path, place]);
    if (found) return found;
  }
  return null;
}

const ELECTIONS = [
  { id: "legislativas-2025", type: "legislativas", name: "Legislativas 2025", date: "2025-05-18", organs: ["AR"], imported: true },
  { id: "legislativas-2024", type: "legislativas", name: "Legislativas 2024", date: "2024-03-10", organs: ["AR"], imported: true },
  { id: "legislativas-2019", type: "legislativas", name: "Legislativas 2019", date: "2019-10-06", organs: ["AR"], imported: false },
  // Older ones, with results only down to a certain level: listed one per line, by decade.
  {
    id: "legislativas-2015",
    type: "legislativas",
    name: "Legislativas 2015",
    date: "2015-10-04",
    organs: ["AR"],
    imported: true,
    deepestLevel: "municipality",
  },
  {
    id: "legislativas-2011",
    type: "legislativas",
    name: "Legislativas 2011",
    date: "2011-06-05",
    organs: ["AR"],
    imported: true,
    deepestLevel: "municipality",
  },
  {
    id: "legislativas-2009",
    type: "legislativas",
    name: "Legislativas 2009",
    date: "2009-09-27",
    organs: ["AR"],
    imported: true,
    deepestLevel: "district",
  },
  {
    id: "legislativas-2005",
    type: "legislativas",
    name: "Legislativas 2005",
    date: "2005-02-20",
    organs: ["AR"],
    imported: true,
    deepestLevel: "district",
  },
  {
    id: "legislativas-2002",
    type: "legislativas",
    name: "Legislativas 2002",
    date: "2002-03-17",
    organs: ["AR"],
    imported: true,
    deepestLevel: "district",
  },
  {
    id: "legislativas-1999",
    type: "legislativas",
    name: "Legislativas 1999",
    date: "1999-10-10",
    organs: ["AR"],
    imported: true,
    deepestLevel: "country",
  },
  {
    id: "legislativas-1995",
    type: "legislativas",
    name: "Legislativas 1995",
    date: "1995-10-01",
    organs: ["AR"],
    imported: true,
    deepestLevel: "country",
  },
  {
    id: "legislativas-1987",
    type: "legislativas",
    name: "Legislativas 1987",
    date: "1987-07-19",
    organs: ["AR"],
    imported: true,
    deepestLevel: "country",
  },
  {
    id: "legislativas-1983",
    type: "legislativas",
    name: "Legislativas 1983",
    date: "1983-04-25",
    organs: ["AR"],
    imported: true,
    deepestLevel: "country",
  },
  {
    id: "legislativas-1976",
    type: "legislativas",
    name: "Legislativas 1976",
    date: "1976-04-25",
    organs: ["AR"],
    imported: true,
    deepestLevel: "country",
  },
  { id: "autarquicas-2021", type: "autarquicas", name: "Autárquicas 2021", date: "2021-09-26", organs: ["CM", "AM", "AF"], imported: true },
  // Already scheduled: shown on the menu by its date.
  {
    id: "autarquicas-2029",
    type: "autarquicas",
    name: "Autárquicas 2029",
    date: "2029-10-07",
    organs: ["CM", "AM", "AF"],
    imported: false,
  },
] as const;

const summary = (election: (typeof ELECTIONS)[number]) => ({
  id: election.id,
  type: election.type,
  name: election.name,
  date: election.date,
  organs: [...election.organs],
  sourceUrl: "https://www.eleicoes.mai.gov.pt/",
  deepestLevel: "deepestLevel" in election ? election.deepestLevel : null,
});

function turnout(votes: number[], withMandates: number | null) {
  const valid = votes.reduce((a, b) => a + b, 0);
  const blank = Math.round(valid * 0.014);
  const nulls = Math.round(valid * 0.02);
  const voters = valid + blank + nulls;
  const registered = Math.round(voters / 0.6);
  return { registered, voters, turnoutPct: pct(voters, registered), blank, null: nulls, totalMandates: withMandates };
}

const TOTAL_MANDATES = 230;

function lists(votes: number[], seats: number | null) {
  const valid = votes.reduce((a, b) => a + b, 0);
  const won = seats ? mandates(votes, seats) : null;
  return LISTS.map((item, index) => ({
    list: item.list,
    name: item.name,
    partySlugs: item.partySlugs,
    coalition: false,
    citizens: item.partySlugs.length === 0,
    votes: votes[index]!,
    pct: pct(votes[index]!, Math.round(valid * 1.034)),
    validPct: pct(votes[index]!, valid),
    mandates: won ? won[index]! : null,
    presidents: null,
  })).sort((a, b) => b.votes - a.votes);
}

const winnerOf = (votes: number[]) => {
  const all = lists(votes, null);
  const top = all[0]!;
  return { list: top.list, partySlugs: top.partySlugs, votes: top.votes, validPct: top.validPct };
};

/** The next of each kind, as the API sends them: dates only once the decree sets them. */
const UPCOMING = [
  {
    type: "regionais",
    name: "Regionais dos Açores 2028",
    year: 2028,
    date: null,
    confirmed: false,
    window: "Até ao fim de 2028, quatro anos depois das de fevereiro de 2024, salvo dissolução",
    basis: "Estatuto Político-Administrativo da Região Autónoma dos Açores",
  },
  {
    type: "legislativas",
    name: "Legislativas 2029",
    year: 2029,
    date: null,
    confirmed: false,
    window: "Entre 14 de setembro e 14 de outubro de 2029, no fim da legislatura, salvo dissolução",
    basis: "Lei Eleitoral da Assembleia da República, artigo 19.º",
  },
  {
    type: "autarquicas",
    name: "Autárquicas 2029",
    year: 2029,
    date: "2029-10-07",
    confirmed: true,
    window: "Entre 22 de setembro e 14 de outubro de 2029",
    basis: "Lei Eleitoral dos Órgãos das Autarquias Locais, artigo 15.º",
  },
];

export const elections: ApiElectionsInput = {
  items: ELECTIONS.map((election) => {
    const votes = votesOf(TREE, election.id === "legislativas-2024");
    const withMandates = election.type === "legislativas" ? TOTAL_MANDATES : null;
    return {
      ...summary(election),
      imported: election.imported,
      turnout: turnout(votes, withMandates),
      winner: lists(votes, withMandates)[0]!,
    };
  }),
  upcoming: UPCOMING,
};

export type ElectionLookup = { status: 200; body: ApiElectionResultInput } | { status: 400 | 404; code: string };

/** The results of one election in one place, or why there are none, as the real API answers. */
export function electionResult(id: string, key: string | null, organ: string | null): ElectionLookup {
  const election = ELECTIONS.find((item) => item.id === id);
  if (!election || !election.imported) return { status: 404, code: "not_found" };
  const body = organ ?? election.organs[0];
  if (!(election.organs as readonly string[]).includes(body)) return { status: 400, code: "bad_request" };
  const found = find(key ?? TREE.key);
  if (!found) return { status: 404, code: "not_found" };

  const { place, path } = found;
  const earlier = election.id === "legislativas-2024";
  const votes = votesOf(place, earlier);
  const seats = place === TREE && election.type === "legislativas" ? TOTAL_MANDATES : null;
  const plain = (item: Node) => ({ key: item.key, name: item.name, level: item.level, dicofre: item.dicofre });
  return {
    status: 200,
    body: {
      election: summary(election),
      organ: body,
      place: plain(place),
      breadcrumb: path.filter((item) => item !== TREE).map(plain),
      turnout: turnout(votes, seats),
      lists: lists(votes, seats),
      children: place.children.map((child) => ({
        ...plain(child),
        turnoutPct: turnout(votesOf(child, earlier), null).turnoutPct,
        winner: winnerOf(votesOf(child, earlier)),
      })),
    },
  };
}

/**
 * `GET /parties?sort=`: each party with its seats now and its result in the latest legislativas. Coalition partners
 * share the coalition's figures, as the real API does.
 */
export function partiesWithResults<T extends { slug: string; acronym: string }>(
  parties: readonly T[],
  seats: ReadonlyMap<string, number>,
  sort: string | null,
) {
  const result = electionResult("legislativas-2025", null, null);
  const lists = result.status === 200 ? (result.body.lists ?? []) : [];
  const items = parties.map((party) => {
    const own = lists.filter((item) => (item.partySlugs ?? []).includes(party.slug));
    return {
      ...party,
      assemblySeats: seats.get(party.slug) ?? 0,
      seatsAsOf: "2026-10-08",
      governmentMembers: 0,
      lastElection:
        own.length > 0
          ? {
              id: "legislativas-2025",
              date: "2025-05-18",
              votes: own.reduce((sum, item) => sum + item.votes, 0),
              validPct: own.reduce((sum, item) => sum + (item.validPct ?? 0), 0),
              mandates: own.reduce((sum, item) => sum + (item.mandates ?? 0), 0),
              lists: own.map((item) => item.list),
              coalition: own.some((item) => (item.partySlugs ?? []).length > 1),
            }
          : null,
    };
  });
  const byName = (a: T, b: T) => a.acronym.localeCompare(b.acronym, "pt");
  if (sort === "seats") return items.sort((a, b) => b.assemblySeats - a.assemblySeats || byName(a, b));
  if (sort === "votes") return items.sort((a, b) => (b.lastElection?.votes ?? 0) - (a.lastElection?.votes ?? 0) || byName(a, b));
  return items;
}
