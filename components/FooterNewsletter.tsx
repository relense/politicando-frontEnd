"use client";

import { usePathname } from "next/navigation";
import { NewsletterForm } from "./NewsletterForm";

/**
 * The footer's morning-email strip: not on the newsletter page, which is that form already, nor in the team's
 * moderation area.
 */
export function FooterNewsletter() {
  const path = usePathname();
  if (path.startsWith("/newsletter") || path.startsWith("/admin")) return null;
  return (
    <section
      aria-labelledby="rodape-resumo"
      className="grid items-center gap-5 border-b border-line bg-[var(--accent-soft)] px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
    >
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Resumo da manhã</p>
        <h2 id="rodape-resumo" className="mt-1.5 text-2xl font-bold leading-tight">
          A política do dia, em 5 notícias, às 8h.
        </h2>
        <p className="mt-1 text-sm text-muted">Um email por dia útil. Cancelas com um clique.</p>
      </div>
      <NewsletterForm band />
    </section>
  );
}
