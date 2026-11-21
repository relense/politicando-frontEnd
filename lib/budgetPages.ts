import { getBudgets, type BudgetYear } from "@/lib/api/budget";
import { ApiError } from "@/lib/api/client";

/**
 * The Budgets we have and which is current: the newest with amendment proposals (the one being, or last, voted); null
 * without any. `strict`: the API failing (other than not serving Budgets, 404) throws, so a year's page doesn't read as missing.
 */
export async function loadBudgets({ strict = false } = {}): Promise<{ years: BudgetYear[]; current: BudgetYear } | null> {
  const budgets = await getBudgets().catch((error: unknown) => {
    if (strict && !(error instanceof ApiError && error.status === 404)) throw error;
    return null;
  });
  const years = budgets?.items ?? [];
  const current = years.find((item) => item.proposals > 0) ?? years[0];
  return current ? { years, current } : null;
}
