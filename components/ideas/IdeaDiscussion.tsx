"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { NameAvatar } from "@/components/Avatar";
import { RelativeTime } from "@/components/RelativeTime";
import { ForumText } from "@/components/forum/ForumText";
import { ReportButton } from "@/components/forum/ReportButton";
import { ReplyForm, type ReplyFormHandle } from "@/components/forum/ThreadView";
import { getThread, posterName, type ForumPost, type ReplySort, type ThreadDetail } from "@/lib/api/forums";
import { useAccountGate } from "@/lib/account";
import { rememberPosterId } from "@/lib/forumSession";
import { commentsLabel } from "@/lib/ideas";
import { ReplyVote } from "./ReplyVote";

const POLL_MS = 20_000;
const SORTS: { value: Exclude<ReplySort, "old">; label: string }[] = [
  { value: "top", label: "Melhores" },
  { value: "new", label: "Recentes" },
];

/** One level of nesting: each answer under the comment it answers, or that comment's own parent. */
function nest(posts: ForumPost[]) {
  const byId = new Map(posts.map((post) => [post.id, post]));
  const rootOf = (post: ForumPost) => {
    let current = post;
    for (let step = 0; step < 50 && current.replyTo !== null && byId.has(current.replyTo); step++) current = byId.get(current.replyTo)!;
    return current.id;
  };
  const groups: { post: ForumPost; children: ForumPost[] }[] = [];
  const index = new Map<number, (typeof groups)[number]>();
  for (const post of posts) {
    if (rootOf(post) !== post.id) continue;
    const group = { post, children: [] as ForumPost[] };
    index.set(post.id, group);
    groups.push(group);
  }
  for (const post of posts) {
    const root = rootOf(post);
    if (root !== post.id) index.get(root)?.children.push(post);
  }
  // Answers read in order under their comment.
  for (const group of groups) group.children.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return groups;
}

/** An idea's comments: the box first, then «Melhores · Recentes», the team's replies marked. New ones appear every 20 seconds. */
export function IdeaDiscussion({ initial, locked }: { initial: ThreadDetail; locked: boolean }) {
  const threadId = initial.thread.id;
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<Exclude<ReplySort, "old">>("top");
  const queryKey = ["idea-replies", threadId, sort];
  // A page at a time (200), «Ver mais comentários» for the next one in the same order.
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => getThread(threadId, { sort, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    initialData: sort === "top" ? { pages: [initial], pageParams: [null] } : undefined,
    staleTime: POLL_MS,
    // A refetch asks again for every page loaded: only poll while there's one.
    refetchInterval: (query) => ((query.state.data?.pages.length ?? 1) > 1 ? false : POLL_MS),
  });
  const posts = useMemo(() => {
    // In «Melhores», a vote between pages can move a comment across the boundary: shown once.
    const seen = new Set<number>();
    return (data?.pages ?? []).flatMap((page) => page.posts).filter((post) => !seen.has(post.id) && seen.add(post.id));
  }, [data]);
  const groups = useMemo(() => nest(posts), [posts]);
  const anchors = useMemo(() => new Map(posts.map((post) => [post.id, `post-${post.id}`])), [posts]);
  // The comments shown (hidden ones aren't); «Mais de» until every page is in.
  const visible = posts.filter((post) => !post.hidden).length;
  const form = useRef<ReplyFormHandle>(null);
  const gate = useAccountGate();

  const comment = (post: ForumPost) => (
    <article
      id={`post-${post.id}`}
      aria-label={`Comentário de ${posterName(post.nickname)}`}
      className="scroll-mt-24 py-3 target:bg-surface"
    >
      {post.hidden || post.body === null ? (
        <p className="font-mono text-sm italic text-muted">Removido pela moderação</p>
      ) : (
        <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
          <NameAvatar name={posterName(post.nickname)} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
              <b className="text-ink">{posterName(post.nickname)}</b>
              {post.team && (
                <span className="rounded bg-[color-mix(in_srgb,#f2c94c_20%,transparent)] px-1.5 py-0.5 text-[10px] font-bold text-[#8a6500] dark:text-[#f2c94c]">
                  EQUIPA
                </span>
              )}
              <RelativeTime value={post.createdAt} />
            </p>
            {hasNextPage && post.replyTo !== null && !anchors.has(post.replyTo) && (
              // Answering a comment on a page not loaded yet: it moves under it once that page is in.
              <p className="mt-1 font-mono text-[11px] text-muted">Em resposta a um comentário mais abaixo</p>
            )}
            <div className="mt-1">
              <ForumText body={post.body} anchors={anchors} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <ReplyVote id={post.id} score={post.score} author={posterName(post.nickname)} />
              {!locked && (
                <button
                  type="button"
                  onClick={(event) => gate("forum", event.currentTarget) || form.current?.replyTo(post.id)}
                  className="rounded-full px-2 py-1 font-mono text-[11px] font-bold text-muted underline hover:bg-surface hover:text-ink"
                >
                  Responder
                </button>
              )}
              <ReportButton kind="post" id={post.id} />
            </div>
          </div>
        </div>
      )}
    </article>
  );

  return (
    <section id="comentarios" aria-labelledby="comentarios-heading" className="scroll-mt-24">
      <h2 id="comentarios-heading" className="sr-only">
        Comentários
      </h2>
      {locked ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-muted">Esta ideia foi fechada e já não aceita comentários.</p>
      ) : (
        <ReplyForm
          ref={form}
          threadId={threadId}
          label="Comentário"
          rows={3}
          placeholder="Junta a tua opinião. O que te faria usar isto?"
          submitLabel="Comentar"
          signedAs="Comentas como"
          onPosted={(posterId) => {
            rememberPosterId(threadId, posterId);
            setSort("new");
            void queryClient.invalidateQueries({ queryKey: ["idea-replies", threadId] });
          }}
        />
      )}

      <div className="mt-6 flex items-end justify-between gap-3 border-b border-line">
        <div role="group" aria-label="Ordem dos comentários" className="flex gap-4">
          {SORTS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={sort === item.value}
              onClick={() => setSort(item.value)}
              className={`-mb-px border-b-2 px-1 pb-2 font-mono text-xs font-bold ${
                sort === item.value ? "border-[#f0c75e] text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="pb-2 font-mono text-[11px] text-muted">
          {hasNextPage ? `Mais de ${commentsLabel(visible)}` : commentsLabel(visible)}
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-sm text-muted">{data ? "Ainda sem comentários. Diz o que te faria usar isto." : "A carregar…"}</p>
      ) : (
        <ol className="divide-y divide-line">
          {groups.map(({ post, children }) => (
            <li key={post.id}>
              {comment(post)}
              {children.length > 0 && (
                <ol aria-label={`Respostas a ${posterName(post.nickname)}`} className="mb-3 ml-11 border-l-2 border-line pl-3">
                  {children.map((child) => (
                    <li key={child.id}>{comment(child)}</li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
      {hasNextPage && (
        <button
          type="button"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          className="mt-4 rounded-full border border-line px-4 py-2 font-mono text-sm font-bold hover:bg-surface disabled:opacity-50"
        >
          {isFetchingNextPage ? "A carregar…" : "Ver mais comentários"}
        </button>
      )}
      {isFetchNextPageError && !isFetchingNextPage && (
        <p role="alert" className="mt-2 text-sm text-danger">
          Não foi possível carregar mais comentários. Tenta outra vez.
        </p>
      )}
    </section>
  );
}
