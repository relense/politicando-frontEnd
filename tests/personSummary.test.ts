import { describe, expect, it } from "vitest";
import type { PersonPath } from "@/lib/api/people";
import type { LocalOfficial } from "@/lib/api/localOfficials";
import { deputySummary, governmentMemberSummary, localOfficialSummary } from "@/lib/personSummary";
import type { DeputyDetail, GovernmentMemberDetail } from "@/lib/types";

const deputy = (over: Partial<DeputyDetail> = {}): DeputyDetail => ({
  id: 7,
  name: "Rita Fictícia",
  fullName: "Rita Maria Fictícia",
  group: "PS",
  partySlug: "ps",
  constituency: "Braga",
  seat: null,
  seatEstimated: false,
  positions: [],
  role: null,
  photoUrl: null,
  party: { slug: "ps", name: "Partido Socialista", acronym: "PS" } as DeputyDetail["party"],
  situation: "Efetivo",
  active: true,
  birthDate: "1980-03-10",
  profession: "professora",
  education: [],
  roles: [],
  committees: [],
  pastLegislatures: ["XV", "XVI"],
  links: [],
  gender: null,
  initiatives: { total: 12, approved: 3, latest: [] },
  articles: [],
  ...over,
});

const path = (currentRoles: Partial<PersonPath["currentRoles"][number]>[]): PersonPath =>
  ({
    person: { name: "", photoUrl: null, party: null, links: { deputyId: null, governmentMemberId: null, presidentId: null } },
    path: [],
    currentRoles: currentRoles.map((role) => ({
      from: null,
      to: null,
      precision: "day",
      title: "",
      detail: null,
      kind: "other",
      current: true,
      source: null,
      ...role,
    })),
    otherRoles: [],
    records: { cases: [], interests: 0 },
  }) as PersonPath;

const NOW = new Date("2026-11-17T12:00:00Z");

describe("deputySummary", () => {
  it("says where they sit, who they are and how they vote, without gendered words", () => {
    const summary = deputySummary(deputy(), null, { favor: 50, against: 30, abstention: 20, absent: 0, unknown: 0, brokeRanks: 2 }, NOW);
    expect(summary.sentences).toEqual([
      "Rita Fictícia representa o círculo de Braga na Assembleia da República, pelo PS.",
      "Professora, 46 anos.",
      "Antes desta, passou pelo Parlamento em 2 legislaturas (XV, XVI).",
      "Nesta legislatura assina 12 iniciativas, 3 aprovadas.",
      "Em 100 votações registadas, votou 2 vezes diferente da bancada.",
    ]);
    expect(summary.title).toBe("Rita Fictícia (PS), Braga: percurso, votações e iniciativas");
    expect(summary.description.length).toBeLessThanOrEqual(160);
    expect(summary.description.startsWith(summary.sentences[0]!)).toBe(true);
  });

  it("leads with a Government post and a party's leadership, and says the seat is suspended", () => {
    const summary = deputySummary(
      deputy({ active: false, situation: "Suspenso(Eleito)", positions: ["Presidente do PS"], pastLegislatures: [] }),
      path([{ kind: "government", title: "Ministra da Saúde", from: "2025-06-05" }]),
      null,
      NOW,
    );
    expect(summary.sentences[0]).toBe(
      "Rita Fictícia é Ministra da Saúde desde junho de 2025 e tem suspenso o mandato parlamentar pelo círculo de Braga (PS).",
    );
    expect(summary.sentences).toContain("É também Presidente do PS.");
    expect(summary.sentences).toContain("Está na primeira legislatura no Parlamento.");
    expect(summary.title).toBe("Rita Fictícia (PS): Ministra da Saúde");
  });
});

describe("deputySummary, posts in the path", () => {
  it("finds a current Government post listed in the path, and a party post alone says «É»", () => {
    const withPath = path([]);
    withPath.path = [
      {
        from: "2025-06-05",
        to: null,
        precision: "day",
        title: "Ministro da Defesa Nacional",
        detail: null,
        kind: "government",
        current: true,
        source: null,
      },
    ];
    expect(deputySummary(deputy(), withPath, null, NOW).title).toBe("Rita Fictícia (PS): Ministro da Defesa Nacional");
    expect(deputySummary(deputy({ positions: ["Presidente do PS"] }), null, null, NOW).sentences).toContain("É Presidente do PS.");
  });
});

describe("governmentMemberSummary", () => {
  const member = (over: Partial<GovernmentMemberDetail> = {}): GovernmentMemberDetail =>
    ({
      id: "a".repeat(32),
      name: "Tomás Exemplo",
      gender: "M",
      photoUrl: null,
      bio: [],
      links: [],
      inOffice: true,
      partySlug: "psd",
      partySource: "curated",
      independent: false,
      deputy: null,
      positions: [
        {
          title: "Ministro das Finanças",
          kind: "minister",
          areaName: null,
          government: "xxv",
          startDate: "2025-06-05",
          endDate: null,
          url: null,
        },
      ],
      articles: [],
      ...over,
    }) as GovernmentMemberDetail;

  it("in office: the post, since when, the Government and the party", () => {
    const summary = governmentMemberSummary(member(), null, { partyAcronym: "PSD", governmentName: "XXV Governo Constitucional" });
    expect(summary.sentences).toEqual([
      "Tomás Exemplo é Ministro das Finanças desde junho de 2025, no XXV Governo Constitucional.",
      "É militante do PSD.",
    ]);
    expect(summary.title).toBe("Tomás Exemplo (PSD): Ministro das Finanças");
  });

  it("a former member, elected on the party's lists: no mention of leaving Parliament now", () => {
    const summary = governmentMemberSummary(
      member({
        inOffice: false,
        gender: "F",
        name: "Ana Exemplo",
        partySource: "deputy",
        positions: [
          {
            title: "Secretária de Estado da Saúde",
            kind: "secretary_of_state",
            areaName: null,
            government: "xxiv",
            startDate: "2024-04-02",
            endDate: "2025-06-05",
            url: null,
          },
        ],
      }),
      null,
      { partyAcronym: "PS", governmentName: null },
    );
    expect(summary.sentences).toEqual(["Ana Exemplo foi Secretária de Estado da Saúde até junho de 2025.", "Foi eleita deputada pelo PS."]);
    expect(summary.title).toBe("Ana Exemplo (PS): ex-secretária de Estado da Saúde");
  });
});

describe("with the gender on record", () => {
  it("says deputada and eleita, and keeps one «é» after a Government post", () => {
    expect(deputySummary(deputy({ gender: "F" }), null, null, NOW).sentences[0]).toBe(
      "Rita Fictícia é deputada do PS, eleita pelo círculo de Braga.",
    );
    expect(deputySummary(deputy({ gender: "F" }), null, null, NOW).title).toBe("Rita Fictícia (PS): Deputada por Braga");
    const minister = path([{ kind: "government", title: "Ministra da Saúde", from: "2025-06-05" }]);
    expect(deputySummary(deputy({ gender: "F" }), minister, null, NOW).sentences[0]).toBe(
      "Rita Fictícia é Ministra da Saúde desde junho de 2025 e deputada do PS, eleita pelo círculo de Braga.",
    );
  });
});

describe("localOfficialSummary", () => {
  const official: LocalOfficial = {
    id: "joana-exemplo",
    name: "Joana Maria Exemplo",
    shortName: "Joana Exemplo",
    title: "Presidente da Câmara Municipal de Viseu",
    place: { key: "LOCAL-182300", name: "Viseu" },
    district: null,
    label: "VISEU PRIMEIRO",
    parties: ["psd"],
    election: "autarquicas-2025",
    term: { start: "2025-10-12", end: "2029-10-12" },
    current: true,
    otherRoles: [{ kind: "candidate", title: "Candidatura", detail: null, date: null, current: false, elected: false, href: null }],
    articles: [],
  };
  it("the câmara, since when, the list, the term and the full name; the title for search", () => {
    const summary = localOfficialSummary(official, ["PSD"]);
    expect(summary.sentences).toEqual([
      "Joana Exemplo preside à Câmara Municipal de Viseu desde outubro de 2025, pela lista VISEU PRIMEIRO (PSD).",
      "O mandato vai até às autárquicas de 2029.",
      "No boletim de voto: Joana Maria Exemplo.",
      "Tem 1 outra candidatura registada.",
    ]);
    expect(summary.title).toBe("Joana Exemplo, presidente da Câmara Municipal de Viseu");
  });
});
