import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getFollowUp, type FollowUp } from "@/lib/api/feedback";
import { formatDateTime } from "@/lib/format";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "A tua mensagem · Feedback",
  // A private link: never in search results, and never passed on to the pages it links to.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const KIND_LABELS: Record<string, string> = { error: "Erro nos dados", broken: "Algo não funciona", idea: "Ideia", other: "Mensagem" };
const box = "rounded-2xl border border-line p-5";

/** A message's status and the team's answer, for whoever has its private link (backend docs/feedback-api.md › GET /feedback/follow/:token). */
export default async function FollowUpPage({ params }: Props) {
  await connection();
  const { token } = await params;
  const follow: FollowUp | "closed" | null = await getFollowUp(token).catch(() => null);

  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Caminho" className="mb-4 font-mono text-xs">
        <Link href="/feedback" className="text-link underline">
          Feedback
        </Link>
        <span aria-hidden="true" className="text-muted">
          {" "}
          ›{" "}
        </span>
        <span aria-current="page" className="text-muted">
          A tua mensagem
        </span>
      </nav>
      {follow === "closed" ? (
        <>
          <h1 className="font-serif text-3xl font-bold">Esta mensagem foi encerrada</h1>
          <p className="mt-3 leading-relaxed text-muted">
            O link deixa de funcionar quando a equipa fecha a mensagem. Se ainda precisares de ajuda, envia outra.
          </p>
          <Link
            href="/feedback/nova?tipo=erro"
            className="mt-5 inline-flex min-h-10 items-center rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
          >
            Enviar outra mensagem
          </Link>
        </>
      ) : follow === null ? (
        <>
          <h1 className="font-serif text-3xl font-bold">A tua mensagem</h1>
          <p className={`${box} mt-4 text-muted`}>Não conseguimos ver o estado da mensagem agora. Tenta daqui a pouco.</p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-3xl font-bold">A tua mensagem</h1>
          <p className="mt-2 font-mono text-xs text-muted">
            {KIND_LABELS[follow.kind] ?? "Mensagem"}
            {follow.page && <> · {follow.page}</>} · enviada a {formatDateTime(follow.createdAt)}
          </p>
          {follow.status === "answered" ? (
            <section aria-labelledby="resposta" className={`${box} mt-5 border-[color-mix(in_srgb,var(--stage-approved)_45%,transparent)]`}>
              <h2 id="resposta" className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--stage-approved)]">
                Resposta da equipa
                {follow.answeredAt && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-muted">{formatDateTime(follow.answeredAt)}</span>
                )}
              </h2>
              <p className="mt-2 whitespace-pre-line break-words leading-relaxed">
                {follow.reply ?? "Marcámos a tua mensagem como respondida."}
              </p>
            </section>
          ) : (
            <p className={`${box} mt-5`}>
              <b>Por responder.</b>{" "}
              <span className="text-muted">Lemos todas as mensagens. Quando respondermos, a resposta aparece aqui.</span>
            </p>
          )}
          <p className="mt-5 text-sm text-muted">
            Este link é privado: não o partilhes. Deixa de funcionar quando a mensagem for fechada.{" "}
            <Link href="/feedback/correcoes" className="text-link underline">
              Ver o registo de correções
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
