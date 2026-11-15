import { http, HttpResponse } from "msw";
import type { ApiCaseDetail, ApiGlossary, ApiInterests } from "@/lib/api/cases";
import type { ApiFeatured, ApiPersonPath } from "@/lib/api/people";
import { government } from "./governmentFixtures";
import { deputies } from "./parliamentFixtures";

/**
 * Career paths, the corruption record and declared interests, in the shape of the real API (backend docs
 * people-api.md and cases-api.md). Everyone here is fictional, like the rest of the mock: the case and the company
 * are made up, and the NIF is the generic "final consumer" number, which belongs to no company.
 */

const API = "*/api/v2";
const PARLIAMENT_SOURCE = "https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx";

const members = [
  government.primeMinister!,
  ...government.ministries!.flatMap((ministry) => [ministry.minister!, ...(ministry.secretaries ?? [])]),
  ...government.former!,
];

/** The deputy in the record: the fourth by name, so their page shows the "Registo" box. */
export const recordDeputy = deputies[3]!;

const glossary: ApiGlossary = {
  crimes: [
    { key: "corruption", label: "Corrupção", plain: "Pedir ou aceitar vantagens em troca de um ato no exercício de funções públicas." },
    {
      key: "influence_peddling",
      label: "Tráfico de influência",
      plain: "Pedir ou aceitar vantagens para usar influência junto de entidades públicas.",
    },
  ],
  caseStatuses: [
    { key: "investigation", label: "Em investigação", plain: "O Ministério Público está a investigar. Ainda ninguém foi acusado." },
    { key: "accusation", label: "Acusação deduzida", plain: "O Ministério Público acusou formalmente. Uma acusação não é uma condenação." },
    { key: "trial", label: "Em julgamento", plain: "O tribunal está a julgar o caso." },
    { key: "ruled", label: "Decisão em 1.ª instância", plain: "O tribunal decidiu, mas ainda pode haver recurso." },
    { key: "final", label: "Decisão definitiva", plain: "Já não há recurso possível." },
  ],
  personStatuses: [
    { key: "arguido", label: "Arguido", plain: "É formalmente suspeito. Presume-se inocente." },
    { key: "accused", label: "Acusado", plain: "O Ministério Público acusou-o formalmente. Presume-se inocente." },
    { key: "convicted", label: "Condenado", plain: "Foi condenado por um tribunal." },
  ],
  interestKinds: [{ key: "company", label: "Empresa própria", plain: "Empresa que detém ou fundou." }],
};

const term = (list: { key: string; label: string; plain?: string | null }[], key: string) => list.find((item) => item.key === key)!;

export const exampleCase: ApiCaseDetail = {
  id: 1,
  title: "Operação Exemplo",
  crimes: [term(glossary.crimes!, "corruption"), term(glossary.crimes!, "influence_peddling")],
  status: term(glossary.caseStatuses!, "ruled"),
  statusDate: "2026-05-01",
  startedAt: "2024-02-10",
  reviewedAt: "2026-11-15",
  people: [
    {
      name: recordDeputy.name,
      roleAtTime: "Vereador",
      party: { slug: recordDeputy.party, acronym: recordDeputy.group },
      deputyId: recordDeputy.id,
      governmentMemberId: null,
      status: term(glossary.personStatuses!, "accused"),
      final: false,
      outcome: null,
    },
    {
      name: "Rui Exemplo",
      roleAtTime: "Presidente de câmara",
      party: null,
      deputyId: null,
      governmentMemberId: null,
      status: term(glossary.personStatuses!, "convicted"),
      final: false,
      outcome: "3 anos de prisão, suspensa",
    },
  ],
  summary: "Um caso fictício, para testar as páginas.\n\nO tribunal decidiu em primeira instância; a decisão pode ser objeto de recurso.",
  events: [
    { date: "2024-02-10", description: "O Ministério Público abriu um inquérito.", sources: [2] },
    { date: "2026-05-01", description: "O tribunal leu a decisão em primeira instância.", sources: [1, 2] },
  ],
  sources: [
    {
      position: 1,
      url: "https://example.org/noticia",
      title: "Notícia sobre a decisão",
      publisher: "Jornal Exemplo",
      publishedAt: "2026-05-02",
      kind: "news",
    },
    {
      position: 2,
      url: "https://example.org/acordao",
      title: "Acórdão",
      publisher: "Tribunal Exemplo",
      publishedAt: "2026-05-01",
      kind: "court",
    },
  ],
};

const caseSummary = () => ({ ...exampleCase, summary: undefined, events: undefined, sources: undefined }); // The list has no detail.

export const exampleInterests: ApiInterests = {
  items: [
    {
      id: 3,
      personName: recordDeputy.name,
      deputyId: recordDeputy.id,
      governmentMemberId: null,
      kind: term(glossary.interestKinds!, "company"),
      entityName: "Exemplo Construções, Lda",
      nif: "999999990",
      description: null,
      startDate: "2025-01-01",
      endDate: null,
      declaredAt: "2025-07-01",
      source: { url: "https://example.org/declaracao", title: "Declaração única, 2025" },
      contracts: { won: { count: 2, total: 150000 }, duringInterest: { count: 1, total: 50000 } },
    },
  ],
};

const records = (deputyId: number | null) =>
  deputyId === recordDeputy.id
    ? {
        cases: [
          {
            id: 1,
            title: "Operação Exemplo",
            status: { key: "ruled", label: "Decisão em 1.ª instância" },
            personStatus: { key: "accused", label: "Acusado" },
            final: false,
          },
        ],
        interests: 1,
      }
    : { cases: [], interests: 0 };

function deputyPath(id: number): ApiPersonPath | null {
  const deputy = deputies.find((item) => item.id === id);
  if (!deputy) return null;
  const minister = members.find((member) => member.deputyId === id);
  return {
    person: {
      name: deputy.name,
      photoUrl: null,
      party: { slug: deputy.party, acronym: deputy.group },
      links: { deputyId: id, governmentMemberId: minister?.id ?? null, presidentId: null },
    },
    path: [
      ...(minister
        ? [
            {
              from: minister.startDate,
              to: null,
              precision: "day",
              title: minister.title,
              detail: null,
              kind: "government",
              current: true,
              source: "https://portugal.gov.pt/",
            },
          ]
        : []),
      {
        from: "2025-06-03",
        to: minister ? "2025-06-05" : null,
        precision: "day",
        title: "Deputado à Assembleia da República",
        detail: `XVII legislatura, eleito por ${deputy.constituency}`,
        kind: "parliament",
        current: !minister,
        source: `${PARLIAMENT_SOURCE}?BID=${id}`,
      },
      {
        from: "2025-05-18",
        to: "2025-05-18",
        precision: "day",
        title: "Candidato nas Legislativas 2025",
        detail: `nº 2 da lista ${deputy.group}, círculo de ${deputy.constituency} (eleito)`,
        kind: "election",
        current: false,
        source: "/elections/legislativas-2025/candidates",
      },
      {
        from: "2024-03-26",
        to: "2025-06-03",
        precision: "legislature",
        title: "Deputado à Assembleia da República",
        detail: "XVI legislatura",
        kind: "parliament",
        current: false,
        source: `${PARLIAMENT_SOURCE}?BID=${id}`,
      },
    ],
    currentRoles: [
      {
        from: null,
        to: null,
        precision: "day",
        title: "Membro da Comissão de Orçamento e Finanças",
        detail: null,
        kind: "parliament",
        current: true,
        source: null,
      },
    ],
    otherRoles: [
      {
        from: null,
        to: null,
        precision: "day",
        title: "Eleito na Assembleia Municipal",
        detail: null,
        kind: "local",
        current: true,
        source: null,
      },
    ],
    records: records(id),
  };
}

function memberPath(id: string): ApiPersonPath | null {
  const member = members.find((item) => item.id === id);
  if (!member) return null;
  if (member.deputyId) return deputyPath(member.deputyId);
  return {
    person: { name: member.name, photoUrl: null, party: null, links: { deputyId: null, governmentMemberId: id, presidentId: null } },
    path: [
      {
        from: member.startDate,
        to: member.endDate,
        precision: "day",
        title: member.title,
        detail: null,
        kind: "government",
        current: !member.endDate,
        source: "https://portugal.gov.pt/",
      },
    ],
    currentRoles: [],
    otherRoles: [],
    records: { cases: [], interests: 0 },
  };
}

const president: ApiPersonPath = {
  person: {
    name: "Teresa Albuquerque",
    photoUrl: null,
    party: null,
    links: { deputyId: null, governmentMemberId: null, presidentId: "teresa-albuquerque" },
  },
  path: [
    {
      from: "2026-03-09",
      to: null,
      precision: "day",
      title: "Presidente da República",
      detail: null,
      kind: "presidency",
      current: true,
      source: "https://www.presidencia.pt/",
    },
  ],
  currentRoles: [],
  otherRoles: [],
  records: { cases: [], interests: 0 },
};

const leader = deputies.find((deputy) => deputy.positions.includes("Líder do grupo parlamentar"))!;

const featured: ApiFeatured = {
  items: [
    {
      kind: "president",
      id: "teresa-albuquerque",
      name: "Teresa Albuquerque",
      role: "Presidente da República",
      photoUrl: null,
      party: null,
    },
    {
      kind: "government",
      id: government.primeMinister!.id!,
      name: government.primeMinister!.name!,
      role: "Primeiro-Ministro",
      photoUrl: null,
      party: null,
    },
    {
      kind: "deputy",
      id: String(leader.id),
      name: leader.name,
      role: `Líder do ${leader.group}`,
      photoUrl: null,
      party: { slug: leader.party, acronym: leader.group },
    },
  ],
};

const notFound = () => HttpResponse.json({ error: { code: "not_found", message: "not_found" } }, { status: 404 });

export const peopleHandlers = [
  http.get(`${API}/people/featured`, () => HttpResponse.json(featured)),
  http.get(`${API}/people/:kind/:id/path`, ({ params }) => {
    const id = String(params.id);
    const path =
      params.kind === "deputy"
        ? deputyPath(Number(id))
        : params.kind === "government"
          ? memberPath(id)
          : params.kind === "president" && id === "teresa-albuquerque"
            ? president
            : null;
    return path ? HttpResponse.json(path) : notFound();
  }),
  http.get(`${API}/cases/glossary`, () => HttpResponse.json(glossary)),
  http.get(`${API}/cases`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const crime = params.get("crime");
    const party = params.get("party");
    const matches =
      (!status || exampleCase.status.key === status) &&
      (!crime || exampleCase.crimes!.some((item) => item.key === crime)) &&
      (!party || exampleCase.people!.some((person) => person.party?.slug === party));
    return HttpResponse.json(matches ? { items: [caseSummary()], total: 1 } : { items: [], total: 0 });
  }),
  http.get(`${API}/cases/:id`, ({ params }) => (params.id === "1" ? HttpResponse.json(exampleCase) : notFound())),
  http.get(`${API}/interests/contracts`, () => HttpResponse.json(exampleInterests)),
  http.get(`${API}/interests`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const deputy = params.get("deputy");
    return HttpResponse.json(deputy === String(recordDeputy.id) ? exampleInterests : { items: [] });
  }),
];
