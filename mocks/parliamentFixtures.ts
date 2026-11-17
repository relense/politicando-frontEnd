import type { ApiDeputyDetailInput, ApiInitiativeDetailInput, ApiInitiativeInput, ApiParliamentInput } from "@/lib/api/schemas";
import seatMap from "./seatMap.json";

/**
 * Mock Parliament in the shape of the real API (see the backend's docs/parliament-api.md). The seat map is the
 * official one (Deliberação n.º 5-PL/2025); the deputies are generated and fictional, so the mock never
 * attributes anything to a real person.
 */
type SeatRow = [number, string, string, number, number];
const groups = seatMap.groups;

const FIRST = [
  "Ana",
  "Rui",
  "Marta",
  "Tiago",
  "Inês",
  "Nuno",
  "Sofia",
  "Pedro",
  "Rita",
  "Miguel",
  "Joana",
  "Hugo",
  "Carla",
  "Duarte",
  "Beatriz",
  "Filipe",
  "Teresa",
  "Gonçalo",
  "Leonor",
  "André",
  "Catarina",
  "Bruno",
  "Helena",
  "Vasco",
  "Mariana",
  "Diogo",
  "Patrícia",
  "Ricardo",
  "Cláudia",
  "Jorge",
];
const LAST = [
  "Almeida",
  "Barros",
  "Cardoso",
  "Duarte",
  "Esteves",
  "Fonseca",
  "Gomes",
  "Henriques",
  "Lopes",
  "Machado",
  "Neves",
  "Oliveira",
  "Pacheco",
  "Queirós",
  "Rebelo",
  "Sampaio",
  "Teixeira",
  "Valente",
  "Xavier",
  "Zuzarte",
  "Antunes",
  "Brito",
  "Correia",
  "Faria",
  "Garcia",
  "Mendes",
  "Pinto",
  "Ramos",
  "Sousa",
  "Vieira",
  "Matos",
];
const CONSTITUENCIES = [
  "Lisboa",
  "Porto",
  "Braga",
  "Setúbal",
  "Aveiro",
  "Leiria",
  "Coimbra",
  "Faro",
  "Santarém",
  "Viseu",
  "Madeira",
  "Açores",
  "Viana do Castelo",
  "Vila Real",
  "Castelo Branco",
  "Évora",
  "Guarda",
  "Beja",
  "Bragança",
  "Portalegre",
  "Europa",
  "Fora da Europa",
];
const ROLES: Record<number, string> = {
  0: "Presidente da Assembleia",
  1: "Vice-Presidente",
  120: "Vice-Presidente",
  200: "Secretário da Mesa",
};

// Like the backend, each party's deputies are given its official seats, the first ones (the most important)
// in the front rows. Who sits where is an estimate, so every seat is marked as such.
const rows = seatMap.seats as SeatRow[];
const frontFirst = (slug: string) =>
  rows
    .filter((row) => row[2] === slug)
    .sort((a, b) => Math.hypot(a[3] - 0.5, seatMap.height - a[4]) - Math.hypot(b[3] - 0.5, seatMap.height - b[4]))
    .map((row) => row[0]);
const seatsByParty = new Map(groups.map((group) => [group.party.slug, frontFirst(group.party.slug)]));

let order = 0;
const generated = groups.flatMap((group) =>
  Array.from({ length: group.seats }, (_, index) => {
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
      seat: seatsByParty.get(group.party.slug)![index]!,
      seatEstimated: true,
      positions: index === 0 ? ["Líder do grupo parlamentar"] : index === 1 ? ["Vice-presidente do grupo parlamentar"] : [],
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

/** Topics for each subject above, by keyword, as the API tags them; some fit none. */
const TOPICS: { slug: string; label: string }[][] = [
  [{ slug: "habitacao", label: "Habitação e urbanismo" }],
  [{ slug: "saude", label: "Saúde" }],
  [{ slug: "educacao", label: "Educação" }],
  [{ slug: "transportes", label: "Transportes e mobilidade" }],
  [{ slug: "transparencia", label: "Transparência e corrupção" }],
  [{ slug: "seguranca", label: "Segurança e proteção civil" }],
  [
    { slug: "impostos", label: "Impostos" },
    { slug: "trabalho", label: "Trabalho e salários" },
  ],
  [],
  [{ slug: "pensoes", label: "Pensões e apoios sociais" }],
  [{ slug: "trabalho", label: "Trabalho e salários" }],
];

const PLAIN_TYPES: Record<string, { label: string; explainer: string; makesLaw: boolean }> = {
  "Projeto de Lei": {
    label: "Proposta de lei dos deputados",
    explainer: "Uma lei nova ou uma alteração a uma lei, proposta por deputados.",
    makesLaw: true,
  },
  "Proposta de Lei": {
    label: "Proposta de lei do Governo",
    explainer: "Uma lei nova ou uma alteração a uma lei, proposta pelo Governo.",
    makesLaw: true,
  },
  "Projeto de Resolução": {
    label: "Recomendação",
    explainer: "Uma recomendação ao Governo ou uma decisão interna do Parlamento. Não muda nenhuma lei.",
    makesLaw: false,
  },
};

/** Approved laws: most published, some still with the President, one vetoed and one vetoed and then promulgated. */
function presidencyOf(index: number, type: string, status: string) {
  if (status !== "approved" || !PLAIN_TYPES[type]!.makesLaw) return null;
  const sentAt = day(index * 2 + 10);
  if (index % 4 === 0) return { status: "pending", sentAt, promulgatedAt: null, vetoedAt: null, by: "Teresa Albuquerque" };
  if (index % 10 === 1) {
    // Vetoed after the Constitutional Court found it unconstitutional, citing its ruling.
    const constitutionalCourt = [
      { ruling: `${100 + index}/2026`, url: `https://www.tribunalconstitucional.pt/tc/acordaos/2026${100 + index}.html` },
    ];
    const vetoedAt = day(index * 2 + 5);
    return {
      status: "vetoed",
      sentAt,
      promulgatedAt: null,
      vetoedAt,
      vetoKind: "unconstitutionality" as const,
      constitutionalCourt,
      vetoes: [{ date: vetoedAt, kind: "unconstitutionality" as const, constitutionalCourt }],
      by: "Teresa Albuquerque",
    };
  }
  if (index % 5 === 1) {
    const vetoedAt = day(index * 2 + 5);
    return {
      status: "vetoed",
      sentAt,
      promulgatedAt: null,
      vetoedAt,
      vetoKind: "political" as const,
      vetoes: [{ date: vetoedAt, kind: "political" as const }],
      by: "Teresa Albuquerque",
    };
  }
  if (index % 9 === 2)
    // The Parliament's record skips the promulgation; it is deduced from the publication.
    return { status: "promulgated", sentAt, promulgatedAt: null, promulgationRecorded: false, vetoedAt: null, by: "Teresa Albuquerque" };
  const vetoedAt = index % 7 === 3 ? day(index * 2 + 30) : null;
  return {
    status: "promulgated",
    sentAt,
    promulgatedAt: day(index * 2 + 4),
    vetoedAt,
    vetoKind: vetoedAt ? ("political" as const) : null,
    vetoes: vetoedAt ? [{ date: vetoedAt, kind: "political" as const }] : [],
    by: "Teresa Albuquerque",
  };
}

const STAGE_LABELS: Record<string, string> = {
  submitted: "Entregue, à espera de debate",
  committee: "Em análise numa comissão",
  debate: "Agendada para debate",
  approved: "Aprovada",
  awaiting_president: "À espera do Presidente da República",
  vetoed: "Vetada pelo Presidente da República",
  published: "Aprovada e publicada",
  rejected: "Rejeitada",
  withdrawn: "Retirada pelos autores",
};

function plainOf(index: number, type: string, status: string) {
  const kind = PLAIN_TYPES[type]!;
  const presidency = presidencyOf(index, type, status);
  const stage =
    status === "approved"
      ? presidency?.status === "pending"
        ? "awaiting_president"
        : presidency?.status === "vetoed"
          ? "vetoed"
          : "published"
      : status === "in_progress"
        ? (["committee", "submitted", "debate"] as const)[index % 3]!
        : status;
  return { title: SUBJECTS[index % SUBJECTS.length]!, type: kind, status: { label: STAGE_LABELS[stage]!, stage } };
}
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
      : {
          parties: [party],
          deputies: [author, coAuthor].map((deputy) => ({ id: deputy.id, name: deputy.name, party: deputy.party })),
          other: null,
        },
    topics: TOPICS[index % SUBJECTS.length] ?? [],
    plain: plainOf(index, type, status),
    presidency: presidencyOf(index, type, status),
    // A few initiatives have related news (the handler attaches the articles).
    coverage: index % 5 === 0 ? { articles: 3, sources: 2, lastAt: "2026-11-14T20:20:00.000Z" } : { articles: 0, sources: 0, lastAt: null },
    lastVote: voted
      ? {
          date: voteDate,
          phase: status === "approved" ? "Votação final global" : "Votação na generalidade",
          result: status === "approved" ? "Aprovado" : "Rejeitado",
          unanimous: index % 10 === 0,
        }
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
            absent: index % 6 === 0 ? ["jpp"] : [],
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
    seats: rows.map(([number, group, party, x, y]) => ({
      number,
      group,
      party,
      x,
      y,
      deputyId: generated.find((deputy) => deputy.seat === number)?.id ?? null,
      estimated: true,
    })),
  },
  groups,
  deputies: byName,
  initiativeCounts: Object.fromEntries(
    STATUSES.map((status) => [status, initiativeDetails.filter((item) => item.status === status).length]),
  ),
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

type Position = "favor" | "against" | "abstention";

/** How one deputy voted, worked out from their group's position as the backend does. */
export function deputyVotes(id: number) {
  const deputy = generated.find((item) => item.id === id);
  if (!deputy) return null;
  const items = initiativeDetails.flatMap((detail) =>
    (detail.votes ?? []).map((vote) => {
      const named = vote.named?.find((item) => item.name === deputy.name);
      const inGroup = (list: ({ party: string; count: number | null } | string)[] | null | undefined) =>
        list?.some((item) => (typeof item === "string" ? item : item.party) === deputy.party);
      const whole = (list: { party: string; count: number | null }[] | null | undefined) =>
        list?.some((item) => item.party === deputy.party && item.count === null);
      let position: Position | null = null;
      let basis: "named" | "group" | "unanimous" | "absent" | "unknown" = "unknown";
      if (named) [position, basis] = [named.position as Position, "named"];
      else if (vote.unanimous) [position, basis] = ["favor", "unanimous"];
      else if (inGroup(vote.absent)) basis = "absent";
      else {
        const split = (["favor", "against", "abstention"] as const).filter((key) => inGroup(vote[key]));
        const only = (["favor", "against", "abstention"] as const).find((key) => whole(vote[key]));
        if (split.length === 1 && only) [position, basis] = [only, "group"];
      }
      return {
        initiative: { id: detail.id, type: detail.type, number: detail.number, title: detail.title, status: detail.status },
        vote: { id: vote.id, date: vote.date, phase: vote.phase, result: vote.result },
        position,
        basis,
      };
    }),
  );
  const count = (test: (item: (typeof items)[number]) => boolean) => items.filter(test).length;
  return {
    summary: {
      favor: count((item) => item.position === "favor"),
      against: count((item) => item.position === "against"),
      abstention: count((item) => item.position === "abstention"),
      absent: count((item) => item.basis === "absent"),
      unknown: count((item) => item.basis === "unknown"),
      brokeRanks: count((item) => item.basis === "named"),
    },
    items,
  };
}
