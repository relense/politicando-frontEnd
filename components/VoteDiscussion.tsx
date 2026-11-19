"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useAccountGate, useReader } from "@/lib/account";
import { markFollowed } from "@/lib/accountExtras";
import { getInitiative } from "@/lib/api/client";
import { createPost, getThread, posterName, VOTES_BOARD, type ForumPost, type ThreadSummary } from "@/lib/api/forums";
import { formatTime, lisbonDay } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { FollowButton } from "./account/FollowButton";
import { ProposalNews } from "./RelatedArticles";

/*
 * Around "Passa ou chumba?": the vote's conversation on the "Votações" board (backend docs/engagement-api.md), the
 * board itself, and the news about the proposal.
 */

const threadPath = (id: number) => `/forum/${VOTES_BOARD}/${id}`;
/** The site's own posts on that board ("Politicando", posterId "redacao"). */
const isNewsroom = (post: ForumPost) => post.posterId === "redacao" || post.posterId === "votacoes";

/** "Ao vivo" while the vote is today (its session starts at closesAt). */
export function useLive(closesAt: string | null): boolean {
  const now = useNow();
  return Boolean(closesAt) && lisbonDay(closesAt) === lisbonDay(new Date(now).toISOString());
}

export const threadKey = (id: number) => ["vote-thread", id];

/** The vote's thread, refreshed every half minute. */
export function useVoteThread(threadId: number | null) {
  return useQuery({
    queryKey: threadKey(threadId ?? 0),
    queryFn: () => getThread(threadId!),
    enabled: threadId !== null,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function PickBadge({ pick }: { pick: "pass" | "fail" }) {
  const tone = pick === "pass" ? "var(--favor)" : "var(--contra)";
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
      style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
    >
      <span className="sr-only">Previu: </span>
      {pick === "pass" ? "Passa" : "Chumba"}
    </span>
  );
}

/** Under the card: the latest of the vote's conversation, in order, with each side's badge, and a box to answer. */
export function VoteThreadPreview({ threadId, closesAt, title }: { threadId: number; closesAt: string | null; title: string }) {
  const thread = useVoteThread(threadId);
  const live = useLive(closesAt);
  const data = thread.data;
  const latest = (data?.posts ?? []).filter((post) => !post.hidden && post.body !== null).slice(-4);
  return (
    <section aria-labelledby="discussao-votacao" className="mt-5">
      <nav aria-label="Onde estás" className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/forum" className="underline">
          Fórum
        </Link>{" "}
        /{" "}
        <Link href={`/forum/${VOTES_BOARD}`} className="underline">
          Votações
        </Link>{" "}
        / <span className="text-ink">Esta votação</span>
      </nav>
      <div className="rounded-2xl border border-line">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          {live && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--contra)_16%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--contra)]">
              ● Ao vivo
            </span>
          )}
          <h2 id="discussao-votacao" className="min-w-0 flex-1 font-serif text-base font-bold leading-snug">
            <Link href={threadPath(threadId)} className="hover:underline">
              {data?.thread.title ?? `A discussão: ${title}`}
            </Link>
          </h2>
          <FollowButton kind="thread" id={threadId} />
        </div>
        <p className="flex justify-between px-3 pt-2 font-mono text-[11px] text-muted">
          <span>{data ? `${data.thread.replyCount} ${data.thread.replyCount === 1 ? "mensagem" : "mensagens"}` : "A carregar…"}</span>
          <span>Por ordem</span>
        </p>
        {latest.length > 0 ? (
          <ol aria-label="Últimas mensagens" className="flex flex-col gap-3 p-3">
            {latest.map((post) => (
              <li key={post.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                <span
                  className={`pt-0.5 font-mono text-[11px] ${isNewsroom(post) ? "font-bold text-[#8a6500] dark:text-[#f2c94c]" : "text-muted"}`}
                >
                  {formatTime(post.createdAt)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                    <b className={isNewsroom(post) ? "text-[#8a6500] dark:text-[#f2c94c]" : ""}>
                      {isNewsroom(post) ? "Redação" : posterName(post.nickname)}
                    </b>
                    {post.pick && <PickBadge pick={post.pick} />}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-sm leading-snug">{post.body}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          data && <p className="p-3 text-sm text-muted">Ainda ninguém escreveu. Defende a tua escolha primeiro.</p>
        )}
        <QuickReply threadId={threadId} locked={data?.thread.locked ?? false} />
      </div>
      <Link href={threadPath(threadId)} className="mt-2 inline-block font-mono text-[11px] font-bold underline underline-offset-2">
        Ver a discussão desta votação{data ? ` (${data.thread.replyCount})` : ""} →
      </Link>
    </section>
  );
}

/** One line to answer in the vote's conversation; with an account (asked first, as everywhere). */
function QuickReply({ threadId, locked }: { threadId: number; locked: boolean }) {
  const id = useId();
  const reader = useReader();
  const gate = useAccountGate();
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (locked) return <p className="border-t border-line p-3 font-mono text-[11px] text-muted">Esta discussão está fechada.</p>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = event.currentTarget.querySelector<HTMLElement>("button[type=submit]");
    if (gate("forum", button)) return;
    const clean = body.trim();
    if (!clean) return setError("Escreve a tua resposta primeiro.");
    setSending(true);
    setError(null);
    try {
      await createPost(threadId, { body: clean, nickname: "", replyTo: null, captchaToken: null });
      setBody("");
      if (reader) markFollowed("thread", threadId);
      await client.refetchQueries({ queryKey: threadKey(threadId) });
    } catch {
      setError("Não foi publicada. Tenta outra vez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap gap-2 border-t border-line p-3">
      <label htmlFor={`${id}-reply`} className="sr-only">
        Responder na discussão
      </label>
      <input
        id={`${id}-reply`}
        value={body}
        maxLength={5000}
        onChange={(event) => setBody(event.target.value)}
        onFocus={(event) => !reader && gate("forum", event.currentTarget)}
        placeholder="Responder na discussão…"
        className="min-w-0 flex-1 basis-48 rounded-lg border border-line bg-paper px-3 py-2 text-sm placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={sending}
        className="rounded-lg bg-[#f2c94c] px-4 py-2 font-mono text-xs font-bold text-[#1b1d22] hover:opacity-90 disabled:opacity-60"
      >
        {sending ? "A publicar…" : "Responder"}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** The "Votações" board: one thread per vote, opened by the site; each tagged live, open or voted. */
export function VotesBoardBox({ threads, open }: { threads: ThreadSummary[]; open: { id: number; closesAt: string | null }[] }) {
  const now = useNow();
  if (threads.length === 0) return null;
  const today = lisbonDay(new Date(now).toISOString());
  const tagOf = (thread: ThreadSummary) => {
    const initiative = thread.link?.kind === "initiative" ? thread.link.id : null;
    const item = open.find((entry) => entry.id === initiative);
    if (!item) return { label: "votada", tone: "var(--favor)" };
    return item.closesAt && lisbonDay(item.closesAt) === today
      ? { label: "● ao vivo", tone: "var(--contra)" }
      : { label: "aberta", tone: "var(--link)" };
  };
  return (
    <section aria-labelledby="quadro-votacoes" className="mt-5 rounded-2xl border border-line p-4">
      <h2
        id="quadro-votacoes"
        className="flex flex-wrap justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
      >
        Quadro “Votações” no fórum
        <span className="font-normal normal-case tracking-normal">sem botão “Nova discussão”</span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        Cada votação na agenda ganha uma discussão automaticamente. Os leitores respondem, mas não abrem discussões novas neste quadro.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {threads.map((thread) => {
          const tag = tagOf(thread);
          return (
            <li key={thread.id} className="flex items-center gap-3 py-2">
              <span className="w-16 shrink-0 font-mono text-[11px] font-bold" style={{ color: tag.tone }}>
                {tag.label}
              </span>
              <Link href={threadPath(thread.id)} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                {thread.title.replace(/^Passa ou chumba\?\s*/, "")}
              </Link>
              <span className="shrink-0 font-mono text-[11px] text-muted">{thread.replyCount}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Beside the card: the news about the proposal, newest first. */
export function VoteNews({ initiativeId }: { initiativeId: number }) {
  const initiative = useQuery({
    queryKey: ["initiative", initiativeId],
    queryFn: () => getInitiative(initiativeId),
    staleTime: 5 * 60_000,
  });
  return (
    <ProposalNews articles={initiative.data?.articles ?? []} more={{ href: `/iniciativas/${initiativeId}`, label: "Toda a proposta →" }} />
  );
}
