import type { Metadata } from "next";
import Link from "next/link";
import { SocialLinks } from "@/components/SocialLinks";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

export const metadata: Metadata = {
  title: "Sobre nós, fontes e método",
  description:
    "O que é o Politicando, de onde vêm os dados e as notícias, como corrigimos erros e como nos contactar. Independente, sem ligação a partidos.",
  alternates: { canonical: "/sobre" },
};

/** Who we are and how the site is made: the same facts as the terms, said for readers rather than lawyers. */
export default function AboutPage() {
  return (
    <article className="max-w-3xl pb-4">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Politicando</p>
      <h1 className="mt-2 text-4xl font-bold leading-tight">
        Sobre <span className={MARKER}>nós</span>
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        A política portuguesa num só lugar, explicada com clareza e sempre com a fonte. Gratuito, sem conta e sem ligação a partidos.
      </p>

      <div className="post-body mt-8">
        <h2>O que é o {SITE_NAME}</h2>
        <p>
          Junta as notícias sobre os partidos portugueses e explica, com dados públicos, quem governa, como se vota e como se gasta o
          dinheiro público: o Parlamento e as votações, o Governo, a Presidência, as eleições, as autarquias e os contratos públicos.
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
