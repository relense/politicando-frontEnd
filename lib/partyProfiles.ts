export type PartyProfile = {
  /** Two or three neutral sentences, attributed to the party: how it describes itself, not how others label it. */
  summary: string;
  /** The founding year as the party or Wikipedia gives it (not a later legal registration). */
  founded: number | null;
  /** The page the summary is mainly based on, linked on the party page so readers can check it. */
  sourceUrl: string;
  sourceKind: "official" | "wikipedia" | "press";
};

/**
 * Researched in November 2026 from each party's own site (declaração de princípios, estatutos,
 * "quem somos"), falling back to Wikipedia or the press when the site was down or had no such page.
 * Keep the same tone and length for every party; never add third-party labels or controversies.
 */
const PROFILES: Record<string, PartyProfile> = {
  "adn": {
    summary:
      "O partido apresenta-se como uma alternativa política «sem qualquer preconceito ideológico», que recusa as velhas dicotomias. Declara como valores a dignidade humana, a liberdade, a igualdade, a justiça e a solidariedade, e diz bater-se contra a corrupção, a inflação, a degradação do ensino e a erosão da família e do património nacional.",
    founded: 2021,
    sourceUrl: "https://adn.com.pt/historia/",
    sourceKind: "official",
  },
  "atua": {
    summary:
      "Criado como Partido Unido dos Reformados e Pensionistas (PURP), adotou o nome (A)TUA em 2024. Apresenta-se como voz política dos reformados e pensionistas e de quem se opõe à austeridade, sem se posicionar no eixo esquerda-direita. Defende a dignidade humana e uma saúde e educação iguais para todos.",
    founded: 2015,
    sourceUrl: "https://pt.wikipedia.org/wiki/(A)TUA",
    sourceKind: "wikipedia",
  },
  "be": {
    summary:
      "Nascido do manifesto «Começar de Novo», o Bloco define-se como um partido socialista e internacionalista. Defende a valorização dos salários e o combate à precariedade, o direito à habitação, a justiça climática, a tributação das grandes fortunas, o antirracismo, a igualdade e a paz.",
    founded: 1999,
    sourceUrl: "https://www.bloco.org/conhece-nos/causas",
    sourceKind: "official",
  },
  "cds-pp": {
    summary:
      "O CDS tem na sua declaração de princípios o humanismo personalista como doutrina de referência. Defende a democracia pluralista, o Estado de direito, as liberdades individuais, a iniciativa privada e a descentralização, e integra o Partido Popular Europeu.",
    founded: 1974,
    sourceUrl: "https://www.cds.pt/principios.html",
    sourceKind: "official",
  },
  "chega": {
    summary:
      "O CHEGA apresenta-se no seu manifesto como defensor dos «valores civis das sociedades de matriz europeia», conservador nos costumes e liberal na economia. Propõe a redução de impostos e da burocracia, a proteção da família e da natalidade, penas mais duras e mais meios para as forças de segurança e um sistema presidencialista.",
    founded: 2019,
    sourceUrl: "https://pt.wikipedia.org/wiki/Chega_(partido_político)",
    sourceKind: "wikipedia",
  },
  "il": {
    summary:
      "A Iniciativa Liberal apresenta-se como ponto de encontro de quem deseja «uma sociedade livre, aberta, tolerante e responsável», tendo a liberdade individual como valor político supremo. Defende um Estado limitado e eficiente ao serviço dos cidadãos, uma economia aberta e concorrencial e a liberdade de escolha na saúde e na educação.",
    founded: 2017,
    sourceUrl: "https://iniciativaliberal.pt/ideias/declaracao-de-principios-da-iniciativa-liberal/",
    sourceKind: "official",
  },
  "jpp": {
    summary:
      "Nascido de um movimento de cidadãos em Gaula (Santa Cruz, Madeira), o JPP define-se como um «partido liberal de matriz social», laico e alheio à divisão esquerda-direita. Defende a cidadania participativa, um serviço de saúde público e universal, a descentralização e a solidariedade social.",
    founded: 2015,
    sourceUrl: "https://juntospelopovo.pt/declaracao-principios/",
    sourceKind: "official",
  },
  "livre": {
    summary:
      "O LIVRE afirma-se de esquerda e assenta em princípios como o universalismo, a liberdade, a igualdade, a solidariedade, o socialismo, a ecologia política e o europeísmo. Defende o aprofundamento da democracia, com primárias abertas e democracia deliberativa, e a sustentabilidade ambiental.",
    founded: 2014,
    sourceUrl: "https://partidolivre.pt/declaracao-de-principios-2-2",
    sourceKind: "official",
  },
  "mas": {
    summary:
      "O MAS apresenta-se como um movimento político de esquerda, independente dos interesses das classes dominantes e crítico do estalinismo. Defende uma transformação profunda do capitalismo rumo a uma sociedade «sem opressão, nem exploração», com propostas como a semana de trabalho de quatro dias, transportes públicos gratuitos e a propriedade pública do setor energético.",
    founded: 2000,
    sourceUrl: "https://mas.org.pt/index.php/2022/02/01/o-que-nos-move/",
    sourceKind: "official",
  },
  "mpt": {
    summary:
      "O MPT apresenta-se como o partido ecologista português e herdeiro do legado ambientalista de Gonçalo Ribeiro Telles. Entre os seus princípios fundadores estão o ambientalismo, o desenvolvimento sustentável, o humanismo laico, o liberalismo social e a Felicidade Interna Bruta como indicador de desenvolvimento. Lema: «Cultivar a liberdade, proteger o futuro».",
    founded: 1993,
    sourceUrl: "https://mpt.pt/valores.html",
    sourceKind: "official",
  },
  "nc": {
    summary:
      "O Nós, Cidadãos! apresenta-se como um partido cívico, aberto a todos os cidadãos e associações, criado para dar voz à sociedade civil nas autarquias e na Assembleia da República. Recusa a divisão entre esquerda e direita e defende uma governação transparente, a responsabilização dos titulares de cargos públicos, a equidade fiscal e um mercado livre com regulação.",
    founded: 2015,
    sourceUrl: "https://noscidadaos.pt/o-nos-cidadaos/declaracao-de-principios/",
    sourceKind: "official",
  },
  "nova-direita": {
    summary:
      "A Nova Direita define-se como um movimento patriótico, conservador e soberanista, que tem a nação portuguesa como valor supremo. Defende a soberania política e económica, um Estado forte, a família e a tradição portuguesa, a dignidade da pessoa desde a conceção até à morte natural e uma Europa de nações soberanas, em vez de um modelo federal.",
    founded: 2022,
    sourceUrl: "https://novadireita.pt/declaracao-de-principios/",
    sourceKind: "official",
  },
  "pan": {
    summary:
      "O PAN define-se como um «partido de causas» que procura beneficiar pessoas, animais e natureza, orientado pelo princípio da não-violência. Defende o reconhecimento da senciência dos animais e a sua proteção legal, um modelo de desenvolvimento ecológico e sustentável, e mais participação cívica e descentralização.",
    founded: 2009,
    sourceUrl: "https://www.pan.com.pt/valores/",
    sourceKind: "official",
  },
  "pcp": {
    summary:
      "O PCP define-se nos seus estatutos como o partido da classe operária e de todos os trabalhadores, tendo como objetivos supremos a construção do socialismo e do comunismo em Portugal. O seu programa, «Uma Democracia Avançada», propõe uma democracia política, económica, social e cultural, com uma economia mista liberta do domínio dos monopólios e a defesa da soberania nacional.",
    founded: 1921,
    sourceUrl: "https://www.pcp.pt/estatutos-do-pcp",
    sourceKind: "official",
  },
  "pctp-mrpp": {
    summary:
      "O PCTP/MRPP foi criado como Movimento Reorganizativo do Partido do Proletariado, com o objetivo de reorganizar um partido comunista da classe operária, e adotou o nome atual em 1976. Reivindica-se marxista-leninista, defende a substituição do capitalismo pelo comunismo e tem como órgão central o jornal «Luta Popular».",
    founded: 1970,
    sourceUrl: "https://pt.wikipedia.org/wiki/Partido_Comunista_dos_Trabalhadores_Portugueses",
    sourceKind: "wikipedia",
  },
  "pev": {
    summary:
      "O Partido Ecologista «Os Verdes» foi fundado por cidadãos que pretendiam uma intervenção ecologista mais ativa na sociedade portuguesa. Apresenta-se como uma voz ecologista que alerta para os desafios ambientais, globais e nacionais, e defende um desenvolvimento sustentável e harmonioso, levando essas preocupações da ação local ao nível institucional.",
    founded: 1982,
    sourceUrl: "https://osverdes.pt/partido/historia/",
    sourceKind: "official",
  },
  "pls": {
    summary:
      "O Partido Liberal Social apresenta a liberdade como pilar essencial do desenvolvimento humano e destaca a descentralização como bandeira. Defende a igualdade de oportunidades, os direitos fundamentais e a responsabilidade individual, a separação de poderes, o Estado de direito, a liberdade de expressão, a tolerância e a solidariedade social.",
    founded: 2025,
    sourceUrl: "https://www.partidoliberalsocial.pt/declaracao-de-principios",
    sourceKind: "official",
  },
  "ppm": {
    summary:
      "O PPM apresenta-se como um partido centrado na dignidade da pessoa, na nação e nas comunidades locais. Propõe uma monarquia popular, com um rei como árbitro independente e símbolo da soberania popular, cabendo ao povo decidir essa mudança, e defende o reforço do poder local, um desenvolvimento equilibrado entre regiões e a proteção do ambiente e do património.",
    founded: 1974,
    sourceUrl: "https://partidopopularmonarquico.pt/declaracao-de-principios/",
    sourceKind: "official",
  },
  "ps": {
    summary:
      "O PS define-se como a organização dos cidadãos que defendem a democracia e procuram no socialismo democrático a resposta aos problemas do país, situando-se na área da esquerda democrática. Propõe uma sociedade assente nos valores da liberdade, da igualdade e da solidariedade, aberta à diversidade, à iniciativa e à inovação.",
    founded: 1973,
    sourceUrl: "https://ps.pt/declaracao_de_principios_ps",
    sourceKind: "official",
  },
  "psd": {
    summary:
      "Segundo os seus estatutos, o PSD tem como finalidade a promoção e defesa da democracia política, social, económica e cultural, inspirada nos valores do Estado de Direito e nos princípios da social-democracia. Assume a liberdade, a igualdade e a solidariedade como valores fundamentais e apresenta como objetivo uma sociedade aberta, livre e solidária.",
    founded: 1974,
    sourceUrl: "https://www.psd.pt/sites/default/files/2025-10/estatutos_nacionais.pdf",
    sourceKind: "official",
  },
  "ptp": {
    summary:
      "O PTP apresenta-se como um partido trabalhista de centro-esquerda, com o lema «Igualdade de direitos e igualdade de oportunidades». Entre as propostas que divulgou contam-se a reforma da justiça, a criminalização da discriminação grave e incentivos à natalidade.",
    founded: 2009,
    sourceUrl: "https://www.sabado.pt/portugal/detalhe/ptp-espera-eleger-um-deputado-com-programa-que-aposta-na-igualdade",
    sourceKind: "press",
  },
  "rir": {
    summary:
      "O RIR (Reagir Incluir Reciclar) define-se como um partido humanista, pacifista, ambientalista e europeísta. Defende uma aproximação efetiva entre os políticos e os cidadãos e apresenta-se como um partido aberto a todos, assente na ideia de que também a política precisa de se renovar.",
    founded: 2019,
    sourceUrl: "https://pt.wikipedia.org/wiki/Reagir_Incluir_Reciclar",
    sourceKind: "wikipedia",
  },
  "tu": {
    summary:
      "O TU define-se como um partido revolucionário e integra a organização internacional UIT-QI. Propõe um programa de ação para mobilizar trabalhadores e jovens em torno de reivindicações concretas, tendo como objetivo de longo prazo uma sociedade socialista com os meios de produção sob controlo democrático dos trabalhadores.",
    founded: 2024,
    sourceUrl: "https://trabalhadores-unidos.pt/2024/09/17/manifesto/",
    sourceKind: "official",
  },
  "volt": {
    summary:
      "O Volt Portugal apresenta-se como um partido pan-europeu, pragmático, social-liberal e ecologista, que se posiciona como alternativa entre a esquerda e a direita. Defende propostas baseadas em evidência científica e em boas práticas europeias, sob o lema «Testado na Europa, pronto para Portugal», e integra o movimento Volt, presente em mais de 30 países.",
    founded: 2017,
    sourceUrl: "https://voltportugal.org/sobre-o-volt",
    sourceKind: "official",
  },
};

export function getPartyProfile(slug: string): PartyProfile | undefined {
  return PROFILES[slug];
}
