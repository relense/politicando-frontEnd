import type { BudgetYear } from "@/lib/api/budget";
import { ogCard } from "@/lib/ogCard";

/** The State Budget's share image: «Orçamento 2027 · como vota cada partido». Without data, the same without the year. */
export function budgetOgCard(year: BudgetYear | null) {
  if (!year) {
    return ogCard({ kicker: "Orçamento do Estado", title: "Como vota cada partido no Orçamento", subtitle: null });
  }
  return year.proposals > 0
    ? ogCard({
        kicker: "Orçamento do Estado",
        title: `Orçamento ${year.year} · como vota cada partido`,
        subtitle: "Cada proposta de alteração, quem a propôs e o voto de cada partido",
      })
    : ogCard({
        kicker: "Orçamento do Estado",
        title: `Orçamento do Estado ${year.year}`,
        subtitle: "As votações da proposta de lei no Parlamento",
      });
}
