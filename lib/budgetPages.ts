import { getBudgets, type BudgetYear } from "@/lib/api/budget";

/** The Budgets we have and which is current: the newest with amendment proposals (the one being, or last, voted). */
/** The years and the current one; null without any. `strict`: the API failing throws, so a year's page doesn't read as missing. */
export async function loadBudgets({ strict = false } = {}): Promise<{ years: BudgetYear[]; current: BudgetYear } | null> {
  const budgets = await getBudgets().catch((error: unknown) => {
    if (strict) throw error;
    return null;
  });
  const years = budgets?.items ?? [];
  const current = years.find((item) => item.proposals > 0) ?? years[0];
  return current ? { years, current } : null;
}
