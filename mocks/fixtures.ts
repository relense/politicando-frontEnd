import type { ApiArticleDetail, ApiComment, ApiParty } from "@/lib/api/schemas";

const party = (slug: string, acronym: string, name: string, website: string | null = null): ApiParty => ({ slug, acronym, name, website });

export const parties: ApiParty[] = [
  party("be", "B.E.", "Bloco de Esquerda", "https://www.bloco.org/"),
  party("chega", "CH", "CHEGA"),
  party("cds-pp", "CDS-PP", "CDS - Partido Popular", "https://www.cds.pt/"),
  party("il", "IL", "Iniciativa Liberal", "https://iniciativaliberal.pt/"),
  party("livre", "L", "LIVRE", "https://partidolivre.pt/"),
  party("pctp-mrpp", "PCTP/MRPP", "Partido Comunista dos Trabalhadores Portugueses"),
  party("ps", "PS", "Partido Socialista", "https://ps.pt/"),
  party("psd", "PSD", "Partido Social Democrata", "https://www.psd.pt/"),
];

const SOURCES = ["publico.pt", "observador.pt", "expresso.sapo.pt", "rtp.pt"];
const TAGS = [["ps"], ["psd"], ["ps", "psd"], ["be"], ["cds-pp"], ["il"], ["chega"]];
const tagged = (slugs: string[]) =>
  slugs.map((slug) => {
    const { acronym, name } = parties.find((item) => item.slug === slug)!;
    return { slug, acronym, name };
  });

/** Newest first, as the API returns them. */
export const articles: ApiArticleDetail[] = Array.from({ length: 35 }, (_, index) => {
  const id = 100 - index;
  return {
    id,
    title: `Notícia de teste número ${id}: Parlamento debate o orçamento &amp; a saúde`,
    content: `Este é o texto de exemplo da notícia ${id}. `.repeat(12),
    publishedAt: new Date(Date.UTC(2026, 9, 30, 12, 0) - index * 3_600_000).toISOString(),
    url: `https://example.com/noticia/${id}`,
    source: SOURCES[index % SOURCES.length]!,
    imageUrl: null,
    commentCount: id === 100 ? 3 : 0,
    parties: tagged(TAGS[index % TAGS.length]!),
  };
});

// Hostile and sparse records the UI has to survive.
articles[1] = { ...articles[1]!, title: `<script>window.__xss = true</script>Título com código`, content: "", parties: [] };

export const comments: Record<number, ApiComment[]> = {
  100: [
    { id: 1, username: "maria", body: "Primeiro comentário.", parentId: null, createdAt: "2026-10-30T13:00:00.000Z" },
    { id: 2, username: null, body: "Uma resposta anónima.", parentId: 1, createdAt: "2026-10-30T14:00:00.000Z" },
    { id: 3, username: "joao", body: "Outro comentário principal.", parentId: null, createdAt: "2026-10-30T15:00:00.000Z" },
  ],
};
