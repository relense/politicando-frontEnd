import type { ReactNode } from "react";
import Link from "next/link";
import { formatLongDate } from "@/lib/format";
import { LEGAL_UPDATED } from "@/lib/site";

const PAGES = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/cookies", label: "Cookies" },
  { href: "/termos", label: "Termos de utilização" },
];

/** The frame shared by the privacy, cookies and terms pages: title, date of the last change, and links between them. */
export function LegalPage({ title, lead, current, children }: { title: string; lead: string; current: string; children: ReactNode }) {
  return (
    <article className="max-w-3xl pb-4">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Informação legal</p>
      <h1 className="mt-2 text-4xl font-bold leading-tight">{title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">{lead}</p>
      <p className="mt-3 font-mono text-xs text-muted">Última atualização: {formatLongDate(LEGAL_UPDATED)}</p>
      <nav aria-label="Outras páginas legais" className="mt-5 flex flex-wrap gap-2 border-b border-line pb-5">
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            aria-current={page.href === current ? "page" : undefined}
            className={`rounded-full border px-3 py-1 font-mono text-xs font-bold ${page.href === current ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"}`}
          >
            {page.label}
          </Link>
        ))}
      </nav>
      <div className="post-body mt-8">{children}</div>
    </article>
  );
}
