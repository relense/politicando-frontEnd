"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type Ref } from "react";
import { createPost, forumErrorMessage, getThread, posterName, THREAD_LIMITS, type ForumPost, type ThreadDetail } from "@/lib/api/forums";
import { parsePosterIds, posterIdsSnapshot, rememberPosterId, subscribePosterIds } from "@/lib/forumSession";
import { quotesOf } from "@/lib/forumText";
import { useReader } from "@/lib/account";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "../Captcha";
import { RelativeTime } from "../RelativeTime";
import { ForumText } from "./ForumText";
import { ReportButton } from "./ReportButton";

const POLL_MS = 20_000;
const CAPTCHA_OFF_TOKEN = "captcha-disabled";

const postAnchor = (id: number) => `post-${id}`;

/** One thread: the opening post, the replies, and the reply form. New replies appear on their own every 20 seconds. */
export function ThreadView({ initial }: { initial: ThreadDetail }) {
  const queryClient = useQueryClient();
  const threadId = initial.thread.id;
  const queryKey = ["forum-thread", threadId];

  const { data } = useQuery({
    queryKey,
    // Only replies newer than the last one we have; the thread's own fields (locked, counts) come fresh each time.
    queryFn: async () => {
      const current = queryClient.getQueryData<ThreadDetail>(queryKey) ?? initial;
      const last = current.posts.at(-1)?.id ?? 0;
      const fresh = await getThread(threadId, { after: last });
      const known = new Set(current.posts.map((post) => post.id));
      return { ...fresh, posts: [...current.posts, ...fresh.posts.filter((post) => !known.has(post.id))] };
    },
    initialData: initial,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  });
  const { thread, posts, hasMore } = data;

  // Read after hydration: the server can't know which posts are the reader's own.
  const stored = useSyncExternalStore(
    subscribePosterIds,
    () => posterIdsSnapshot(threadId),
    () => "[]",
  );
  const mine = useMemo(() => parsePosterIds(stored), [stored]);

  const anchors = useMemo(() => {
    const map = new Map<number, string>(posts.map((post) => [post.id, postAnchor(post.id)]));
    if (!map.has(thread.id)) map.set(thread.id, "op");
    return map;
  }, [posts, thread.id]);

  const backlinks = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const post of posts) {
      const quoted = new Set([...quotesOf(post.body), ...(post.replyTo ? [post.replyTo] : [])]);
      for (const target of quoted) if (target !== post.id) map.set(target, [...(map.get(target) ?? []), post.id]);
    }
    return map;
  }, [posts]);

  const form = useRef<ReplyFormHandle>(null);

  return (
    <>
      <article id="op" aria-labelledby="thread-title" className="scroll-mt-24 rounded-2xl border border-line p-4 target:border-ink sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs">
          {thread.pinned && <span className="rounded-full bg-ink px-2 py-0.5 font-bold text-paper">Fixada</span>}
          {thread.locked && <span className="rounded-full border border-line px-2 py-0.5 font-bold">Fechada</span>}
        </div>
        <h1 id="thread-title" className="mb-3 break-words text-3xl font-bold leading-tight sm:text-4xl">
          {thread.title}
        </h1>
        <PosterLine
          nickname={thread.nickname}
          posterId={thread.posterId}
          isOp
          mine={mine.includes(thread.posterId)}
          createdAt={thread.createdAt}
          number={thread.id}
        />
        {thread.link && (
          <p className="mt-3 rounded-lg bg-surface p-3 text-sm">
            <span className="font-mono text-xs text-muted">
              {thread.link.kind === "article" ? "Sobre a notícia" : "Sobre a iniciativa"}
            </span>{" "}
            <Link
              href={thread.link.kind === "article" ? `/article/${thread.link.id}` : `/iniciativas/${thread.link.id}`}
              className="block font-bold text-link underline"
            >
              {thread.link.title}
            </Link>
          </p>
        )}
        <div className="mt-3">
          <ForumText body={thread.body} anchors={anchors} />
        </div>
        <Backlinks ids={backlinks.get(thread.id) ?? []} />
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {!thread.locked && <ReplyButton onClick={() => form.current?.replyTo(null)} />}
          <ReportButton kind="thread" id={thread.id} />
        </div>
      </article>

      <section aria-labelledby="replies-heading" className="mt-8">
        <h2 id="replies-heading" className="mb-4 font-mono text-sm font-bold uppercase tracking-widest text-muted">
          {posts.length === 0 ? "Ainda sem respostas" : posts.length === 1 ? "1 resposta" : `${posts.length} respostas`}
        </h2>
        <ol className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Reply
                post={post}
                mine={post.posterId !== null && mine.includes(post.posterId)}
                anchors={anchors}
                answers={backlinks.get(post.id) ?? []}
                locked={thread.locked}
                onReply={() => form.current?.replyTo(post.id)}
              />
            </li>
          ))}
        </ol>
        {hasMore && (
          <button
            type="button"
            onClick={() => void queryClient.refetchQueries({ queryKey })}
            className="mt-4 rounded-full border border-line px-4 py-2 font-mono text-sm font-bold hover:bg-surface"
          >
            Carregar mais respostas
          </button>
        )}
      </section>

      <section aria-labelledby="reply-heading" className="mt-8">
        <h2 id="reply-heading" className="mb-3 text-lg font-bold">
          Responder
        </h2>
        {thread.locked ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-muted">
            Esta discussão foi fechada pela moderação e já não aceita respostas.
          </p>
        ) : (
          <ReplyForm
            ref={form}
            threadId={threadId}
            onPosted={(posterId) => {
              rememberPosterId(threadId, posterId);
              void queryClient.refetchQueries({ queryKey });
            }}
          />
        )}
      </section>
    </>
  );
}

function PosterLine({
  nickname,
  posterId,
  isOp,
  mine,
  createdAt,
  number,
}: {
  nickname: string | null;
  posterId: string | null;
  isOp: boolean;
  mine: boolean;
  createdAt: string;
  number: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
      <span className="font-bold text-ink">{posterName(nickname)}</span>
      {posterId && (
        <span title="O ID identifica quem escreve dentro desta discussão" className="rounded bg-surface px-1.5 py-0.5 text-ink">
          ID: {posterId}
        </span>
      )}
      {isOp && <span className="rounded bg-ink px-1.5 py-0.5 font-bold text-paper">OP</span>}
      {mine && <span className="font-bold text-ink">(tu)</span>}
      <span aria-hidden="true">·</span>
      <RelativeTime value={createdAt} />
      <span aria-hidden="true">·</span>
      <span>No.{number}</span>
    </div>
  );
}

function Reply({
  post,
  mine,
  anchors,
  answers,
  locked,
  onReply,
}: {
  post: ForumPost;
  mine: boolean;
  anchors: ReadonlyMap<number, string>;
  answers: number[];
  locked: boolean;
  onReply: () => void;
}) {
  const quoted = post.body !== null && post.replyTo !== null && quotesOf(post.body).includes(post.replyTo);
  return (
    <article
      id={postAnchor(post.id)}
      aria-label={`Resposta ${post.id} de ${posterName(post.nickname)}`}
      className="scroll-mt-24 rounded-2xl border border-line p-4 transition-colors target:border-ink target:bg-surface"
    >
      {post.hidden || post.body === null ? (
        <p className="font-mono text-sm italic text-muted">No.{post.id} · Removido pela moderação</p>
      ) : (
        <>
          <PosterLine
            nickname={post.nickname}
            posterId={post.posterId}
            isOp={post.isOp}
            mine={mine}
            createdAt={post.createdAt}
            number={post.id}
          />
          {post.replyTo !== null && !quoted && (
            <p className="mt-2 font-mono text-xs text-muted">
              Em resposta a{" "}
              {anchors.has(post.replyTo) ? (
                <a href={`#${anchors.get(post.replyTo)}`} className="text-link underline">
                  &gt;&gt;{post.replyTo}
                </a>
              ) : (
                <>&gt;&gt;{post.replyTo}</>
              )}
            </p>
          )}
          <div className="mt-2">
            <ForumText body={post.body} anchors={anchors} />
          </div>
          <Backlinks ids={answers} />
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {!locked && <ReplyButton onClick={onReply} />}
            <ReportButton kind="post" id={post.id} />
          </div>
        </>
      )}
    </article>
  );
}

function Backlinks({ ids }: { ids: number[] }) {
  if (ids.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-2 font-mono text-xs text-muted">
      <span>Respostas:</span>
      {ids.map((id) => (
        <a key={id} href={`#${postAnchor(id)}`} className="text-link underline decoration-dotted">
          &gt;&gt;{id}
        </a>
      ))}
    </p>
  );
}

function ReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-2.5 py-1.5 font-mono text-xs font-bold text-muted hover:bg-surface hover:text-ink"
    >
      Responder
    </button>
  );
}

type ReplyFormHandle = { replyTo: (id: number | null) => void };

function ReplyForm({ threadId, onPosted, ref }: { threadId: number; onPosted: (posterId: string) => void; ref: Ref<ReplyFormHandle> }) {
  const id = useId();
  const captcha = useRef<CaptchaHandle>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [nickname, setNickname] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [captchaShown, setCaptchaShown] = useState(false);
  const reader = useReader();
  // With an account: no captcha, and the name is the account's.
  const captchaOff = isCaptchaOff() || Boolean(reader);

  // The parent's "Responder" buttons point the form at a post and quote it.
  useImperativeHandle(ref, () => ({
    replyTo: (target) => {
      setReplyTo(target);
      if (target !== null) setBody((current) => (current.includes(`>>${target}`) ? current : `>>${target}\n${current}`));
      setCaptchaShown(true);
      textarea.current?.scrollIntoView({ block: "center" });
      textarea.current?.focus();
    },
  }));

  if (!reader && !isCaptchaConfigured()) return <p className="text-muted">As respostas estão temporariamente indisponíveis.</p>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = body.trim();
    if (!clean) return setError("Escreve uma resposta antes de publicar.");
    const captchaToken = reader ? null : captchaOff ? CAPTCHA_OFF_TOKEN : token;
    if (!reader && !captchaToken) return setError("Confirma que não és um robô antes de publicar.");
    setError(null);
    setSending(true);
    try {
      // Only point at a post the text still quotes.
      const target = replyTo !== null && clean.includes(`>>${replyTo}`) ? replyTo : null;
      const created = await createPost(threadId, { body: clean, nickname: nickname.trim(), replyTo: target, captchaToken });
      setBody("");
      setReplyTo(null);
      setStatus("Resposta publicada.");
      onPosted(created.posterId);
    } catch (failure) {
      setError(forumErrorMessage(failure));
    } finally {
      setSending(false);
      captcha.current?.reset();
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3 focus-within:border-muted"
    >
      {replyTo !== null && (
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          A responder a{" "}
          <a href={`#${postAnchor(replyTo)}`} className="text-link underline">
            &gt;&gt;{replyTo}
          </a>
          <button type="button" onClick={() => setReplyTo(null)} className="underline">
            Cancelar
          </button>
        </p>
      )}
      <label htmlFor={`${id}-body`} className="sr-only">
        Resposta
      </label>
      <textarea
        id={`${id}-body`}
        ref={textarea}
        value={body}
        rows={4}
        maxLength={THREAD_LIMITS.body}
        placeholder="Escreve a tua resposta. Usa >>número para citar outra mensagem."
        onChange={(event) => {
          setBody(event.target.value);
          if (event.target.value.trim()) setCaptchaShown(true);
        }}
        className="w-full resize-y bg-transparent px-1 text-ink placeholder:text-muted focus:outline-none"
      />
      {captchaShown && !captchaOff && <Captcha ref={captcha} onToken={setToken} />}
      {error && (
        <p role="alert" className="px-1 text-sm text-danger">
          {error}
        </p>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {reader ? (
          <p className="min-w-0 flex-1 basis-40 px-1 font-mono text-xs text-muted">
            A publicar como <b className="text-ink">{reader.username}</b>
          </p>
        ) : (
          <>
            <label htmlFor={`${id}-nickname`} className="sr-only">
              Nome (opcional)
            </label>
            <input
              id={`${id}-nickname`}
              value={nickname}
              maxLength={THREAD_LIMITS.nickname}
              autoComplete="off"
              placeholder="Nome (opcional): Anónimo"
              onChange={(event) => setNickname(event.target.value)}
              className="min-w-0 flex-1 basis-40 rounded-full border border-line bg-paper px-3 py-1.5 font-mono text-xs text-ink placeholder:text-muted"
            />
          </>
        )}
        <span className="font-mono text-xs text-muted">
          {body.length}/{THREAD_LIMITS.body}
        </span>
        <button
          type="submit"
          disabled={sending}
          className="ml-auto rounded-full bg-ink px-4 py-1.5 font-mono text-sm font-bold text-paper hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "A publicar…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
