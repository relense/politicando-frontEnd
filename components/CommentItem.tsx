"use client";

import { useState } from "react";
import { countReplies, displayName, type CommentNode } from "@/lib/comments";
import { repliesLabel } from "@/lib/format";
import { CommentForm } from "./CommentForm";
import { QuoteLink, CommentText } from "./CommentText";
import { useComments } from "./CommentsContext";
import { ReportButton } from "./forum/ReportButton";
import { CommentIcon, ShareIcon } from "./icons";
import { RelativeTime } from "./RelativeTime";

/** Past this depth replies stop indenting, so deep threads stay readable on a phone. */
const MAX_INDENT_DEPTH = 6;

type Props = { node: CommentNode; articleId: number; depth?: number };

export function CommentItem({ node, articleId, depth = 0 }: Props) {
  const { backlinks, quote } = useComments();
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);

  const name = displayName(node);
  const toggle = () => setCollapsed((value) => !value);
  const indentReplies = depth < MAX_INDENT_DEPTH;
  const answers = backlinks.get(node.id) ?? [];

  const replies = node.replies.length > 0 && (
    <ul className="mt-3 flex flex-col gap-4">
      {node.replies.map((reply) => (
        <li key={reply.id} className="relative">
          {/* The curve from the parent's thread line into the reply, as on Reddit. */}
          {indentReplies && (
            <span aria-hidden="true" className="absolute -left-4 top-0 h-4 w-4 rounded-bl-xl border-b border-l border-line" />
          )}
          <CommentItem node={reply} articleId={articleId} depth={indentReplies ? depth + 1 : depth} />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <article
        id={`comentario-${node.id}`}
        aria-label={`Comentário de ${name}`}
        className={`scroll-mt-24 ${node.pending ? "opacity-60" : ""}`}
      >
        <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          {collapsed && (
            <button
              type="button"
              aria-expanded={false}
              aria-label={`Expandir comentário de ${name}`}
              onClick={toggle}
              className="flex size-6 items-center justify-center rounded-full border border-line text-sm leading-none text-ink hover:bg-surface"
            >
              +
            </button>
          )}
          <Avatar name={name} />
          <span className="font-bold text-ink">{name}</span>
          {node.pending ? (
            <span>a enviar…</span>
          ) : (
            <button
              type="button"
              onClick={() => quote(node.id)}
              title="Citar este comentário"
              aria-label={`No.${node.id}, citar este comentário`}
              className="hover:text-link hover:underline"
            >
              No.{node.id}
            </button>
          )}
          <span aria-hidden="true">·</span>
          <RelativeTime value={node.createdAt} />
          {collapsed && node.replies.length > 0 && <span>({repliesLabel(countReplies(node))})</span>}
        </div>

        {!collapsed && (
          <div className="flex">
            {/* The thread line, as on Reddit: clicking it collapses the thread. The ⊖ button does the same by keyboard. */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={toggle}
              className="group flex w-8 shrink-0 cursor-pointer justify-center"
            >
              <span className="w-px bg-line group-hover:w-0.5 group-hover:bg-ink" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
                <CommentText text={node.text} />
              </p>

              {answers.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-xs text-muted">
                  <span>Respostas:</span>
                  {answers.map((id) => (
                    <QuoteLink key={id} id={id} />
                  ))}
                </p>
              )}

              <div className="relative -ml-8 mt-1 flex flex-wrap items-center gap-1 font-mono text-xs">
                <button
                  type="button"
                  aria-expanded={true}
                  aria-label={`Recolher comentário de ${name}`}
                  onClick={toggle}
                  className="relative z-10 flex size-8 items-center justify-center rounded-full bg-paper text-muted hover:text-ink"
                >
                  <span className="flex size-5 items-center justify-center rounded-full border border-current text-sm leading-none">−</span>
                </button>
                {!node.pending && (
                  <>
                    <button type="button" aria-expanded={replying} onClick={() => setReplying((value) => !value)} className={actionClass}>
                      <CommentIcon />
                      Responder
                    </button>
                    <button type="button" onClick={() => quote(node.id)} className={actionClass}>
                      <span aria-hidden="true" className="font-bold">
                        &gt;&gt;
                      </span>
                      Citar
                    </button>
                    <CopyLinkButton id={node.id} />
                    <ReportButton kind="comment" id={node.id} />
                  </>
                )}
              </div>

              {replying && (
                <div className="mt-2">
                  <CommentForm
                    articleId={articleId}
                    parentId={node.id}
                    autoFocus
                    onPosted={() => setReplying(false)}
                    onCancel={() => setReplying(false)}
                  />
                </div>
              )}

              {indentReplies && replies}
            </div>
          </div>
        )}
      </article>
      {!collapsed && !indentReplies && replies}
    </>
  );
}

const actionClass = "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-bold text-muted hover:bg-surface hover:text-ink";

/** Anonymous posts share one grey avatar; a chosen name always gets the same colour. */
function Avatar({ name }: { name: string }) {
  const anonymous = name === "anon";
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 select-none items-center justify-center rounded-full font-mono text-sm font-bold uppercase ${anonymous ? "bg-line text-ink" : "text-white"}`}
      style={anonymous ? undefined : { backgroundColor: `hsl(${hash % 360} 45% 38%)` }}
    >
      {anonymous ? "?" : name[0]}
    </span>
  );
}

/** Copies the link to this comment. */
function CopyLinkButton({ id }: { id: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.href.split("#")[0]}#comentario-${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: nothing useful to show.
    }
  }

  return (
    <button type="button" onClick={() => void copy()} className={actionClass}>
      <ShareIcon />
      <span aria-live="polite">{copied ? "Ligação copiada" : "Partilhar"}</span>
    </button>
  );
}
