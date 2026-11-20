import { budgetOgCard } from "@/lib/budgetOg";
import { loadBudgets } from "@/lib/budgetPages";
import { OG_SIZE, OG_TYPE } from "@/lib/ogCard";

export const alt = "Orçamento do Estado: como vota cada partido, no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;

export default async function Image() {
  const budgets = await loadBudgets();
  return budgetOgCard(budgets?.current ?? null);
}
