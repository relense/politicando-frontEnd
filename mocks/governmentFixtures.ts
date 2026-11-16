import type { ApiGovernmentInput, ApiGovernmentMemberDetailInput } from "@/lib/api/schemas";
import { deputies } from "./parliamentFixtures";

/**
 * Mock Government in the shape of the real API (see the backend's docs/government-api.md). The people are
 * fictional, so the mock never attributes a post to a real person. One minister came from Parliament and links
 * to a (fictional) deputy, as some real ones do.
 */
const id = (n: number) => n.toString(16).padStart(32, "0");
const formerDeputy = deputies.find((deputy) => deputy.party === "psd")!;

type Kind = "prime_minister" | "minister" | "secretary_of_state";
const member = (n: number, name: string, title: string, kind: Kind, gender: "M" | "F", extra: object = {}) => ({
  id: id(n),
  name,
  title,
  kind,
  gender,
  photoUrl: null,
  startDate: "2025-06-05",
  endDate: null,
  deputyId: null,
  party: null,
  ...extra,
});

const primeMinister = member(1, "Henrique Valadares", "Primeiro-Ministro", "prime_minister", "M", { party: "psd", partySource: "curated" });
const MINISTRIES: [string, string, [string, "M" | "F"], [string, "M" | "F"][]][] = [
  [
    "financas",
    "Finanças",
    ["Teresa Monforte", "F"],
    [
      ["Rui Albergaria", "M"],
      ["Inês Calheiros", "F"],
    ],
  ],
  ["negocios-estrangeiros", "Negócios Estrangeiros", ["Duarte Pimentel", "M"], [["Sofia Arriaga", "F"]]],
  [
    "saude",
    "Saúde",
    ["Marta Quintela", "F"],
    [
      ["Jorge Bettencourt", "M"],
      ["Leonor Vasconcelos", "F"],
    ],
  ],
  ["educacao", "Educação, Ciência e Inovação", ["Afonso Brandão", "M"], [["Carla Meireles", "F"]]],
  ["presidencia", "Presidência", [formerDeputy.name, "M"], []],
];

let n = 10;
export const government: ApiGovernmentInput = {
  government: { code: "gc25", name: "XXV Governo Constitucional", startDate: "2025-06-05", updatedAt: "2026-11-15T08:54:27.902Z" },
  primeMinister,
  ministries: [
    { area: "primeiro-ministro", name: "Primeiro-Ministro", minister: primeMinister, secretaries: [] },
    ...MINISTRIES.map(([area, name, [minister, gender], secretaries]) => ({
      area,
      name,
      minister: member(
        n++,
        minister,
        `${gender === "F" ? "Ministra" : "Ministro"} ${name === "Presidência" ? "da" : "das"} ${name}`,
        "minister",
        gender,
        minister === formerDeputy.name
          ? { deputyId: formerDeputy.id, party: formerDeputy.party, partySource: "deputy" }
          : minister === "Teresa Monforte"
            ? { independent: true }
            : {},
      ),
      secretaries: secretaries.map(([secretary, g]) =>
        member(n++, secretary, `${g === "F" ? "Secretária" : "Secretário"} de Estado de ${name}`, "secretary_of_state", g),
      ),
    })),
  ],
  former: [
    {
      ...member(90, "Gaspar Lacerda", "Ministro da Administração Interna", "minister", "M"),
      endDate: "2026-02-11",
      areaName: "Administração Interna",
    },
  ],
};

const everyone = [
  government.primeMinister!,
  ...government.ministries!.flatMap((m) => [m.minister!, ...(m.secretaries ?? [])]),
  ...government.former!,
];

/** A member's page, with the news that names them. */
export function governmentMember(
  memberId: string,
  articles: ApiGovernmentMemberDetailInput["articles"],
): ApiGovernmentMemberDetailInput | null {
  const found = everyone.find((item) => item.id === memberId);
  if (!found) return null;
  const inOffice = !found.endDate;
  return {
    id: found.id,
    name: found.name,
    gender: found.gender,
    photoUrl: null,
    bio: [`${found.name} é uma pessoa fictícia, usada nos dados de teste.`, "Licenciatura e percurso profissional de exemplo."],
    links: found.kind === "prime_minister" ? [{ network: "X", url: "https://x.com/exemplo" }] : [],
    inOffice,
    deputy: found.deputyId ? { id: found.deputyId, name: found.name, party: found.party } : null,
    positions: [
      {
        title: found.title,
        kind: found.kind,
        area: null,
        areaName: found.areaName ?? null,
        government: "gc25",
        startDate: found.startDate,
        endDate: found.endDate,
        url: "https://portugal.gov.pt/pt/gc25",
      },
    ],
    articles,
  };
}
