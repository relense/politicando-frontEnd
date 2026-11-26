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

/** "Marta Quintela" → "marta-quintela", the readable id the API gives each mayor's page. */
const slugOf = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const mayor = (name: string, list: string, label: string, parties: string[]): Mayor => ({
  id: slugOf(name),
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

const FIRST = ["Alda", "Bruno", "Carla", "Dinis", "Elsa", "Fábio", "Glória", "Hugo", "Inês", "Jaime", "Lívia", "Mauro", "Nádia", "Óscar"];
const LAST = ["Arnaut", "Bettencourt", "Calado", "Damasceno", "Esteves", "Falcão", "Gouveia", "Horta", "Lacerda", "Meireles", "Nóbrega"];
/** Made-up names for the people a list elected, in list order; the winning list's first is the president. */
function members(node: Node, organ: string, listIndex: number, count: number, winner: Mayor | undefined) {
  return Array.from({ length: count }, (_, index) => {
    const seed = node.seed * 31 + listIndex * 7 + index * 3 + organ.length;
    const head = listIndex === 0 && index === 0;
    const name = head && organ === "CM" && winner ? winner.name : `${FIRST[seed % FIRST.length]} ${LAST[(seed * 5) % LAST.length]}`;
    return {
      name,
      position: index + 1,
      role: head && organ !== "AM" ? "presidente" : null,
      localOfficialId: head && organ === "CM" && winner ? (winner.id ?? null) : null,
    };
  });
}

/** Seats on one council: the mayor's list first, made-up votes nudged by the place's seed. */
function seats(node: Node, total: number, organ: string) {
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
    // Sintra stands for an API that hasn't imported the names yet.
    ...(node.key === "LOCAL-111100"
      ? {}
      : // Águeda's second câmara list: the map's names don't add up to its seats, so the API sends none.
        {
          members: node.key === "LOCAL-010100" && organ === "CM" && index === 1 ? [] : members(node, organ, index, won[index]!, node.mayor),
        }),
  }));
}

/** The head of the most-voted list in the parish's assembly, as the API works it out. */
function juntaPresident(node: Node) {
  const [top] = seats(node, 9, "AF");
  const head = top!.members?.[0];
  return head ? { name: head.name, list: top!.list, label: top!.label, parties: top!.parties, election: "autarquicas-2021" } : null;
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
    juntaPresident: node.level === "parish" ? juntaPresident(node) : null,
    council:
      node.level === "district"
        ? null
        : {
            election: "autarquicas-2021",
            organs:
              node.level === "municipality"
                ? [
                    { organ: "CM", totalMandates: 9, seats: seats(node, 9, "CM") },
                    { organ: "AM", totalMandates: 27, seats: seats(node, 27, "AM") },
                  ]
                : [{ organ: "AF", totalMandates: 9, seats: seats(node, 9, "AF") }],
            ...(node.key === "LOCAL-111100"
              ? {}
              : { source: { name: "CNE, Mapa Oficial dos resultados (exemplo)", url: "https://www.cne.pt/", asOf: "2022-03-01" } }),
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
  // A mayor's own page (places-api.md "GET /local-officials/:id").
  http.get(`${API}/local-officials/:id`, ({ params }) => {
    const node = PLACES.find((item) => item.mayor?.id === params.id);
    if (!node?.mayor) return HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });
    const district = node.parent ? byKey(node.parent) : null;
    const words = node.mayor.name.split(" ");
    return HttpResponse.json({
      id: node.mayor.id,
      name: node.mayor.name,
      shortName: words.length > 2 ? `${words[0]} ${words.at(-1)}` : node.mayor.name,
      role: "mayor",
      title: `Presidente da Câmara Municipal de ${node.name}`,
      place: { key: node.key, name: node.name, level: "municipality" },
      district: district ? { key: district.key, name: district.name, level: "district" } : null,
      list: node.mayor.list,
      label: node.mayor.label,
      parties: node.mayor.parties,
      election: "autarquicas-2025",
      term: { start: "2025-10-12", end: "2029-10-12" },
      current: true,
      otherRoles: [
        {
          kind: "candidate",
          title: "Candidatura às Legislativas 2024",
          detail: "Nº 9 da lista, Aveiro",
          date: "2024-03-10",
          current: false,
          elected: false,
          link: "/elections/legislativas-2024/candidates",
        },
      ],
      articles: [],
      updatedAt: "2026-11-17T20:00:00Z",
    });
  }),
  http.get(`${API}/places/:key`, ({ params }) => {
    const node = byKey(String(params.key));
    return node
      ? HttpResponse.json(detail(node))
      : HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });
  }),
];
