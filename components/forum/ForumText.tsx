import { splitForumText } from "@/lib/forumText";

type Props = {
  body: string;
  /** Where each quotable number points on this page; numbers not here are shown struck through. */
  anchors: ReadonlyMap<number, string>;
};

/** A post's plain text: line breaks kept, web addresses as links, and ">>123" as links to the post quoted. */
export function ForumText({ body, anchors }: Props) {
  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed">
      {splitForumText(body).map((part, index) => {
        if (part.kind === "text") return part.text;
        if (part.kind === "url") {
          return (
            <a key={index} href={part.url} target="_blank" rel="nofollow ugc noopener" className="text-link underline">
              {part.text}
            </a>
          );
        }
        const anchor = anchors.get(part.id);
        return anchor ? (
          <a
            key={index}
            href={`#${anchor}`}
            className="font-mono text-link underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            &gt;&gt;{part.id}
          </a>
        ) : (
          <span key={index} className="font-mono text-muted line-through" title="Esta mensagem não está nesta discussão">
            &gt;&gt;{part.id}
          </span>
        );
      })}
    </p>
  );
}
