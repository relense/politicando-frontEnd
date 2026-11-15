"use client";

import { useState } from "react";
import { displayName, splitMentions } from "@/lib/comments";
import { useComments } from "./CommentsContext";
import { RelativeTime } from "./RelativeTime";

/** A comment's text, with ">>123" mentions turned into links to the post they point to. */
export function CommentText({ text, preview = false }: { text: string; preview?: boolean }) {
  return (
    <>
      {splitMentions(text).map((part, index) =>
        typeof part === "string" ? (
          part
        ) : preview ? (
          // No previews inside a preview, so hovering never opens a chain of cards.
          <span key={index} className="font-mono text-link">
            &gt;&gt;{part.mention}
          </span>
        ) : (
          <QuoteLink key={index} id={part.mention} />
        ),
      )}
    </>
  );
}

/**
 * A link to another post on this page. Hovering or focusing it shows the post, as on 4chan; clicking
 * jumps to it and highlights it. A post that is not on this page is shown struck through.
 */
export function QuoteLink({ id }: { id: number }) {
  const { byId } = useComments();
  const [open, setOpen] = useState(false);
  const target = byId.get(id);

  if (!target) {
    return (
      <span className="font-mono text-muted line-through" title="Este comentário não existe nesta página">
        &gt;&gt;{id}
      </span>
    );
  }

  return (
    <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <a
        href={`#comentario-${id}`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(false)}
        className="font-mono text-link underline decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        &gt;&gt;{id}
      </a>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 block w-72 max-w-[80vw] rounded-lg border border-line bg-paper p-3 text-left font-serif text-sm font-normal text-ink shadow-lg"
        >
          <span className="mb-1 flex flex-wrap gap-x-2 font-mono text-xs text-muted">
            <span className="font-bold text-ink">{displayName(target)}</span>
            <span>No.{target.id}</span>
            <RelativeTime value={target.createdAt} />
          </span>
          <span className="line-clamp-6 block whitespace-pre-wrap break-words">
            <CommentText text={target.text} preview />
          </span>
        </span>
      )}
    </span>
  );
}
