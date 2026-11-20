import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BudgetYearView, loadBudgetYear } from "@/components/budget/BudgetYearView";
import type { BudgetSearch } from "@/lib/budgetFilters";
import { loadBudgets } from "@/lib/budgetPages";

type Props = { params: Promise<{ ano: string }>; searchParams: Promise<BudgetSearch> };

const requestTime = () => Date.now();

async function find(ano: string) {
  const budgets = await loadBudgets();
  const year = /^\d{4}$/.test(ano) ? budgets?.years.find((item) => item.year === Number(ano)) : undefined;
  return budgets && year ? { budgets, year } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await find((await params).ano);
  if (!found) return { title: "Orçamento do Estado" };
  return {
    title: `Orçamento do Estado ${found.year.year}: como votou cada partido`,
    description: `A votação do Orçamento do Estado para ${found.year.year} e, quando a fonte oficial as tem, cada proposta de alteração com o voto de cada partido.`,
    alternates: { canonical: `/orcamento/${found.year.year}` },
  };
}

export default async function BudgetYearPage({ params, searchParams }: Props) {
  await connection();
  const [{ ano }, search] = await Promise.all([params, searchParams]);
  const found = await find(ano);
  if (!found) notFound();
  const { budgets, year } = found;
  // The current Budget lives at /orcamento.
  if (year.year === budgets.current.year) redirect("/orcamento");
  const now = requestTime();
  const loaded = await loadBudgetYear(year, false, search, now);
  return <BudgetYearView year={year} years={budgets.years} current={false} currentYear={budgets.current.year} loaded={loaded} now={now} />;
}
