import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_EMAIL, SITE_NAME, SITE_OWNER } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Que dados pessoais o Politicando trata, para quê, durante quanto tempo, e como exerces os teus direitos.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidade"
      lead="Lês o Politicando sem conta e sem seres seguido de página em página. Tratamos só os dados de que precisamos para as contas, os comentários, os fóruns e a newsletter."
      current="/privacidade"
    >
      <h2>Quem é responsável</h2>
      <p>
        O responsável pelo tratamento dos dados é {SITE_OWNER ? <b>{SITE_OWNER}</b> : <b>{SITE_NAME}</b>}. Para qualquer pedido sobre os
        teus dados escreve para <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>

      <h2>Ler o site</h2>
      <p>
        Não precisas de conta nem de dar dados para ler. Não usamos cookies de publicidade nem de seguimento. Para saber quantas pessoas
        visitam cada página usamos a <b>Umami</b>, uma ferramenta de estatística alojada na União Europeia que não usa cookies, não guarda o
        teu endereço IP e só produz totais: visitas por página e alguns momentos sem dados pessoais, como carregar em «Importa» ou enviar um
        comentário. Os dados passam pelo nosso servidor, que envia à Umami o teu endereço IP apenas para saber o país; a Umami não o guarda.
        Se o teu navegador pedir para não seres seguido (Do Not Track), não contamos nada.
      </p>
      <p>
        Como em qualquer site, o servidor que o aloja regista pedidos técnicos (endereço IP, página, hora) para segurança e para corrigir
        erros. Esses registos são guardados por pouco tempo e não servem para te identificar.
      </p>

      <h2>Conta</h2>
      <p>
        Para ler não precisas de conta. Se criares uma, guardamos o <b>nome público</b> que escolheres (aparece nos teus comentários), a tua{" "}
        <b>palavra-passe cifrada</b> (nunca a vemos), a data de criação e o que a conta serve para sincronizar entre dispositivos: as
        notícias que guardaste ou escondeste, os jornais e partidos que silenciaste, as histórias que leste, os teus votos, gostos e marcas
        &quot;Importa&quot;, e o que escreveste nos comentários e no fórum. Não pedimos email nem o teu nome verdadeiro.
      </p>
      <p>
        A sessão fica num cookie, <code>politicando_session</code>, que dura 30 dias (vê a <Link href="/cookies">política de cookies</Link>
        ). Na página <Link href="/conta">A tua conta</Link> podes descarregar tudo o que guardamos sobre ti e apagar a conta: os votos saem
        das contagens, os comentários e respostas são apagados e as listas também. As discussões que abriste ficam em branco
        (&quot;[apagado]&quot;), para as respostas dos outros não perderem o sítio. As denúncias que fizeste ficam para a moderação, já sem
        ligação a ti.
      </p>

      <h2>Comentários e fóruns</h2>
      <p>
        Comentar e escrever nos fóruns pode ser feito com conta, com o teu nome público, ou (enquanto o permitirmos) sem conta. Guardamos o
        texto que publicas, o nome (o da conta, ou o que escolheres, se escolheres algum) e a hora. Para mostrar o mesmo identificador nas
        tuas mensagens de uma discussão e para limitar o envio em massa, usamos o teu endereço IP no momento do envio: o identificador é
        calculado a partir dele com uma chave secreta, e <b>o endereço IP não é guardado</b>.
      </p>
      <p>
        O que publicas fica visível para todos. Não escrevas dados pessoais teus nem de outras pessoas. As mensagens ficam publicadas
        enquanto o site existir, salvo se forem removidas por moderação ou a teu pedido.
      </p>

      <h2>Newsletter</h2>
      <p>
        Se te inscreveres, guardamos só o teu email, a data da inscrição e se a confirmaste. Enviamos primeiro um email de confirmação; sem
        confirmação não recebes mais nada, e o endereço é apagado ao fim de 7 dias. Cada envio traz uma ligação para cancelar, e cancelar
        apaga o teu endereço.
      </p>

      <h2>Feedback</h2>
      <p>
        Uma mensagem pela página de feedback pode ser anónima. Guardamos o que escreves, a página indicada e, se a juntares, a captura de
        ecrã. O email só é pedido se quiseres resposta: usamo-lo só para te responder sobre essa mensagem e apagamo-lo quando o assunto
        fecha. As capturas de ecrã são apagadas ao fim de 90 dias. As correções publicadas no registo não dizem quem as pediu.
      </p>
      <p>
        Ao enviar, recebes um link privado para ver a resposta da equipa no site. Fica guardado no teu aparelho e quem o tiver pode ler a
        resposta, por isso não o partilhes. O link deixa de funcionar quando a mensagem é fechada. Se enviares a mensagem com sessão
        iniciada, ela fica ligada à tua conta, para a resposta chegar aos teus avisos, até ser apagada.
      </p>

      <h2>Proteção contra robôs</h2>
      <p>
        Quando crias conta ou entras nela, ou quando, sem conta, começas a escrever um comentário, uma discussão, uma mensagem de feedback
        ou a inscrição na newsletter, carregamos o <b>reCAPTCHA</b> da Google para confirmar que não és um robô. Só nesse momento, e só
        nessas páginas, a Google recebe dados do teu navegador (como o endereço IP), segundo a{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          política de privacidade
        </a>{" "}
        e os{" "}
        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
          termos
        </a>{" "}
        da Google.
      </p>

      <h2>Conteúdos de outros sites</h2>
      <p>
        Alguns artigos do blog incluem um podcast ou um vídeo do Spotify, do YouTube ou de serviços semelhantes. Esses leitores só carregam
        quando pedes. A partir daí, esse serviço recebe os teus dados segundo a política dele. Vê a{" "}
        <Link href="/cookies">política de cookies</Link>.
      </p>

      <h2>Com que fundamento</h2>
      <ul>
        <li>
          <b>Consentimento:</b> a newsletter e os leitores de outros sites. Podes retirá-lo a qualquer momento.
        </li>
        <li>
          <b>Contrato:</b> a conta, se a criares, e o que ela guarda para ti.
        </li>
        <li>
          <b>Interesse legítimo:</b> manter o site seguro, travar o spam e os robôs, moderar o que é publicado e contar visitas sem te
          identificar.
        </li>
      </ul>

      <h2>Com quem partilhamos</h2>
      <p>
        Não vendemos nem cedemos dados. Usamos apenas os prestadores necessários para o site funcionar: o alojamento, o envio de emails da
        newsletter, a Google (reCAPTCHA) e a Umami (estatística sem dados pessoais). Podemos ter de entregar dados às autoridades quando a
        lei o exigir.
      </p>

      <h2>Os teus direitos</h2>
      <p>
        Podes pedir acesso aos teus dados, a sua correção ou eliminação, opor-te ao tratamento ou limitá-lo, e retirar o consentimento que
        deste. Escreve para <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. Com conta, tens quase tudo à mão em{" "}
        <Link href="/conta">A tua conta</Link>; para comentários feitos sem conta, indica a página, a hora e o texto para os encontrarmos.
        Respondemos no prazo de um mês.
      </p>
      <p>
        Se achares que os teus dados não foram bem tratados, podes apresentar queixa à Comissão Nacional de Proteção de Dados (
        <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">
          cnpd.pt
        </a>
        ).
      </p>

      <h2>Pessoas de quem falamos</h2>
      <p>
        O site mostra informação pública sobre titulares de cargos políticos e públicos, tirada de fontes oficiais e da imprensa, com a
        fonte indicada. Quem for referido pode pedir a correção de um erro ou exercer o direito de resposta pelo mesmo endereço.
      </p>

      <h2>Alterações</h2>
      <p>Se esta política mudar, atualizamos a data no topo da página. Mudanças importantes são anunciadas no site.</p>
    </LegalPage>
  );
}
