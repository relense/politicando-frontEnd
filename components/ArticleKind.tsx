import { articleKindLabel } from "@/lib/api/mappers";
import type { ArticleKind } from "@/lib/types";

/** Under the outlet, in gray: «Notícia», «Opinião», «Podcast» or «Newsletter». Nothing until the API says. */
export function ArticleKindLabel({ kind, className = "" }: { kind: ArticleKind | null | undefined; className?: string }) {
  const label = articleKindLabel(kind);
  return label ? <p className={`font-mono text-[11px] text-muted ${className}`}>{label}</p> : null;
}
