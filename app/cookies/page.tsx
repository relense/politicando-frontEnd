import type { Metadata } from "next";
import Link from "next/link";
import { EmbedsChoice } from "@/components/EmbedsChoice";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "O que o Politicando guarda no teu navegador e o que carrega de outros sites, e como escolhes.",
  alternates: { canonical: "/cookies" },
};

const STORED: [string, string, string][] = [
  [
    "feed",
    "Um cookie com os partidos e jornais que guardaste como o teu feed, para a página inicial abrir com eles. Só existe se o guardares.",
    "1 ano, ou até carregares em “Esquecer o meu feed”",
  ],
  ["theme", "Guarda o tema que escolheste (claro ou escuro).", "Até o apagares"],
  ["party-order", "Guarda a ordem dos partidos que escolheste (por nome ou por votos).", "Até o apagares"],
  ["embeds", "Guarda a escolha de carregar sempre os leitores de outros sites, se a fizeres.", "Até o apagares ou desligares abaixo"],
  ["forum-me-…", "Lembra as tuas mensagens numa discussão, para as marcar com “(tu)”.", "Até fechares o separador"],
  ["ideas-voted", "Lembra as ideias e discussões em que votaste, para o botão ficar marcado.", "Até o apagares"],
  ["reader-prefs", "As notícias que guardaste ou escondeste.", "Até o apagares"],
  ["article-votes", "Lembra os teus votos nas notícias, para as setas ficarem acesas.", "Até o apagares"],
  [
    "read-…",
    "Lembra que já abriste uma notícia ou um artigo do blog nesta visita, para contar a leitura uma só vez.",
    "Até fechares o separador",
  ],
  [
    "politicando_admin",
    "Só para a equipa: o cookie de sessão de quem entra na área de moderação. Quem lê o site nunca o recebe.",
    "14 dias, ou até saíres",
  ],
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Política de cookies"
      lead="O Politicando não usa cookies de publicidade nem de seguimento. Por isso não te pedimos para aceitar cookies quando entras."
      current="/cookies"
    >
      <h2>O que guardamos no teu navegador</h2>
      <p>
        Só guardamos as tuas preferências: o teu feed num cookie, o resto no armazenamento local do navegador. Não saem do teu computador ou
        telemóvel, não te identificam e servem só para o site funcionar como escolheste.
      </p>
      <div className="not-prose my-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Dados guardados no navegador</caption>
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-widest text-muted">
              <th scope="col" className="px-3 py-2 font-normal">
                Nome
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Para quê
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Duração
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {STORED.map(([name, purpose, duration]) => (
              <tr key={name}>
                <th scope="row" className="px-3 py-2 align-top font-mono text-xs font-bold">
                  {name}
                </th>
                <td className="px-3 py-2 align-top">{purpose}</td>
                <td className="px-3 py-2 align-top text-muted">{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Estatística sem cookies</h2>
      <p>
        Contamos as visitas com o Plausible, que não usa cookies nem guarda o teu endereço IP. Vemos apenas totais, como o número de visitas
        de uma página, sem saber quem as fez.
      </p>

      <h2>Proteção contra robôs</h2>
      <p>
        Quando começas a escrever um comentário, uma discussão ou a inscrição na newsletter, carregamos o reCAPTCHA da Google, que pode usar
        cookies próprios para distinguir pessoas de robôs. Não é carregado em mais nenhum momento. É necessário para publicar: sem ele, os
        fóruns encher-se-iam de spam.
      </p>

      <h2>Leitores de outros sites</h2>
      <p>
        Podcasts e vídeos do Spotify, do YouTube e de serviços semelhantes podem guardar cookies próprios. Por isso só carregam quando
        pedes: até lá, nada é pedido a esses sites. Se escolheres <b>Carregar sempre</b>, guardamos essa escolha neste navegador. Podes
        mudá-la aqui:
      </p>
      <EmbedsChoice />

      <h2>Apagar</h2>
      <p>
        Podes apagar tudo o que o site guardou nas definições do teu navegador, em “dados de sites” ou “cookies e dados de sites”. O site
        continua a funcionar; só perdes as preferências. Mais sobre os teus dados na{" "}
        <Link href="/privacidade">política de privacidade</Link>.
      </p>
    </LegalPage>
  );
}
