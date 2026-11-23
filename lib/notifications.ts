import { IDEA_STATUS_LABELS, IDEA_STATUSES, IDEAS_BOARD } from "@/lib/api/forums";
import type { Notification } from "./api/engagement";
import { editorialPath } from "./editorial";

/** The inbox's tabs: replies to the reader, news on what they follow, settled predictions. */
export type InboxTab = "tudo" | "respostas" | "seguir" | "previsoes";
export const INBOX_TABS: { key: InboxTab; label: string }[] = [
  { key: "tudo", label: "Tudo" },
  { key: "respostas", label: "Respostas" },
  { key: "seguir", label: "A seguir" },
  { key: "previsoes", label: "Previsões" },
];

export function tabOf(item: Notification): Exclude<InboxTab, "tudo"> {
  if (item.kind === "comment_reply" || item.kind === "forum_reply" || item.kind === "feedback_reply") return "respostas";
  if (item.kind === "prediction_result") return "previsoes";
  return "seguir";
}

const BUDGET_VOTE_RESULTS = { approved: "Aprovada", rejected: "Rejeitada", superseded: "Prejudicada" } as const;

/** One inbox line in words: who (in bold), what, and a short quote when there is one. */
export type NotificationText = { actor: string | null; lead: string; quote: string | null };

export function notificationText(item: Notification): NotificationText {
  const actor = item.actorName ?? "Alguém";
  switch (item.kind) {
    case "comment_reply":
      return { actor, lead: "respondeu ao teu comentário", quote: item.snippet };
    case "forum_reply":
      return { actor, lead: `respondeu-te em “${item.threadTitle ?? "uma conversa do fórum"}”`, quote: item.snippet };
    case "idea_status": {
      const status = IDEA_STATUSES.find((value) => value === item.status);
      return {
        actor: null,
        lead: `A ideia que segues, “${item.threadTitle ?? "no quadro de ideias"}”, está agora: ${status ? IDEA_STATUS_LABELS[status].label : "com um novo estado"}`,
        quote: null,
      };
    }
    case "feedback_reply":
      // The answer is the point: shown whole, here, with nowhere to go.
      return { actor: null, lead: "A equipa respondeu à tua mensagem", quote: item.feedback?.reply ?? null };
    case "thread_update":
      return {
        actor: null,
        lead: `${item.count === 1 ? "1 nova resposta" : `${item.count} novas respostas`} na conversa que segues: “${item.threadTitle ?? "no fórum"}”`,
        quote: null,
      };
    case "story_update":
      return {
        actor: null,
        lead: `A história que segues tem novidades${item.headline ? `: “${item.headline}”` : ""}`,
        quote: null,
      };
    case "prediction_result": {
      const prediction = item.prediction;
      if (!prediction) return { actor: null, lead: "Uma previsão tua foi decidida.", quote: null };
      const said = prediction.pick === "pass" ? "Passa" : "Chumba";
      const result = prediction.result ? ` foi ${prediction.result.toLowerCase()}` : " foi decidida";
      if (prediction.outcome === "void")
        return { actor: null, lead: `Sem resultado: “${prediction.initiativeTitle}” não chegou a votos. Não conta.`, quote: null };
      return {
        actor: null,
        lead: `${prediction.outcome === "hit" ? "Acertaste" : "Falhaste"}: “${prediction.initiativeTitle}”${result}. Tinhas dito “${said}”.`,
        quote: null,
      };
    }
    case "budget_vote": {
      const vote = item.budgetProposal;
      if (!vote?.title) return { actor: null, lead: "Uma proposta do Orçamento que segues foi votada", quote: null };
      const result = vote.result ? BUDGET_VOTE_RESULTS[vote.result] : "Votada";
      const where = vote.phase === "committee" ? " em comissão" : vote.phase === "plenary" ? " em plenário" : "";
      const number = vote.number ? ` (${vote.number})` : "";
      return { actor: null, lead: `${result}${where}: ${vote.title}${number}${vote.partLabel ? `, ${vote.partLabel}` : ""}`, quote: null };
    }
    default:
      return { actor: null, lead: "Novidade na tua conta", quote: item.snippet };
  }
}

/** Where a line leads: the comment, the post in the thread, the story or the initiative. */
export function notificationHref(item: Notification): string | null {
  const { link } = item;
  if (item.kind === "feedback_reply") return null;
  if (link.budgetProposalId && link.budgetYear) return `/orcamento/${link.budgetYear}/proposta/${link.budgetProposalId}`;
  const comment = link.commentId ? `#comentario-${link.commentId}` : "";
  if (item.kind === "comment_reply") {
    if (link.articleId) return `/article/${link.articleId}${comment}`;
    if (link.postSlug) return `${editorialPath(link.postSlug)}${comment}`;
    if (link.storyId) return `/historias/${link.storyId}`;
  }
  if (link.threadId && item.board === IDEAS_BOARD) return `/feedback/ideias/${link.threadId}${link.postId ? `#post-${link.postId}` : ""}`;
  if (link.threadId) {
    const thread = `/forum/${encodeURIComponent(item.board ?? "geral")}/${link.threadId}`;
    return link.postId ? `${thread}#post-${link.postId}` : thread;
  }
  if (link.storyId) return `/historias/${link.storyId}`;
  if (link.initiativeId) return `/iniciativas/${link.initiativeId}`;
  return null;
}
