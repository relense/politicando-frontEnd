import Link from "next/link";
import { FooterNewsletter } from "./FooterNewsletter";
import { ReportProblem } from "./ReportProblem";
import { SocialLinks } from "./SocialLinks";
import { CONTACT_EMAIL, SITE_DESCRIPTION } from "@/lib/site";
import { Wordmark } from "./Wordmark";

type Column = { title: string; links: { href: string; label: string }[] };

/** The footer's links, by the same groups as the sections menu. Two short groups share the third column. */
const COLUMNS: Column[][] = [
  [
    {
      title: "Quem manda",
      links: [
        { href: "/presidente", label: "Presidente" },
        { href: "/governo", label: "Governo" },
        { href: "/parlamento", label: "Parlamento" },
        { href: "/partidos", label: "Partidos" },
        { href: "/iniciativas", label: "Iniciativas" },
      ],
    },
  ],
  [
    {
      title: "Território e dinheiro",
      links: [
        { href: "/eleicoes", label: "Eleições" },
        { href: "/sitios", label: "Autarquias" },
        { href: "/contratos", label: "Contratos" },
      ],
    },
    {
      title: "Saber mais",
      links: [
        { href: "/editorial", label: "Blog" },
        { href: "/historia", label: "História" },
        { href: "/percursos", label: "Percursos" },
        { href: "/como-ser-deputado", label: "Como se chega a deputado" },
      ],
    },
  ],
  [
    {
      title: "Politicando",
      links: [
        { href: "/sobre", label: "Sobre nós" },
        { href: "/sobre#fontes", label: "Fontes e método" },
        { href: "/feedback/correcoes", label: "Registo de correções" },
        { href: "/feedback", label: "Feedback" },
      ],
    },
  ],
];

export const LEGAL_LINKS = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/cookies", label: "Cookies" },
  { href: "/termos", label: "Termos" },
];

const heading = "mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted";


/**
 * The end of pages that have one (articles, Parliament, contracts…): the morning email first, then the site's map, our
 * profiles, how to report an error, and the legal line. The endless feeds put the profiles in the side column instead.
 */
export function SiteFooter() {
  return (
    <footer data-site-footer className="mx-auto mt-12 w-full max-w-[96rem] px-4 pb-8">
      <div className="overflow-hidden rounded-2xl border border-line">
        <FooterNewsletter />

        <div className="grid gap-8 px-5 py-8 sm:grid-cols-2 sm:px-7 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-sm">
            <p className="text-base">
              <Wordmark />
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{SITE_DESCRIPTION}</p>
            <p className={`${heading} mt-6`}>Segue-nos</p>
            <SocialLinks />
          </div>
          {COLUMNS.map((groups, index) => (
            <div key={index} className="flex flex-col gap-6">
              {groups.map((column) => (
                <nav key={column.title} aria-label={column.title}>
                  <p className={heading}>{column.title}</p>
                  <ul className="space-y-1.5 text-sm">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className="hover:underline">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
              {index === COLUMNS.length - 1 && <ReportProblem className="rounded-xl border border-line px-4 py-3 text-sm" />}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-4 font-mono text-[11px] text-muted sm:px-7">
          <p>© {new Date().getFullYear()} Politicando · independente, sem ligação a partidos</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ink">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
          <a href="#" className="ml-auto font-bold text-ink hover:underline">
            Voltar ao topo <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
