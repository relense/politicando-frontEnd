import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL, SITE_NAME, SITE_OWNER } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de utilização",
  description:
    "As regras para usar o Politicando: o que é o site, os limites da informação, e as regras para comentar e escrever nos fóruns.",
  alternates: { canonical: "/termos" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de utilização"
      lead="As regras para usar o Politicando. Ao usar o site, aceitas estes termos. Se não concordares, não publiques comentários nem mensagens."
      current="/termos"
    >
      <h2>O que é o Politicando</h2>
      <p>
        O {SITE_NAME}
        {SITE_OWNER ? `, mantido por ${SITE_OWNER},` : ""} junta notícias sobre os partidos portugueses e explica, com dados públicos, quem
        governa, como se vota e como se gasta o dinheiro público. É gratuito e não exige conta.
      </p>

      <h2>A informação que mostramos</h2>
      <ul>
        <li>
          Os dados vêm de fontes oficiais (Assembleia da República, Governo, Presidência, Comissão Nacional de Eleições, portal BASE e
          outros) e da imprensa, sempre com a fonte indicada.
        </li>
        <li>
          Fazemos o possível para que esteja certa e atualizada, mas pode ter erros ou atrasos. Para decisões importantes, confirma na fonte
          oficial.
        </li>
        <li>
          As notícias são dos meios que as publicaram: mostramos o título, um excerto e a ligação para o artigo original. Os direitos são de
          quem as escreveu.
        </li>
        <li>Os textos de opinião vinculam só quem os assina. Os artigos e guias explicam; não tomam partido.</li>
        <li>
          Investigações, acusações e processos são descritos tal como estão. Ninguém é culpado enquanto não houver uma condenação
          definitiva.
        </li>
      </ul>
      <p>
        Encontraste um erro? Escreve para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Quem for referido no site pode pedir
        correção ou exercer o direito de resposta pelo mesmo endereço.
      </p>

      <h2>Regras para comentar e escrever nos fóruns</h2>
      <p>Discordar é bem-vindo. Para que a conversa valha a pena, não é permitido publicar:</p>
      <ul>
        <li>insultos, ameaças, assédio ou incitamento ao ódio ou à violência;</li>
        <li>discriminação por origem, religião, género, orientação sexual, deficiência ou outra condição;</li>
        <li>acusações de crimes sem fonte, ou afirmações falsas que ofendam o bom nome de alguém;</li>
        <li>dados pessoais de outras pessoas (moradas, telefones, documentos) ou de ti próprio;</li>
        <li>publicidade, spam, ligações enganosas ou mensagens repetidas;</li>
        <li>conteúdo ilegal, ou que viole direitos de autor de terceiros;</li>
        <li>mensagens que se façam passar por outra pessoa, partido ou instituição.</li>
      </ul>

      <h2>Moderação</h2>
      <p>
        Qualquer pessoa pode denunciar uma mensagem com a ligação “Denunciar”. Podemos ocultar ou remover, sem aviso, mensagens que violem
        estas regras ou a lei, e limitar o envio a quem abuse. Não lemos tudo antes de ser publicado: se vires algo que não devia estar cá,
        denuncia ou escreve-nos.
      </p>

      <h2>O que publicas</h2>
      <p>
        És responsável pelo que escreves. O texto continua a ser teu, mas ao publicá-lo autorizas o {SITE_NAME} a mostrá-lo no site, de
        forma gratuita e enquanto estiver publicado. Podes comentar com o nome público da tua conta; vê a{" "}
        <Link href="/privacidade">política de privacidade</Link> para saber que dados tratamos.
      </p>

      <h2>Ligações para outros sites</h2>
      <p>
        O site tem ligações para notícias, documentos oficiais e outros serviços. Não somos responsáveis pelo conteúdo nem pelas práticas
        desses sites.
      </p>

      <h2>Disponibilidade</h2>
      <p>
        Procuramos manter o site sempre disponível, mas pode haver interrupções, e secções podem mudar ou deixar de existir. Na medida em
        que a lei o permite, não respondemos por danos resultantes do uso da informação do site ou da sua indisponibilidade.
      </p>

      <h2>Alterações e lei aplicável</h2>
      <p>Podemos atualizar estes termos; a data no topo indica a última versão. Aplica-se a lei portuguesa.</p>
    </LegalPage>
  );
}
