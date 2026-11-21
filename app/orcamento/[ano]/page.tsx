import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BudgetYearView, loadBudgetYear } from "@/components/budget/BudgetYearView";
import type { BudgetSearch } from "@/lib/budgetFilters";
import { loadBudgets } from "@/lib/budgetPages";

type Props = { params: Promise<{ ano: string }>; searchParams: Promise<BudgetSearch> };

const requestTime = () => Date.now();

/** The reader's filters, kept across the redirect. */
function withQuery(path: string, search: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) for (const item of [value ?? []].flat()) query.append(key, item);
  return query.size > 0 ? `${path}?${query}` : path;
}

async function find(ano: string) {
  // The API down is an error page (try again), not «não encontrada».
  const budgets = await loadBudgets({ strict: true });
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
  if (year.year === budgets.current.year) redirect(withQuery("/orcamento", search));
  const now = requestTime();
  const loaded = await loadBudgetYear(year, false, search, now);
  return <BudgetYearView year={year} years={budgets.years} current={false} currentYear={budgets.current.year} loaded={loaded} now={now} />;
}
