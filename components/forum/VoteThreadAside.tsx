"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getOpenPredictions, type Prediction } from "@/lib/api/engagement";
import type { ForumPost } from "@/lib/api/forums";
import { formatNumber } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { dayAndTime, timeLeft } from "../Predictions";
import { VoteNews } from "../VoteDiscussion";

const box = "rounded-2xl border border-line p-4";
const heading = "font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted";

/** Beside a vote's thread: the vote, how the conversation leans, its rules, the news and the other open votes. */
export function VoteThreadAside({
  initiativeId,
  threadId,
  posts,
  prediction,
}: {
  initiativeId: number;
  threadId: number;
  posts: ForumPost[];
  prediction: Prediction | null;
}) {
  const now = useNow();
  const left = timeLeft(prediction?.closesAt ?? null, now);
  const written = posts.filter((post) => !post.hidden && post.body !== null && !post.isOp);
  const pass = written.filter((post) => post.pick === "pass").length;
  const fail = written.filter((post) => post.pick === "fail").length;
  const none = written.length - pass - fail;
  const others = useQuery({
    queryKey: ["predictions", "open", 6, false, "aside"],
    queryFn: () => getOpenPredictions(6),
    staleTime: 60_000,
  });
  const otherOpen = (others.data ?? []).filter((item) => item.id !== initiativeId && item.state === "open").slice(0, 4);

  return (
    <aside aria-label="Sobre esta votação" className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
      <section aria-labelledby="sobre-votacao" className={box}>
        <h2 id="sobre-votacao" className={heading}>
          Sobre esta votação
        </h2>
        {prediction && (
          <p className="mt-2 text-sm font-semibold">
            {[prediction.type && prediction.number ? `${prediction.type} n.º ${prediction.number}` : prediction.type, prediction.author]
              .filter(Boolean)
              .join(" · ") || prediction.title}
            {prediction.voteLabel && <span className="block font-mono text-[11px] font-normal text-muted">{prediction.voteLabel}</span>}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface p-2.5">
            <p className={heading}>Votação</p>
            <p className="mt-1 font-serif text-lg font-bold capitalize">{prediction?.closesAt ? dayAndTime(prediction.closesAt) : "—"}</p>
          </div>
          <div className="rounded-xl bg-[color-mix(in_srgb,var(--contra)_10%,transparent)] p-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--contra)]">
              {left ? "Fecha em" : "Previsões"}
            </p>
            <p className="mt-1 font-serif text-lg font-bold text-[var(--contra)]">{left ?? "fechadas"}</p>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          {formatNumber(written.length)} {written.length === 1 ? "resposta" : "respostas"}
          {prediction?.count ? ` · ${formatNumber(prediction.count)} ${prediction.count === 1 ? "previsão" : "previsões"}` : ""}
        </p>
        <Link
          href={`/iniciativas/${initiativeId}`}
          className="mt-2 inline-block font-mono text-[11px] font-bold underline underline-offset-2"
        >
          Ler a proposta →
        </Link>
      </section>

      {written.length > 0 && (
        <section aria-labelledby="como-esta-conversa" className={box}>
          <h2 id="como-esta-conversa" className={heading}>
            Como está a conversa (por respostas)
          </h2>
          <div aria-hidden="true" className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            {pass > 0 && <span className="rounded-full bg-[var(--favor)]" style={{ flex: pass }} />}
            {fail > 0 && <span className="rounded-full bg-[var(--contra)]" style={{ flex: fail }} />}
            {none > 0 && <span className="rounded-full bg-line" style={{ flex: none }} />}
          </div>
          <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 font-mono text-[11px]">
            <b className="text-[var(--favor)]">Passa {pass}</b>
            <b className="text-[var(--contra)]">Chumba {fail}</b>
            <span className="text-muted">sem lado {none}</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Conta quem escreve, não as previsões. As previsões só se revelam depois de escolheres.
          </p>
        </section>
      )}

      <section aria-labelledby="regras-votacoes" className={box}>
        <h2 id="regras-votacoes" className={heading}>
          Regras de votações
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
          <li>Discute a proposta, não as pessoas.</li>
          <li>O teu lado aparece em cada resposta. É a tua previsão.</li>
          <li>Um tópico por votação: não se abrem tópicos novos aqui.</li>
          <li>Números? Põe a fonte.</li>
        </ol>
      </section>

      <VoteNews initiativeId={initiativeId} />

      {otherOpen.length > 0 && (
        <section aria-labelledby="outras-abertas" className={box}>
          <h2 id="outras-abertas" className={heading}>
            Outras votações abertas
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {otherOpen.map((item) => (
              <li key={item.id} className="py-2">
                <p className="font-mono text-[10px] capitalize text-muted">{item.closesAt ? dayAndTime(item.closesAt) : ""}</p>
                <Link
                  href={item.threadId && item.threadId !== threadId ? `/forum/votacoes/${item.threadId}` : `/iniciativas/${item.id}`}
                  className="line-clamp-2 text-sm font-semibold leading-snug hover:underline"
                >
                  {item.plain?.title ?? item.title}
                </Link>
                <p className="mt-0.5 font-mono text-[10px]">
                  <span className="font-bold text-[var(--contra)]">● aberta</span>
                  {item.replyCount !== null && (
                    <span className="text-muted">
                      {" "}
                      · {formatNumber(item.replyCount)} {item.replyCount === 1 ? "resposta" : "respostas"}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
