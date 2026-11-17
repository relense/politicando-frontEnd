"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { getAudit, moderatePost, moderateThread, type AuditEntry, type ThreadAction } from "@/lib/api/admin";
import { getBoards, getThread, getThreads, posterName, type ThreadSummary } from "@/lib/api/forums";
import { formatDateTime } from "@/lib/format";
import { buttonClass, Empty, ErrorNote, inputClass, useExpiry } from "./ui";

/** The boards as readers see them, with the moderator's buttons; and what was hidden lately, to undo it. */
export function ForumModeration() {
  const [board, setBoard] = useState("geral");
  const boards = useQuery({ queryKey: ["admin-boards"], queryFn: getBoards });
  return (
    <section aria-labelledby="forum-admin">
      <h1 id="forum-admin" className="mb-1 text-2xl font-bold">
        Fórum
      </h1>
      <p className="mb-4 text-sm text-muted">
        Fixar põe uma discussão no topo do quadro; fechar impede respostas novas; esconder tira-a do site. Abre uma discussão para esconder
        respostas.
      </p>
      <label className="mb-4 flex max-w-xs flex-col gap-1">
        <span className="font-mono text-xs font-bold">Quadro</span>
        <select value={board} onChange={(event) => setBoard(event.target.value)} className={inputClass}>
          {(boards.data ?? [{ board: "geral", name: "Geral", acronym: null }]).map((item) => (
            <option key={item.board} value={item.board}>
              {item.acronym ? `${item.acronym} · ${item.name}` : item.name}
            </option>
          ))}
        </select>
      </label>
      <BoardThreads board={board} />
      <RecentlyHidden />
    </section>
  );
}

const ACTION_LABELS: Record<ThreadAction, string> = {
  pin: "Fixar",
  unpin: "Desafixar",
  lock: "Fechar",
  unlock: "Reabrir",
  hide: "Esconder",
  unhide: "Mostrar outra vez",
};

function BoardThreads({ board }: { board: string }) {
  const client = useQueryClient();
  const expiry = useExpiry();
  const [open, setOpen] = useState<number | null>(null);
  const threads = useQuery({ queryKey: ["admin-threads", board], queryFn: () => getThreads(board, { sort: "new", limit: 50 }) });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: ThreadAction }) => moderateThread(id, action),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-threads"] });
      client.invalidateQueries({ queryKey: ["admin-hidden"] });
    },
    onError: expiry,
  });

  if (threads.isPending) return <p className="text-muted">A carregar…</p>;
  return (
    <>
      <ErrorNote error={act.error ?? threads.error} />
      {threads.data && threads.data.items.length === 0 ? (
        <Empty>Sem discussões neste quadro.</Empty>
      ) : (
        <ul aria-label="Discussões" className="flex flex-col gap-3">
          {threads.data?.items.map((thread) => {
            const busy = act.isPending && act.variables?.id === thread.id;
            const actions: ThreadAction[] = [thread.pinned ? "unpin" : "pin", thread.locked ? "unlock" : "lock", "hide"];
            return (
              <li key={thread.id}>
                <article className="rounded-2xl border border-line p-4">
                  <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
                    {thread.pinned && <span className="rounded-full bg-ink px-2 py-0.5 font-bold text-paper">Fixada</span>}
                    {thread.locked && <span className="rounded-full border border-line px-2 py-0.5 font-bold text-ink">Fechada</span>}
                    <span className="font-bold text-ink">{posterName(thread.nickname)}</span>
                    <span>(ID: {thread.posterId})</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTime(thread.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{thread.replyCount === 1 ? "1 resposta" : `${thread.replyCount} respostas`}</span>
                  </p>
                  <h2 className="break-words text-lg font-bold leading-snug">{thread.title}</h2>
                  {thread.excerpt && <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-muted">{thread.excerpt}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={busy}
                        onClick={() => act.mutate({ id: thread.id, action })}
                        className={buttonClass(action === "hide" ? "danger" : "plain")}
                      >
                        {ACTION_LABELS[action]}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-expanded={open === thread.id}
                      onClick={() => setOpen(open === thread.id ? null : thread.id)}
                      className={buttonClass()}
                    >
                      {open === thread.id ? "Fechar respostas" : "Ver respostas"}
                    </button>
                    <Link href={threadHref(thread)} target="_blank" className="font-mono text-xs text-link underline">
                      Ver no site ↗
                    </Link>
                  </div>
                  {open === thread.id && <ThreadPosts id={thread.id} />}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const threadHref = (thread: Pick<ThreadSummary, "board" | "id">) =>
  thread.board === "ideias" ? `/feedback/ideias/${thread.id}` : `/forum/${thread.board}/${thread.id}`;

/** The replies of one thread, hidden ones included (their text is gone from the API, so only the button shows). */
function ThreadPosts({ id }: { id: number }) {
  const client = useQueryClient();
  const expiry = useExpiry();
  const detail = useQuery({ queryKey: ["admin-thread", id], queryFn: () => getThread(id) });
  const act = useMutation({
    mutationFn: ({ postId, hide }: { postId: number; hide: boolean }) => moderatePost(postId, hide ? "hide" : "unhide"),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-thread", id] });
      client.invalidateQueries({ queryKey: ["admin-hidden"] });
    },
    onError: expiry,
  });
  if (detail.isPending) return <p className="mt-3 text-sm text-muted">A carregar as respostas…</p>;
  const posts = detail.data?.posts ?? [];
  return (
    <div className="mt-3 border-t border-line pt-3">
      <ErrorNote error={act.error ?? detail.error} />
      {posts.length === 0 ? (
        <p className="text-sm text-muted">Ainda sem respostas.</p>
      ) : (
        <ul aria-label="Respostas" className="flex flex-col gap-2">
          {posts.map((post) => (
            <li key={post.id} className={`rounded-xl border p-3 text-sm ${post.hidden ? "border-dashed border-line" : "border-line"}`}>
              <p className="mb-1 font-mono text-xs text-muted">
                No.{post.id} ·{" "}
                {post.hidden ? "escondida" : `${posterName(post.nickname)} (ID: ${post.posterId}) · ${formatDateTime(post.createdAt)}`}
              </p>
              {!post.hidden && <p className="whitespace-pre-line break-words">{post.body}</p>}
              <button
                type="button"
                disabled={act.isPending && act.variables?.postId === post.id}
                onClick={() => act.mutate({ postId: post.id, hide: !post.hidden })}
                className={`${buttonClass(post.hidden ? "plain" : "danger")} mt-2`}
              >
                {post.hidden ? "Mostrar outra vez" : "Esconder"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Still hidden: the last hide in the log with no unhide after it. A thing is hidden from its own buttons
 * ("thread.hide", "post.hide") or from the reports queue ("report.hide", logged on the thread or post).
 */
export function stillHidden(entries: AuditEntry[], entity: "thread" | "post"): AuditEntry[] {
  const latest = new Map<string, AuditEntry>();
  // Newest first: the first entry per id is its current state.
  for (const entry of entries) {
    if (entry.entity !== entity) continue;
    if (![`${entity}.hide`, `${entity}.unhide`, "report.hide"].includes(entry.action)) continue;
    if (!latest.has(entry.entityId)) latest.set(entry.entityId, entry);
  }
  return [...latest.values()].filter((entry) => entry.action.endsWith(".hide"));
}

/** A hidden thread leaves the board, so the log is where to find it again. */
function RecentlyHidden() {
  const client = useQueryClient();
  const expiry = useExpiry();
  const log = useQuery({
    queryKey: ["admin-hidden"],
    queryFn: async () => ({ threads: stillHidden(await getAudit("thread"), "thread"), posts: stillHidden(await getAudit("post"), "post") }),
  });
  const undo = useMutation({
    mutationFn: ({ kind, id }: { kind: "thread" | "post"; id: number }) =>
      kind === "thread" ? moderateThread(id, "unhide") : moderatePost(id, "unhide"),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-hidden"] });
      client.invalidateQueries({ queryKey: ["admin-threads"] });
      client.invalidateQueries({ queryKey: ["admin-thread"] });
    },
    onError: expiry,
  });
  const rows = [
    ...(log.data?.threads ?? []).map((entry) => ({ kind: "thread" as const, entry })),
    ...(log.data?.posts ?? []).map((entry) => ({ kind: "post" as const, entry })),
  ].sort((a, b) => b.entry.at.localeCompare(a.entry.at));

  return (
    <section aria-labelledby="escondidos" className="mt-10">
      <h2 id="escondidos" className="mb-1 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
        Escondidos recentemente
      </h2>
      <p className="mb-3 text-sm text-muted">
        Discussões e respostas escondidas que continuam escondidas, segundo o registo de alterações.
      </p>
      <ErrorNote error={undo.error ?? log.error} />
      {log.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : rows.length === 0 ? (
        <Empty>Nada escondido.</Empty>
      ) : (
        <ul aria-label="Escondidos recentemente" className="divide-y divide-line">
          {rows.map(({ kind, entry }) => (
            <li key={`${kind}-${entry.entityId}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="text-sm">
                <b>
                  {kind === "thread" ? "Discussão" : "Resposta"} #{entry.entityId}
                </b>{" "}
                <span className="font-mono text-xs text-muted">
                  escondida {formatDateTime(entry.at)}
                  {entry.admin ? ` por ${entry.admin.name}` : ""}
                </span>
              </span>
              <button
                type="button"
                disabled={undo.isPending && undo.variables?.id === Number(entry.entityId)}
                onClick={() => undo.mutate({ kind, id: Number(entry.entityId) })}
                className={buttonClass()}
              >
                Mostrar outra vez
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
