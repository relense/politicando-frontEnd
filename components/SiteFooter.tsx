import Link from "next/link";
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Explorar",
    links: [
      { href: "/", label: "Notícias" },
      { href: "/parlamento", label: "Parlamento" },
      { href: "/governo", label: "Governo" },
      { href: "/eleicoes", label: "Eleições" },
    ],
  },
  {
    title: "Ler mais",
    links: [
      { href: "/editorial", label: "Blog" },
      { href: "/newsletter", label: "Newsletter" },
      { href: "/historia", label: "História" },
      { href: "/como-ser-deputado", label: "Como se chega a deputado" },
    ],
  },
  {
    title: "Informação legal",
    links: [
      { href: "/privacidade", label: "Privacidade" },
      { href: "/cookies", label: "Cookies" },
      { href: "/termos", label: "Termos de utilização" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto grid w-full max-w-[96rem] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="max-w-sm">
          <p className="font-mono text-lg font-bold tracking-[0.3em]">{SITE_NAME.toUpperCase()}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{SITE_DESCRIPTION}</p>
          <p className="mt-3 text-sm">
            Erros ou pedidos de correção:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-link underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted">{column.title}</p>
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
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-[96rem] px-4 py-4 font-mono text-[11px] leading-relaxed text-muted">
          © {SITE_NAME} · Dados de fontes oficiais e da imprensa, com a fonte indicada em cada página · Sem cookies de publicidade nem de
          seguimento.
        </p>
      </div>
    </footer>
  );
}
