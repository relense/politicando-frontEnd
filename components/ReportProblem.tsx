"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_SECTIONS } from "./SiteNav";

/** The section a page belongs to, named as the feedback form lists it. */
function sectionOf(path: string): string | null {
  if (path.startsWith("/deputados/")) return "Página de um deputado";
  if (path.startsWith("/legislaturas")) return "Legislaturas";
  return SITE_SECTIONS.find((item) => item.href && item.href !== "/feedback" && item.active(path))?.label ?? null;
}

/** "Found an error on this page?": opens the feedback form with the page already filled in. */
export function ReportProblem({ className = "mt-3 text-sm" }: { className?: string }) {
  const path = usePathname();
  if (path.startsWith("/feedback")) return null;
  const params = new URLSearchParams({ ligacao: path });
  const section = sectionOf(path);
  if (section) params.set("pagina", section);
  return (
    <p className={className}>
      Encontraste um erro nesta página?{" "}
      <Link href={`/feedback?${params}`} className="whitespace-nowrap font-bold text-link underline">
        Diz-nos →
      </Link>
    </p>
  );
}
