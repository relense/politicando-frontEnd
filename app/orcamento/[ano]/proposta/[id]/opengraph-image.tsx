import { getBudgetProposal } from "@/lib/api/budget";
import { authorsPhrase, RESULT_LABELS } from "@/lib/budget";
import { budgetOgCard } from "@/lib/budgetOg";
import { ogCard, OG_SIZE, OG_TYPE } from "@/lib/ogCard";
import { partyColor } from "@/lib/parliament";

export const alt = "Proposta de alteração ao Orçamento do Estado, no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per proposal and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

export default async function Image({ params }: { params: Promise<{ ano: string; id: string }> }) {
  const { ano, id } = await params;
  const proposal = /^\d{4}$/.test(ano) && /^\d{1,9}$/.test(id) ? await getBudgetProposal(Number(ano), Number(id)).catch(() => null) : null;
  if (!proposal) return budgetOgCard(null);
  const by = authorsPhrase(proposal.authors);
  return ogCard({
    kicker: `Orçamento ${proposal.year} · proposta n.º ${proposal.number}`,
    title: proposal.title,
    subtitle: `${RESULT_LABELS[proposal.result]}${by ? ` · proposta ${by}` : ""}`,
    color: proposal.authors.parties[0] ? partyColor(proposal.authors.parties[0].slug) : undefined,
  });
}
