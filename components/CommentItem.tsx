"use client";

import { useState } from "react";
import { countReplies, displayName, type CommentNode } from "@/lib/comments";
import { repliesLabel } from "@/lib/format";
import { CommentForm } from "./CommentForm";
import { RelativeTime } from "./RelativeTime";

/** Past this depth replies stop indenting, so deep threads stay readable on a phone. */
const MAX_INDENT_DEPTH = 6;

type Props = { node: CommentNode; articleId: number; depth?: number };

export function CommentItem({ node, articleId, depth = 0 }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);

  const name = displayName(node);
  const toggle = () => setCollapsed((value) => !value);
  const indentReplies = depth < MAX_INDENT_DEPTH;

  const replies = node.replies.length > 0 && (
    <ul className="mt-4 flex flex-col gap-4">
      {node.replies.map((reply) => (
        <li key={reply.id}>
          <CommentItem node={reply} articleId={articleId} depth={indentReplies ? depth + 1 : depth} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div id={`comentario-${node.id}`} className={node.pending ? "opacity-60" : undefined}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expandir" : "Recolher"} comentário de ${name}`}
            onClick={toggle}
            className="flex size-5 shrink-0 items-center justify-center rounded border border-line leading-none hover:bg-surface hover:text-ink"
          >
            {collapsed ? "+" : "−"}
          </button>
          <span className="font-bold text-ink">{name}</span>
          {node.pending ? <span>a enviar…</span> : <span>#{node.id}</span>}
          <RelativeTime value={node.createdAt} />
          {collapsed && node.replies.length > 0 && <span>({repliesLabel(countReplies(node))})</span>}
        </div>

        {!collapsed && (
          <div className="flex">
            {/* The thread line, as on Reddit: clicking it collapses the thread. The button above does the same by keyboard. */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={toggle}
              className="group flex w-5 shrink-0 cursor-pointer justify-center pt-1"
            >
              <span className="w-px bg-line group-hover:w-0.5 group-hover:bg-ink" />
            </button>
            <div className="min-w-0 flex-1 pl-1">
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{node.text}</p>

              {!node.pending && (
                <div className="mt-1.5 font-mono text-xs">
                  <button
                    type="button"
                    aria-expanded={replying}
                    onClick={() => setReplying((value) => !value)}
                    className="rounded px-1 py-0.5 font-bold text-muted hover:bg-surface hover:text-ink"
                  >
                    responder
                  </button>
                </div>
              )}

              {replying && (
                <div className="mt-2">
                  <CommentForm
                    articleId={articleId}
                    parentId={node.id}
                    onPosted={() => setReplying(false)}
                    onCancel={() => setReplying(false)}
                  />
                </div>
              )}

              {indentReplies && replies}
            </div>
          </div>
        )}
      </div>
      {!collapsed && !indentReplies && replies}
    </>
  );
}
