import { http, HttpResponse } from "msw";
import type { ApiPlaceDetail, ApiPlaceList } from "@/lib/api/places";
import { deputies } from "./parliamentFixtures";

/**
 * Places for the mock API: the same small tree as the election mocks (two districts, five municipalities), with a
 * few parishes. The places are real; the mayors and every number are made up.
 */

type Mayor = NonNullable<ApiPlaceList["items"][number]["mayor"]>;
type Level = "district" | "municipality" | "parish";
type Node = { key: string; name: string; level: Level; parent: string | null; mayor?: Mayor; nif?: string; seed: number };

const mayor = (name: string, list: string, label: string, parties: string[]): Mayor => ({
  name,
  list,
  label,
  parties,
  election: "autarquicas-2021",
});

const NATIONAL = { key: "LOCAL-500000", name: "Território nacional", level: "national" as const, dicofre: null };

const PLACES: Node[] = [
  { key: "LOCAL-010000", name: "Aveiro", level: "district", parent: null, seed: 1 },
  { key: "LOCAL-110000", name: "Lisboa", level: "district", parent: null, seed: 2 },
  {
    key: "LOCAL-010100",
    name: "Águeda",
    level: "municipality",
    parent: "LOCAL-010000",
    mayor: mayor("Marta Quintela", "PS", "PARTIDO SOCIALISTA", ["ps"]),
    nif: "500000101",
    seed: 3,
  },
  {
    key: "LOCAL-010500",
    name: "Aveiro",
    level: "municipality",
    parent: "LOCAL-010000",
    mayor: mayor("Duarte Fontoura", "PPD/PSD.CDS-PP.PPM", "ALIANÇA COM AVEIRO", ["psd", "cds-pp", "ppm"]),
    nif: "500000105",
    seed: 7,
  },
  {
    key: "LOCAL-011300",
    name: "Ovar",
    level: "municipality",
    parent: "LOCAL-010000",
    mayor: mayor("Luísa Barreto", "PPD/PSD", "PARTIDO SOCIAL DEMOCRATA", ["psd"]),
    nif: "500000113",
    seed: 11,
  },
  {
    key: "LOCAL-110600",
    name: "Lisboa",
    level: "municipality",
    parent: "LOCAL-110000",
    mayor: mayor("Gaspar Antunes Leal", "PPD/PSD.CDS-PP.IL", "NOVOS TEMPOS", ["psd", "cds-pp", "il"]),
    nif: "500000606",
    seed: 5,
  },
  {
    key: "LOCAL-111100",
    name: "Sintra",
    level: "municipality",
    parent: "LOCAL-110000",
    mayor: mayor("Helena Seixas", "MIS", "MOVIMENTO INDEPENDENTE POR SINTRA", []),
    seed: 2,
  },
  { key: "LOCAL-010103", name: "Aguada de Cima", level: "parish", parent: "LOCAL-010100", seed: 4 },
  { key: "LOCAL-010109", name: "Fermentelos", level: "parish", parent: "LOCAL-010100", seed: 6 },
  { key: "LOCAL-010112", name: "Macinhata do Vouga", level: "parish", parent: "LOCAL-010100", seed: 8 },
];

const dicofre = (key: string, level: Level) => key.slice(6, level === "district" ? 8 : level === "municipality" ? 10 : 12);
const ref = (node: Node) => ({ key: node.key, name: node.name, level: node.level, dicofre: dicofre(node.key, node.level) });
const byKey = (key: string | null) => PLACES.find((node) => node.key === key);

const LISTS = [
  { list: "PS", label: "PARTIDO SOCIALISTA", parties: ["ps"] },
  { list: "PPD/PSD.CDS-PP", label: "COLIGAÇÃO PSD/CDS", parties: ["psd", "cds-pp"] },
  { list: "CH", label: "CHEGA", parties: ["chega"] },
  { list: "MIC", label: "MOVIMENTO INDEPENDENTE DO CONCELHO", parties: [] },
];

/** Seats on one council: the mayor's list first, made-up votes nudged by the place's seed. */
function seats(node: Node, total: number) {
  const winner = node.mayor ?? byKey(node.parent)?.mayor;
  const lists = winner
    ? [{ list: winner.list, label: winner.label, parties: winner.parties }, ...LISTS.filter((item) => item.list !== winner.list)]
    : LISTS;
  const votes = lists.slice(0, 4).map((_, index) => Math.round((4000 / (index + 1)) * (1 + ((node.seed * (index + 2)) % 5) / 20)));
  const valid = votes.reduce((a, b) => a + b, 0);
  const won = votes.map(() => 0);
  for (let seat = 0; seat < total; seat++) {
    const next = votes.reduce((best, value, index) => (value / (won[index]! + 1) > votes[best]! / (won[best]! + 1) ? index : best), 0);
    won[next]!++;
  }
  return lists.slice(0, 4).map((item, index) => ({
    ...item,
    votes: votes[index]!,
    validPct: Math.round((votes[index]! / valid) * 10000) / 100,
    mandates: won[index]!,
  }));
}

const districtOf = (node: Node): Node => (node.level === "district" ? node : districtOf(byKey(node.parent)!));

function detail(node: Node): ApiPlaceDetail {
  const district = districtOf(node);
  const circle = deputies.filter((deputy) => deputy.constituency === district.name).slice(0, 6);
  const winner = (node.mayor ?? byKey(node.parent)?.mayor ?? PLACES[2]!.mayor)!;
  return {
    ...ref(node),
    parent: node.parent ? ref(byKey(node.parent)!) : NATIONAL,
    children: PLACES.filter((child) => child.parent === node.key).map(ref),
    mayor: node.mayor ?? null,
    council:
      node.level === "district"
        ? null
        : {
            election: "autarquicas-2021",
            organs:
              node.level === "municipality"
                ? [
                    { organ: "CM", totalMandates: 9, seats: seats(node, 9) },
                    { organ: "AM", totalMandates: 27, seats: seats(node, 27) },
                  ]
                : [{ organ: "AF", totalMandates: 9, seats: seats(node, 9) }],
          },
    deputies: {
      circle: { key: district.key, name: district.name },
      items: circle.map((deputy) => ({
        id: deputy.id,
        name: deputy.name,
        photoUrl: deputy.photoUrl,
        party: { slug: deputy.party, acronym: deputy.party.toUpperCase() },
      })),
    },
    elections: [
      {
        election: "legislativas-2025",
        name: "Legislativas 2025",
        date: "2025-05-18",
        organ: "AR",
        turnoutPct: 58 + (node.seed % 7),
        winner: { list: "PPD/PSD.CDS-PP", label: "AD - COLIGAÇÃO PSD/CDS", validPct: 31 + node.seed },
      },
      ...(node.level === "district"
        ? []
        : [
            {
              election: "autarquicas-2021",
              name: "Autárquicas 2021",
              date: "2021-09-26",
              organ: node.level === "parish" ? "AF" : "CM",
              turnoutPct: 50 + (node.seed % 9),
              winner: { list: winner.list, label: winner.label, validPct: 38 + node.seed },
            },
          ]),
    ],
    contracts: {
      carriedOut: { count: 120 * node.seed, total: 2_500_000 * node.seed },
      council: node.nif
        ? {
            nif: node.nif,
            name: `Município de ${node.name}`,
            count: 40 * node.seed,
            total: 900_000 * node.seed,
            directAwards: 17 * node.seed,
          }
        : null,
    },
  };
}

const API = "*/api/v2";

export const placeHandlers = [
  http.get(`${API}/places`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const level = params.get("level") ?? "municipality";
    const parent = params.get("parent");
    const items = PLACES.filter((node) => node.level === level && (!parent || node.parent === parent)).map((node) => ({
      ...ref(node),
      parentKey: node.parent ?? NATIONAL.key,
      mayor: node.mayor ?? null,
    }));
    return HttpResponse.json({ items } satisfies ApiPlaceList);
  }),
  http.get(`${API}/places/:key`, ({ params }) => {
    const node = byKey(String(params.key));
    return node
      ? HttpResponse.json(detail(node))
      : HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });
  }),
];
