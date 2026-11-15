import { http, HttpResponse } from "msw";

/**
 * Fictional public contracts for the mock API: invented bodies, companies and NIFs, shaped like BASE's data as
 * the backend serves it (docs/contracts-api.md).
 */

const API = "*/api/v2";

const PROCEDURES = [
  ["direct_award", "Ajuste direto", "A entidade pública escolhe a empresa e convida-a diretamente, sem concorrência aberta."],
  ["direct_award_simplified", "Ajuste direto simplificado", "Ajuste direto para compras de valor muito baixo, com menos formalidades."],
  ["prior_consultation", "Consulta prévia", "A entidade convida pelo menos três empresas à sua escolha a apresentar propostas."],
  ["public_tender", "Concurso público", "Qualquer empresa pode concorrer. O anúncio é público e ganha a melhor proposta."],
  ["limited_tender", "Concurso limitado", "Concurso em duas fases: primeiro escolhem-se as empresas qualificadas."],
  ["framework_agreement", "Ao abrigo de acordo-quadro", "Compra feita a empresas já selecionadas num concurso anterior."],
] as const;

const BODIES = [
  { nif: "600000001", name: "Município de Vale Formoso" },
  { nif: "600000002", name: "Hospital de Serra Alta, EPE" },
  { nif: "600000003", name: "Agência Nacional de Estradas Imaginárias" },
];

const SUPPLIERS = [
  { nif: "500000011", name: "Refeições Quentes do Norte, Lda" },
  { nif: "500000012", name: "Construções Pedra Lisa, S.A." },
  { nif: "500000013", name: "Informática Cais Novo, Unipessoal" },
  { nif: "", name: "Joana Exemplo" },
];

const PLACES = [
  { key: "LOCAL-010100", name: "Águeda", text: "Portugal, Aveiro, Águeda" },
  { key: "LOCAL-110600", name: "Lisboa", text: "Portugal, Lisboa, Lisboa" },
  { key: "LOCAL-111100", name: "Sintra", text: "Portugal, Lisboa, Sintra" },
];

const OBJECTS = [
  "AQUISIÇÃO DE SERVIÇOS DE FORNECIMENTO DE REFEIÇÕES ESCOLARES",
  "Empreitada de requalificação da Rua das Flores",
  "Aquisição de licenças de software de gestão documental",
  "Prestação de serviços de manutenção de espaços verdes",
  "Aquisição de material de escritório",
];

/** 30 contracts, newest first, cycling through the procedures, bodies, suppliers and places. */
export const contracts = Array.from({ length: 30 }, (_, index) => {
  const [kind, label] = PROCEDURES[index % 4 === 3 ? 3 : index % 4 === 2 ? 2 : 0]!;
  const place = PLACES[index % PLACES.length]!;
  const day = String(28 - (index % 28)).padStart(2, "0");
  return {
    id: String(20_000_000 - index),
    object: index === 0 ? "<b>Aquisição</b> de serviços de limpeza" : `${OBJECTS[index % OBJECTS.length]} – AD_${100 + index}/2026`,
    procedure: { kind, label, published: label },
    contractTypes: ["Aquisição de serviços"],
    price: 1000 * ((index * 7919) % 150) + 450.5,
    publishedAt: `2026-${index < 15 ? "10" : "09"}-${day}`,
    signedAt: `2026-${index < 15 ? "09" : "08"}-${day}`,
    entities: [BODIES[index % BODIES.length]!],
    suppliers: [SUPPLIERS[index % SUPPLIERS.length]!],
    places: [place.text],
    baseUrl: `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${20_000_000 - index}`,
    placeKey: place.key,
  };
});

const summary = (contract: (typeof contracts)[number]) => {
  const { placeKey: _placeKey, ...rest } = contract;
  void _placeKey;
  return rest;
};

const detail = (contract: (typeof contracts)[number]) => {
  const procedure = PROCEDURES.find(([kind]) => kind === contract.procedure.kind)!;
  const place = PLACES.find((item) => item.key === contract.placeKey)!;
  return {
    ...summary(contract),
    description: "Serviços de limpeza das instalações municipais durante doze meses.",
    procedureExplained: procedure[2],
    basePrice: contract.price + 5000,
    effectivePrice: null,
    cpv: { code: "90910000-9", description: "Serviços de limpeza" },
    deadlineDays: 365,
    municipalities: [{ key: place.key, name: place.name }],
    legalBasis: "Artigo 20.º, n.º 1, alínea d) do Código dos Contratos Públicos",
    directAwardReason: contract.procedure.kind === "direct_award" ? "Urgência imperiosa (exemplo fictício)" : null,
    frameworkAgreement: null,
    centralized: false,
    invited: contract.procedure.kind === "prior_consultation" ? 3 : null,
    documentsUrl: null,
    status: null,
  };
};

const UPDATED = { updatedAt: "2026-11-15 10:43:39.927567+00", source: "https://dados.gov.pt/pt/datasets/exemplo/" };

type Contract = (typeof contracts)[number];

function filtered(params: URLSearchParams): Contract[] {
  const procedure = params.get("procedure");
  const entity = params.get("entity");
  const supplier = params.get("supplier");
  const place = params.get("place");
  const q = params.get("q")?.toLowerCase();
  return contracts.filter(
    (item) =>
      (!procedure || item.procedure.kind === procedure) &&
      (!entity || item.entities.some((party) => party.nif === entity)) &&
      (!supplier || item.suppliers.some((party) => party.nif === supplier)) &&
      (!place || item.placeKey === place) &&
      (!q || item.object.toLowerCase().includes(q)),
  );
}

const groupBy = (items: Contract[], keyOf: (item: Contract) => { key: string; label: string }[]) => {
  const groups = new Map<string, { key: string; label: string; count: number; total: number }>();
  for (const item of items) {
    for (const { key, label } of keyOf(item)) {
      const group = groups.get(key) ?? { key, label, count: 0, total: 0 };
      group.count++;
      group.total += item.price;
      groups.set(key, group);
    }
  }
  return [...groups.values()];
};

const totals = (items: Contract[]) => ({ count: items.length, total: items.reduce((sum, item) => sum + item.price, 0) });

const side = (items: Contract[], other: (item: Contract) => { nif: string; name: string }[]) => ({
  ...totals(items),
  directAwards: items.filter((item) => item.procedure.kind.startsWith("direct_award")).length,
  counterparts: groupBy(items, (item) => other(item).map((party) => ({ key: party.nif, label: party.name })))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10),
});

const fail = (status: number, code: string) => HttpResponse.json({ error: { code, message: code } }, { status });

export const contractHandlers = [
  http.get(`${API}/contracts/procedures`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    params.delete("procedure");
    const items = filtered(params);
    // Big made-up totals on top of the 30 listed, so the counter looks like the real thing.
    return HttpResponse.json({
      items: PROCEDURES.map(([kind, label, plain], index) => {
        const own = items.filter((item) => item.procedure.kind === kind);
        return { kind, label, plain, count: own.length + 1000 * (6 - index), total: totals(own).total + 1e8 * (6 - index) };
      }),
    });
  }),
  http.get(`${API}/contracts/stats`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const by = params.get("by");
    const items = filtered(params);
    const limit = Number(params.get("limit") ?? 20);
    let groups;
    if (by === "year") groups = groupBy(items, (item) => [{ key: item.publishedAt.slice(0, 4), label: item.publishedAt.slice(0, 4) }]);
    else if (by === "entity") groups = groupBy(items, (item) => item.entities.map((party) => ({ key: party.nif, label: party.name })));
    else if (by === "supplier")
      groups = groupBy(items, (item) =>
        item.suppliers.filter((party) => party.nif).map((party) => ({ key: party.nif, label: party.name })),
      );
    else if (by === "municipality")
      groups = groupBy(items, (item) => [{ key: item.placeKey, label: PLACES.find((place) => place.key === item.placeKey)!.name }]);
    else return fail(400, "invalid_request");
    if (by === "year") {
      groups.unshift({ key: "2025", label: "2025", count: 12, total: 2_500_000 });
      groups.sort((a, b) => a.key.localeCompare(b.key));
    } else groups = groups.sort((a, b) => b.total - a.total).slice(0, limit);
    return HttpResponse.json({ by, items: groups, totals: totals(items), ...UPDATED });
  }),
  http.get(`${API}/contracts/parties/:nif`, ({ params }) => {
    const nif = String(params.nif);
    const party = [...BODIES, ...SUPPLIERS].find((item) => item.nif === nif);
    if (!party) return fail(404, "not_found");
    const asEntity = contracts.filter((item) => item.entities.some((other) => other.nif === nif));
    const asSupplier = contracts.filter((item) => item.suppliers.some((other) => other.nif === nif));
    return HttpResponse.json({
      nif,
      name: party.name,
      asEntity: side(asEntity, (item) => item.suppliers),
      asSupplier: side(asSupplier, (item) => item.entities),
      latest: [...asEntity, ...asSupplier].slice(0, 10).map(summary),
    });
  }),
  http.get(`${API}/contracts/:id`, ({ params }) => {
    if (!/^\d{1,12}$/.test(String(params.id))) return fail(400, "invalid_request");
    const contract = contracts.find((item) => item.id === params.id);
    return contract ? HttpResponse.json(detail(contract)) : fail(404, "not_found");
  }),
  http.get(`${API}/contracts`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 20);
    const start = Number(params.get("cursor") ?? 0);
    const sorted = [...filtered(params)];
    if (params.get("sort") === "price") sorted.sort((a, b) => b.price - a.price);
    const items = sorted.slice(start, start + limit).map(summary);
    return HttpResponse.json({ items, nextCursor: start + limit < sorted.length ? String(start + limit) : null });
  }),
];
