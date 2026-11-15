import type { ApiDeputyDetailInput, ApiInitiativeDetailInput, ApiInitiativeInput, ApiParliamentInput } from "@/lib/api/schemas";
import seatMap from "./seatMap.json";

/**
 * Mock Parliament in the shape of the real API (see the backend's docs/parliament-api.md). The seat map is the
 * official one (Deliberação n.º 5-PL/2025); the deputies are generated and fictional, so the mock never
 * attributes anything to a real person.
 */
type SeatRow = [number, string, string, number, number];
const groups = seatMap.groups;

const FIRST = ["Ana", "Rui", "Marta", "Tiago", "Inês", "Nuno", "Sofia", "Pedro", "Rita", "Miguel", "Joana", "Hugo", "Carla", "Duarte", "Beatriz", "Filipe", "Teresa", "Gonçalo", "Leonor", "André", "Catarina", "Bruno", "Helena", "Vasco", "Mariana", "Diogo", "Patrícia", "Ricardo", "Cláudia", "Jorge"];
const LAST = ["Almeida", "Barros", "Cardoso", "Duarte", "Esteves", "Fonseca", "Gomes", "Henriques", "Lopes", "Machado", "Neves", "Oliveira", "Pacheco", "Queirós", "Rebelo", "Sampaio", "Teixeira", "Valente", "Xavier", "Zuzarte", "Antunes", "Brito", "Correia", "Faria", "Garcia", "Mendes", "Pinto", "Ramos", "Sousa", "Vieira", "Matos"];
const CONSTITUENCIES = ["Lisboa", "Porto", "Braga", "Setúbal", "Aveiro", "Leiria", "Coimbra", "Faro", "Santarém", "Viseu", "Madeira", "Açores", "Viana do Castelo", "Vila Real", "Castelo Branco", "Évora", "Guarda", "Beja", "Bragança", "Portalegre", "Europa", "Fora da Europa"];
const ROLES: Record<number, string> = { 0: "Presidente da Assembleia", 1: "Vice-Presidente", 120: "Vice-Presidente", 200: "Secretário da Mesa" };

let order = 0;
const generated = groups.flatMap((group) =>
  Array.from({ length: group.seats }, () => {
    const n = order++;
    const first = FIRST[(n * 7) % FIRST.length]!;
    const last = LAST[(n * 11 + 3) % LAST.length]!;
    return {
      id: 1000 + n,
      name: `${first} ${last}`,
      fullName: `${first} ${LAST[(n * 5 + 17) % LAST.length]!} ${last}`,
      group: group.group,
      party: group.party.slug,
      constituency: CONSTITUENCIES[(n * 3) % CONSTITUENCIES.length]!,
      seat: null,
      parliamentRole: ROLES[n] ?? null,
      photoUrl: null,
    };
  }),
);
// The API lists deputies by name.
const byName = [...generated].sort((a, b) => a.name.localeCompare(b.name, "pt") || a.id - b.id);

const TYPES = ["Projeto de Lei", "Projeto de Resolução", "Proposta de Lei"];
const SUBJECTS = [
  "Reforça o apoio ao arrendamento jovem",
  "Altera o regime de acesso ao Serviço Nacional de Saúde",
  "Cria um programa de requalificação das escolas públicas",
  "Recomenda ao Governo a revisão das tarifas de transportes",
  "Estabelece regras de transparência nos contratos públicos",
  "Aprova medidas de combate aos incêndios rurais",
  "Altera o Código do IRS para rendimentos do trabalho",
  "Reconhece a profissão de cuidador informal",
  "Cria a rede nacional de creches gratuitas",
  "Regula o teletrabalho na administração pública",
];
const STATUSES = ["approved", "in_progress", "in_progress", "approved", "rejected", "in_progress", "approved", "withdrawn"] as const;
const PHASES: Record<(typeof STATUSES)[number], string> = {
  approved: "Lei (Publicação DR)",
  in_progress: "Baixa comissão especialidade",
  rejected: "Votação na generalidade",
  withdrawn: "Retirada da iniciativa",
};
const SLUGS = groups.map((group) => group.party.slug);
const day = (offset: number) => new Date(Date.UTC(2026, 10, 12) - offset * 86_400_000).toISOString().slice(0, 10);

export const initiativeDetails: ApiInitiativeDetailInput[] = Array.from({ length: 48 }, (_, index) => {
  const id = 5000 - index;
  const type = TYPES[index % TYPES.length]!;
  const status = STATUSES[index % STATUSES.length]!;
  const author = generated[(index * 37) % generated.length]!;
  const coAuthor = generated[(index * 37 + 1) % generated.length]!;
  const party = groups.find((group) => group.party.slug === author.party)!.party;
  const government = type === "Proposta de Lei";
  const voted = status === "approved" || status === "rejected";
  const yes = SLUGS.filter((_, i) => (i + index) % 3 !== 0);
  const no = SLUGS.filter((slug) => !yes.includes(slug)).slice(0, 2);
  const abstain = SLUGS.filter((slug) => !yes.includes(slug) && !no.includes(slug));
  const [favor, against] = status === "approved" ? [yes, no] : [no, yes];
  const voteDate = day(index * 2 + 2);
  return {
    id,
    type,
    number: String(400 - index),
    title: `${SUBJECTS[index % SUBJECTS.length]!} (${index + 1})`,
    status,
    phase: PHASES[status],
    phaseDate: day(index * 2),
    submittedAt: day(index * 2 + 40),
    publishedAt: status === "approved" ? day(index * 2) : null,
    textUrl: `http://app.parlamento.pt/webutils/docs/doc.pdf?mock=${id}`,
    authors: government
      ? { parties: [], deputies: [], other: "Governo" }
      : { parties: [party], deputies: [author, coAuthor].map((deputy) => ({ id: deputy.id, name: deputy.name, party: deputy.party })), other: null },
    lastVote: voted
      ? { date: voteDate, phase: status === "approved" ? "Votação final global" : "Votação na generalidade", result: status === "approved" ? "Aprovado" : "Rejeitado", unanimous: index % 10 === 0 }
      : null,
    votes: voted
      ? [
          {
            id: String(90000 + index),
            date: voteDate,
            phase: status === "approved" ? "Votação final global" : "Votação na generalidade",
            result: status === "approved" ? "Aprovado" : "Rejeitado",
            unanimous: index % 10 === 0,
            favor: favor.map((slug) => ({ party: slug, count: null })),
            // A split group: only one of its deputies voted against.
            against: [...against.map((slug) => ({ party: slug, count: null })), ...(index % 4 === 0 ? [{ party: "ps", count: 1 }] : [])],
            abstention: abstain.map((slug) => ({ party: slug, count: null })),
            named: index % 4 === 0 ? [{ name: generated[150]!.name, group: "PS", position: "against" }] : [],
          },
        ]
      : [],
  };
});

export const initiatives: ApiInitiativeInput[] = initiativeDetails.map((detail) => {
  const summary = { ...detail };
  delete summary.votes;
  return summary;
});

export const parliament: ApiParliamentInput = {
  legislature: "XVII",
  updatedAt: "2026-11-15T07:32:10.813Z",
  seatMap: {
    source: seatMap.source,
    width: seatMap.width,
    height: seatMap.height,
    seats: (seatMap.seats as SeatRow[]).map(([number, group, party, x, y]) => ({ number, group, party, x, y, deputyId: null })),
  },
  groups,
  deputies: byName,
  initiativeCounts: Object.fromEntries(STATUSES.map((status) => [status, initiativeDetails.filter((item) => item.status === status).length])),
};

export const deputies = byName;

/** The profile for one deputy, with their initiatives and the news that mention them. */
export function deputyDetail(id: number, articles: ApiDeputyDetailInput["articles"]): ApiDeputyDetailInput | null {
  const deputy = generated.find((item) => item.id === id);
  if (!deputy) return null;
  const party = groups.find((group) => group.party.slug === deputy.party)!.party;
  const authored = initiatives.filter((item) => item.authors.deputies?.some((author) => author.id === id));
  return {
    ...deputy,
    partyInfo: party,
    situation: "Efetivo",
    active: true,
    birthDate: `19${60 + (id % 35)}-0${1 + (id % 9)}-1${id % 10}`,
    profession: ["Professor", "Jurista", "Economista", "Engenheira", "Médico"][id % 5],
    education: [{ course: ["Direito", "Economia", "Engenharia Civil", "Medicina", "História"][id % 5]!, completed: true }],
    roles: [],
    committees: [{ name: "Comissão de Orçamento, Finanças e Administração Pública", acronym: "COFAP", membership: "Efetivo", role: null }],
    pastLegislatures: id % 3 ? ["XVI"] : [],
    initiatives: {
      total: authored.length,
      approved: authored.filter((item) => item.status === "approved").length,
      latest: authored.slice(0, 10),
    },
    articles,
  };
}
