import type { Metadata } from "next";
import Link from "next/link";
import { SocialLinks } from "@/components/SocialLinks";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

export const metadata: Metadata = {
  title: "Sobre o projeto: o que queremos, fontes e método",
  description:
    "Porque existe o Politicando, o que queremos alcançar e como trabalhamos: a política portuguesa num só lugar, explicada com clareza e sempre com a fonte. Independente, sem ligação a partidos.",
  alternates: { canonical: "/sobre" },
};

/** The three things the site is for. */
const GOALS = [
  {
    title: "Perceber",
    text: "Quem governa, quem decide e como: do Governo à junta de freguesia, explicado sem jargão e com os números à vista.",
  },
  {
    title: "Comparar",
    text: "A mesma notícia contada por vários jornais, o que cada partido propôs e votou, o que mudou de uma eleição para a outra.",
  },
  {
    title: "Acompanhar",
    text: "O que acontece entre eleições: as leis que avançam, os contratos que se assinam, quem entra e sai dos cargos.",
  },
];

/** What is already on the site, by question. */
const SECTIONS: { question: string; links: { href: string; label: string }[] }[] = [
  {
    question: "O que se passa?",
    links: [
      { href: "/", label: "Notícias de todos os partidos" },
      { href: "/editorial", label: "Blog: artigos e guias" },
      { href: "/agenda", label: "Agenda" },
    ],
  },
  {
    question: "Quem manda?",
    links: [
      { href: "/presidente", label: "Presidente" },
      { href: "/governo", label: "Governo" },
      { href: "/parlamento", label: "Parlamento" },
      { href: "/partidos", label: "Partidos" },
      { href: "/iniciativas", label: "Iniciativas e leis" },
    ],
  },
  {
    question: "Onde e com que dinheiro?",
    links: [
      { href: "/eleicoes", label: "Eleições, do país à freguesia" },
      { href: "/sitios", label: "Autarquias" },
      { href: "/contratos", label: "Contratos públicos" },
    ],
  },
  {
    question: "Como se chegou aqui?",
    links: [
      { href: "/historia", label: "Governos desde 1974" },
      { href: "/percursos", label: "Percursos" },
      { href: "/como-ser-deputado", label: "Como se chega a deputado" },
    ],
  },
];

const PRINCIPLES = [
  { title: "Sempre com a fonte", text: "Cada número e cada facto levam à fonte oficial ou ao jornal que o publicou." },
  {
    title: "Sem partido",
    text: "Não temos ligação a partidos. Aparecem por ordem alfabética, ou pelos votos da última eleição, se preferires.",
  },
  { title: "Factos antes de opiniões", text: "Os artigos explicam. A opinião, quando existe, vem marcada e assinada." },
  {
    title: "Presunção de inocência",
    text: "Investigações e processos são descritos tal como estão: notícia não é acusação, acusação não é condenação.",
  },
  {
    title: "Livre para ler",
    text: "Gratuito e sem conta para ler. A conta serve só para participar: comentar, votar, guardar em todo o lado.",
  },
  { title: "Erros à vista", text: "Quando erramos, corrigimos e fica registado, com data." },
];

/** What we're working on: said as aims, without dates. */
const NEXT = [
  "Cada diploma em linguagem simples: o que muda e para quem, antes do texto oficial.",
  "As ligações entre cargos públicos, empresas e contratos, a partir das declarações e registos públicos.",
  "Mais formas de participar: discussões por partido e por notícia, e ideias votadas por quem lê.",
];

/** The project: why it exists, what it's for, what's there and how it's made. */
export default function AboutPage() {
  return (
    <article className="max-w-3xl pb-4">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Sobre o projeto</p>
      <h1 className="mt-2 text-4xl font-bold leading-tight">
        A política portuguesa, <span className={MARKER}>às claras</span>
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        O {SITE_NAME} junta num só lugar o que é preciso para perceber a política em Portugal: as notícias, quem decide, como se vota e como
        se gasta o dinheiro público. Explicado com clareza, sempre com a fonte, sem ligação a partidos.
      </p>

      <div className="post-body mt-8">
        <h2 id="porque">Porque existe</h2>
        <p>
          A informação existe, mas está espalhada: as votações num site, os contratos noutro, os resultados eleitorais noutro, e as notícias
          divididas por dezenas de jornais. Seguir o que um partido promete, o que vota e o que acontece depois dá trabalho a quem tem tempo
          e paciência. Votamos de quatro em quatro anos; entre eleições, quase tudo nos passa ao lado.
        </p>
        <p>
          Queremos que perceber a política seja tão fácil como ler as notícias da manhã, e que qualquer pessoa possa confirmar o que lê, sem
          ter de confiar em nós.
        </p>

        <h2 id="o-que-queremos">O que queremos alcançar</h2>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {GOALS.map((goal) => (
          <li key={goal.title} className="rounded-2xl border border-line p-4">
            <p className="font-bold">{goal.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{goal.text}</p>
          </li>
        ))}
      </ul>

      <div className="post-body mt-10">
        <h2 id="o-que-ha">O que já podes fazer</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section key={section.question} aria-label={section.question} className="rounded-2xl border border-line p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">{section.question}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="post-body mt-10">
        <h2 id="principios">Como trabalhamos</h2>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {PRINCIPLES.map((principle) => (
          <div key={principle.title} className="border-l-2 border-[var(--marker)] pl-3">
            <dt className="font-bold">{principle.title}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted">{principle.text}</dd>
          </div>
        ))}
      </dl>

      <div className="post-body mt-10">
        <h2 id="a-seguir">Em que estamos a trabalhar</h2>
        <ul>
          {NEXT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Tens uma ideia ou falta-te alguma coisa? <Link href="/feedback/ideias">Propõe e vota nas ideias</Link>: é por aí que decidimos o
          que fazer primeiro.
        </p>

        <h2 id="fontes">Fontes e método</h2>
        <ul>
          <li>
            Os dados vêm de fontes oficiais (Assembleia da República, Governo, Presidência, Comissão Nacional de Eleições, portal BASE e
            outros), com a fonte indicada em cada página.
          </li>
          <li>
            As notícias são dos meios que as publicaram: mostramos o título, um excerto e a ligação para o artigo original. Quando vários
            jornais contam a mesma história, juntamo-los num só cartão para se poder comparar como cada um a contou.
          </li>
          <li>Os artigos e guias do blog explicam; não tomam partido. Os textos de opinião vinculam só quem os assina.</li>
          <li>
            Investigações, acusações e processos são descritos tal como estão. Ninguém é culpado enquanto não houver uma condenação
            definitiva.
          </li>
        </ul>

        <h2>Erros e correções</h2>
        <p>
          Fazemos o possível para que tudo esteja certo e atualizado, mas pode haver erros ou atrasos. Quando corrigimos, fica no{" "}
          <Link href="/feedback/correcoes">registo de correções</Link>. Encontraste um erro? <Link href="/feedback">Diz-nos</Link> ou
          escreve para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Quem for referido no site pode pedir correção ou exercer o
          direito de resposta pelo mesmo endereço.
        </p>

        <h2>Contacto</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. As regras do site estão nos{" "}
          <Link href="/termos">termos de utilização</Link> e o que fazemos com os dados na{" "}
          <Link href="/privacidade">política de privacidade</Link>.
        </p>

        <h2>Segue-nos</h2>
      </div>
      <SocialLinks variant="pills" className="mt-3" />
    </article>
  );
}
