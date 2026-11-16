import type { EditorialDetail, EditorialKind, EditorialPage, EditorialPost } from "./types";

const CONSTITUICAO = "https://www.parlamento.pt/Legislacao/Paginas/ConstituicaoRepublicaPortuguesa.aspx";

/**
 * Posts written into the site itself rather than in the admin: explainers that stand on their own. They appear in
 * the blog next to the API's posts, with negative ids so they never collide with them.
 */
export const LOCAL_POSTS: EditorialDetail[] = [
  {
    id: -1,
    slug: "como-se-chega-a-deputado",
    kind: "article",
    title: "Como se chega a deputado",
    subtitle:
      "Só os partidos apresentam listas, vota-se numa lista e não numa pessoa, e o lugar na lista decide quase tudo. Um guia para perceber quem entra no Parlamento, e porquê.",
    authorName: null,
    coverImageUrl: null,
    media: null,
    tags: ["parlamento", "eleições", "explicador"],
    featured: true,
    publishedAt: "2026-11-15T12:00:00.000Z",
    body: `Em cada eleição legislativa escolhemos 230 deputados. Mas ninguém escreve um nome no boletim. O caminho até São Bento passa por um partido, por um círculo e por uma posição numa lista. Explicamos as regras, uma de cada vez.

## Quem pode ser deputado

Qualquer cidadão português com 18 anos ou mais, recenseado como eleitor. Há exceções enquanto se exercem certas funções: o Presidente da República, magistrados em funções, militares e agentes das forças de segurança no ativo e diplomatas de carreira, por exemplo.

Fonte: [Constituição, art. 150.º](${CONSTITUICAO}) e Lei Eleitoral da Assembleia da República (Lei n.º 14/79).

## Só os partidos apresentam listas

As listas de candidatos são apresentadas pelos partidos, sozinhos ou em coligação. **Não há listas de independentes nas legislativas.** Um independente pode ser candidato, mas numa lista de um partido que o convide.

Ninguém pode ser candidato em mais de um círculo, nem estar em mais de uma lista. E cada partido escolhe os seus candidatos, e a ordem em que aparecem, segundo as suas próprias regras internas.

Fonte: [Constituição, art. 151.º](${CONSTITUICAO}).

## Os 22 círculos

Os 230 deputados são eleitos em 22 círculos: os 18 distritos do continente, os Açores, a Madeira, a Europa e Fora da Europa. Cada círculo elege um número de deputados proporcional aos seus eleitores; os dois círculos da emigração elegem dois cada.

Nas legislativas de 2025, foi assim:

- **Lisboa:** 48 deputados
- **Porto:** 40
- **Braga e Setúbal:** 19 cada
- **Aveiro:** 16
- **Leiria:** 10
- **Coimbra, Faro e Santarém:** 9 cada
- **Viseu:** 8
- **Madeira:** 6
- **Açores, Viana do Castelo e Vila Real:** 5 cada
- **Castelo Branco:** 4
- **Beja, Bragança, Guarda e Évora:** 3 cada
- **Europa, Fora da Europa e Portalegre:** 2 cada

Isto tem uma consequência importante: num círculo pequeno, um partido precisa de uma parte muito maior dos votos para eleger alguém. Em Lisboa, cerca de 2% chega para um deputado; em Portalegre, nem 30% garante um.

Fonte: [Constituição, arts. 148.º e 149.º](${CONSTITUICAO}).

## Vota-se numa lista, não numa pessoa

No boletim escolhe-se um partido ou coligação. Não é possível escolher candidatos nem mudar a ordem da lista. Os lugares que a lista ganha vão para os primeiros nomes, pela ordem em que o partido os pôs.

O lugar na lista é, por isso, decisivo: quem vem em primeiro num círculo grande é quase certamente eleito; quem vem muito abaixo dificilmente é. A verdadeira escolha de quem chega ao Parlamento acontece, em boa parte, dentro dos partidos, quando fazem as listas.

## O método de Hondt, com um exemplo real

Em cada círculo, os votos de cada lista são divididos por 1, 2, 3, e assim por diante. Os lugares vão para os maiores resultados, um a um, até se esgotarem. Se o último lugar ficar empatado entre listas diferentes, vai para a que teve menos votos.

Portalegre, o círculo mais pequeno, elegeu dois deputados em 2025. Os três mais votados foram:

1. **Chega:** 17 220 votos
2. **PS:** 16 125 votos
3. **AD (PSD/CDS):** 15 458 votos

O primeiro lugar vai para o maior número da lista: os 17 220 do Chega. Para o segundo, comparam-se os 16 125 do PS, os 15 458 da AD e os 8 610 do Chega (17 220 a dividir por 2). Ganha o PS.

A AD teve mais de 15 mil votos e não elegeu ninguém em Portalegre: **faltaram-lhe 668 votos** para ficar com o segundo lugar. É assim que, num círculo pequeno, milhares de votos podem não eleger ninguém.

Fonte: [Constituição, art. 149.º](${CONSTITUICAO}) e Lei Eleitoral da Assembleia da República, art. 16.º. Resultados: [Legislativas 2025 em Portalegre](/eleicoes/legislativas-2025/LOCAL-120000).

## Paridade

Cada lista tem de ter pelo menos 40% de candidatos de cada sexo, e não pode ter mais de dois candidatos seguidos do mesmo sexo.

Fonte: Lei da Paridade (Lei Orgânica n.º 3/2006, alterada pela Lei Orgânica n.º 1/2019).

## Também se chega lá por substituição

Quando um deputado sai, suspende o mandato ou vai para o Governo, o lugar passa para o candidato seguinte da mesma lista, no mesmo círculo, que ainda não tenha sido eleito. Por isso há deputados que não foram eleitos na noite das eleições: estavam logo abaixo na lista.

Fonte: Estatuto dos Deputados (Lei n.º 7/93).

## Quanto tempo dura

Uma legislatura dura quatro anos, mas pode acabar mais cedo se o Presidente da República dissolver o Parlamento e marcar eleições antecipadas.

Fonte: [Constituição, arts. 171.º e 172.º](${CONSTITUICAO}).

---

Quer ver quem são os 230? Estão todos no [Parlamento](/parlamento), com o círculo por onde foram eleitos e o que fizeram desde então.`,
  },
];

function summary(post: EditorialDetail): EditorialPost {
  const { body, ...rest } = post;
  void body;
  return rest;
}

export const localPost = (slug: string): EditorialDetail | null => LOCAL_POSTS.find((post) => post.slug === slug) ?? null;

/** The site's own posts that fit a filter, newest first, without their bodies. */
export const localPosts = ({ kind, featured }: { kind?: EditorialKind | null; featured?: boolean } = {}): EditorialPost[] =>
  LOCAL_POSTS.filter((post) => (!kind || post.kind === kind) && (featured === undefined || post.featured === featured))
    .map(summary)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

/** The API's page with the site's own posts merged in on the first page, newest first. */
export function withLocalPosts(page: EditorialPage, { kind, number }: { kind: EditorialKind | null; number: number }): EditorialPage {
  const own = localPosts({ kind });
  if (number > 1 || own.length === 0) return { items: page.items, total: page.total + own.length };
  const items = [...own, ...page.items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { items, total: page.total + own.length };
}
