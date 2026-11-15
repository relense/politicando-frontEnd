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

function votesOf(place: Node): number[] {
  if (place.children.length === 0) return leafVotes(place.seed);
  return place.children.map(votesOf).reduce((sum, votes) => sum.map((value, index) => value + votes[index]!));
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
  { id: "legislativas-2019", type: "legislativas", name: "Legislativas 2019", date: "2019-10-06", organs: ["AR"], imported: false },
  { id: "autarquicas-2021", type: "autarquicas", name: "Autárquicas 2021", date: "2021-09-26", organs: ["CM", "AM", "AF"], imported: true },
] as const;

const summary = (election: (typeof ELECTIONS)[number]) => ({
  id: election.id,
  type: election.type,
  name: election.name,
  date: election.date,
  organs: [...election.organs],
  sourceUrl: "https://www.eleicoes.mai.gov.pt/",
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

export const elections: ApiElectionsInput = {
  items: ELECTIONS.map((election) => {
    const votes = votesOf(TREE);
    const withMandates = election.type === "legislativas" ? TOTAL_MANDATES : null;
    return {
      ...summary(election),
      imported: election.imported,
      turnout: turnout(votes, withMandates),
      winner: lists(votes, withMandates)[0]!,
    };
  }),
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
  const votes = votesOf(place);
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
        turnoutPct: turnout(votesOf(child), null).turnoutPct,
        winner: winnerOf(votesOf(child)),
      })),
    },
  };
}

/** A place on its own, as `GET /places/:key` answers. */
export function placeOf(key: string) {
  const found = find(key);
  return found ? { key: found.place.key, name: found.place.name, level: found.place.level, dicofre: found.place.dicofre } : null;
}
