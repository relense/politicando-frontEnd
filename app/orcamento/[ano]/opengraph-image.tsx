import { budgetOgCard } from "@/lib/budgetOg";
import { loadBudgets } from "@/lib/budgetPages";
import { OG_SIZE, OG_TYPE } from "@/lib/ogCard";

export const alt = "Orçamento do Estado: como vota cada partido, no Politicando";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
/** Drawn once per year and kept for a day: crawlers (Threads, X, WhatsApp) give up after a few seconds. */
export const revalidate = 86400;
export const generateStaticParams = async () => [];

export default async function Image({ params }: { params: Promise<{ ano: string }> }) {
  const { ano } = await params;
  const budgets = await loadBudgets();
  return budgetOgCard(budgets?.years.find((item) => String(item.year) === ano) ?? null);
}
