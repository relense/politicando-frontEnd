import type { Metadata } from "next";
import { connection } from "next/server";
import { BudgetYearView, loadBudgetYear } from "@/components/budget/BudgetYearView";
import type { BudgetSearch } from "@/lib/budgetFilters";
import { loadBudgets } from "@/lib/budgetPages";

type Props = { searchParams: Promise<BudgetSearch> };

const requestTime = () => Date.now();

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const [budgets, search] = await Promise.all([loadBudgets(), searchParams]);
  const year = budgets?.current.year;
  return {
    title: year ? `Orçamento do Estado ${year}: como vota cada partido` : "Orçamento do Estado",
    description:
      "Cada proposta de alteração ao Orçamento do Estado e como votou cada partido: as votações de hoje, as que faltam e os orçamentos anteriores.",
    // Filters are the same list again: point to the page itself, and keep searches out of the index.
    alternates: { canonical: "/orcamento" },
    robots: typeof search.q === "string" && search.q.trim() ? { index: false, follow: true } : undefined,
  };
}

export default async function BudgetPage({ searchParams }: Props) {
  await connection();
  const [budgets, search] = await Promise.all([loadBudgets(), searchParams]);
  if (!budgets) {
    return (
      <div data-wide>
        <h1 className="font-serif text-3xl font-bold">Orçamento do Estado</h1>
        <p className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Em breve: cada proposta de alteração ao Orçamento e como votou cada partido.
        </p>
      </div>
    );
  }
  const now = requestTime();
  const loaded = await loadBudgetYear(budgets.current, true, search, now);
  return (
    <BudgetYearView year={budgets.current} years={budgets.years} current currentYear={budgets.current.year} loaded={loaded} now={now} />
  );
}
