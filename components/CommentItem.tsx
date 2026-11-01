"use client";

import { useState } from "react";
import { countReplies, displayName, type CommentNode } from "@/lib/comments";
import { formatDateTime, repliesLabel } from "@/lib/format";
import { CommentForm } from "./CommentForm";

type Props = { node: CommentNode; articleId: number };

export function CommentItem({ node, articleId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [openReplyId, setOpenReplyId] = useState<number | null>(null);

  const name = node.pending ? `${node.username || "anon"} (a enviar…)` : displayName(node);
  const date = formatDateTime(node.createdAt);
  const openReply = node.replies.find((reply) => reply.id === openReplyId);

  return (
    <div id={`comentario-${node.id}`} className={`rounded border border-line p-3 ${node.pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expandir" : "Recolher"} comentário de ${name}`}
          onClick={() => setCollapsed((value) => !value)}
          className="rounded px-1 hover:bg-surface"
        >
          {collapsed ? "[+]" : "[-]"}
        </button>
        <span className="font-bold text-ink">{name}</span>
        {node.parentName && <span>resposta a {node.parentName}</span>}
        {date && <time dateTime={node.createdAt ?? undefined}>{date}</time>}
        {collapsed && node.replies.length > 0 && <span>{repliesLabel(countReplies(node))}</span>}
      </div>

      {!collapsed && (
        <>
          <p className="mt-2 whitespace-pre-wrap break-words">{node.text}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
            {!node.pending && (
              <button type="button" aria-expanded={replying} onClick={() => setReplying((value) => !value)} className="text-link underline">
                responder
              </button>
            )}
            {node.replies.map((reply) => (
              <span key={reply.id} className="group relative">
                <button
                  type="button"
                  aria-expanded={openReplyId === reply.id}
                  aria-label={`Ver resposta de ${displayName(reply)}`}
                  onClick={() => setOpenReplyId((current) => (current === reply.id ? null : reply.id))}
                  className={`rounded-full border border-line px-2 py-0.5 hover:bg-surface ${openReplyId === reply.id ? "bg-surface font-bold" : ""}`}
                >
                  {displayName(reply)}
                </button>
                {/* Convenience preview for mouse and keyboard; the button shows the full reply. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-64 rounded border border-line bg-paper p-2 text-ink shadow-lg group-focus-within:block group-hover:block"
                >
                  {reply.text}
                </span>
              </span>
            ))}
          </div>

          {replying && (
            <div className="mt-3">
              <CommentForm
                articleId={articleId}
                parentId={node.id}
                onPosted={(created) => {
                  setReplying(false);
                  setOpenReplyId(created.id);
                }}
              />
            </div>
          )}

          {openReply && (
            <div className="mt-3 border-l-2 border-line pl-3">
              <CommentItem node={openReply} articleId={articleId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
