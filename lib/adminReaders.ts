import type { Reader, ReaderActivity, ReaderStatus } from "@/lib/api/admin";
import { editorialPath } from "@/lib/editorial";
import { formatDate } from "@/lib/format";

/** The readers' section, in words: an account's standing, and what it did, each with where it happened. */

export const READER_STATUS_LABELS: Record<ReaderStatus, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  banned: "Banida",
  deleted: "Apagada",
};

export function readerStatusLine(reader: Pick<Reader, "status" | "suspendedUntil">): string {
  const until = reader.status === "suspended" ? formatDate(reader.suspendedUntil) : null;
  return until ? `Suspensa até ${until}` : READER_STATUS_LABELS[reader.status];
}

const ACTIVITY_LABELS: Record<string, string> = {
  comment: "Comentou",
  forum_thread: "Abriu uma conversa no fórum",
  forum_post: "Respondeu no fórum",
  importa: "Marcou «Importa»",
  follow: "Passou a seguir",
  unfollow: "Deixou de seguir",
  save: "Guardou",
  prediction: "Fez uma previsão",
  report: "Denunciou",
  feedback: "Escreveu à equipa",
  read: "Leu",
};

export function activityLabel(item: Pick<ReaderActivity, "kind" | "text">): string {
  if (item.kind === "vote") return item.text === "down" ? "Votou contra (▼)" : "Votou a favor (▲)";
  return ACTIVITY_LABELS[item.kind] ?? "Atividade";
}

/** A vote's text is its direction, already in the label: not shown again. */
export const activityText = (item: Pick<ReaderActivity, "kind" | "text">): string | null => (item.kind === "vote" ? null : item.text);

export function activityHref(target: ReaderActivity["target"]): string | null {
  if (!target) return null;
  switch (target.type) {
    case "article":
      return `/article/${target.id}`;
    case "story":
      return `/historias/${target.id}`;
    case "thread":
      return `/forum/${encodeURIComponent(target.board ?? "geral")}/${target.id}`;
    case "budget_proposal":
      return target.year ? `/orcamento/${target.year}/proposta/${target.id}` : null;
    case "editorial":
      return target.slug ? editorialPath(target.slug) : null;
    case "initiative":
      return `/iniciativas/${target.id}`;
    default:
      return null;
  }
}

export const READER_COUNT_LABELS: { key: keyof Reader["counts"]; label: string }[] = [
  { key: "comments", label: "Comentários" },
  { key: "forumPosts", label: "Fórum" },
  { key: "importa", label: "Importa" },
  { key: "follows", label: "A seguir" },
  { key: "saved", label: "Guardados" },
  { key: "predictions", label: "Previsões" },
  { key: "reportsMade", label: "Denúncias feitas" },
  { key: "reportsAgainst", label: "Denúncias recebidas" },
];
