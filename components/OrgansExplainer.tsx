import Link from "next/link";
import type { ReactNode } from "react";
import type { Initiative } from "@/lib/types";

const PARLIAMENT_ICON = "M2 15a8 8 0 0 1 16 0M5.5 15a4.5 4.5 0 0 1 9 0M2 15h16";
const GOVERNMENT_ICON = "M3 8l7-4 7 4M4 8v7M8 8v7M12 8v7M16 8v7M2 17h16";

function Icon({ path, className = "size-5" }: { path: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * Many people mix up the Parliament and the Government. Both look the same in the news, so this sets them side
 * by side: who they are, how they get there and what each one does.
 */
export function OrgansExplainer() {
  return (
    <section aria-labelledby="orgaos-titulo" className="mt-12 rounded-2xl border border-line p-5 sm:p-6">
      <h2 id="orgaos-titulo" className="text-xl font-bold">
        Parlamento ou Governo? São coisas diferentes
      </h2>
      <p className="mt-1 text-sm text-muted">Aparecem juntos nas notícias, mas são órgãos distintos, com pessoas e funções diferentes.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Organ
          icon={PARLIAMENT_ICON}
          badge={<OriginBadge origin="parliament" />}
          title="Assembleia da República"
          link={{ href: "/deputados", label: "Ver os 230 deputados →" }}
          points={[
            "230 deputados, eleitos diretamente nas eleições legislativas.",
            "Faz e aprova as leis e o Orçamento do Estado.",
            "Fiscaliza o Governo e pode fazê-lo cair, com uma moção de censura ou rejeitando uma moção de confiança.",
            "É o que vês nesta página: os lugares, os deputados e as iniciativas.",
          ]}
        />
        <Organ
          icon={GOVERNMENT_ICON}
          badge={<OriginBadge origin="government" />}
          title="Governo"
          link={{ href: "/governo", label: "Ver quem está no Governo →" }}
          points={[
            "O Primeiro-Ministro, os ministros e os secretários de Estado.",
            "O Primeiro-Ministro não é eleito diretamente: é nomeado pelo Presidente da República, tendo em conta os resultados das eleições.",
            "Governa o país e põe as leis em prática.",
            "Propõe leis e o Orçamento ao Parlamento, e responde perante ele.",
          ]}
        />
      </div>

      {/* Same two columns as the cards above, so each term sits under its organ. */}
      <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
        <div className="px-4">
          <dt className="flex items-center gap-2 font-bold">
            <OriginBadge origin="parliament" linked /> Projeto de Lei
          </dt>
          <dd className="mt-1.5 text-muted">Proposta de deputados ou partidos no Parlamento.</dd>
        </div>
        <div className="px-4">
          <dt className="flex items-center gap-2 font-bold">
            <OriginBadge origin="government" linked /> Proposta de Lei
          </dt>
          <dd className="mt-1.5 text-muted">Proposta do Governo (ou de uma assembleia regional dos Açores ou da Madeira).</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-line px-4 pt-4 text-sm text-muted">
        Um deputado que vai para o Governo suspende o mandato e é substituído no Parlamento pelo seguinte da sua lista.
      </p>
    </section>
  );
}

function Organ({
  icon,
  badge,
  title,
  points,
  link,
}: {
  icon: string;
  badge: ReactNode;
  title: string;
  points: string[];
  link: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <Icon path={icon} />
          {title}
        </h3>
        {/* A mouse shortcut to the same page as the link below, so it isn't a second tab stop. */}
        <Link href={link.href} tabIndex={-1} aria-hidden="true" title={link.label.replace(/\s*→$/, "")} className={BADGE_LINK}>
          {badge}
        </Link>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            {point}
          </li>
        ))}
      </ul>
      <Link href={link.href} className="mt-3 inline-block font-mono text-sm text-link underline">
        {link.label}
      </Link>
    </div>
  );
}

export type Origin = "parliament" | "government" | "other";

/** Where an initiative comes from, judged from its authors as the Parliament records them. */
export function originOf(initiative: Pick<Initiative, "authors">): Origin {
  const { other, deputies, parties } = initiative.authors;
  if (other && /governo/i.test(other)) return "government";
  if (deputies.length > 0 || parties.length > 0) return "parliament";
  return other ? "other" : "parliament";
}

const ORIGIN_PAGES = {
  government: { href: "/governo", title: "Ver quem está no Governo" },
  parliament: { href: "/deputados", title: "Ver os deputados" },
} as const;

/**
 * A small label, used the same way everywhere, so the Government never reads as one more party. With `linked`
 * it opens the organ's page: the Government's members, or the deputies.
 */
export function OriginBadge({ origin, label, linked = false }: { origin: Origin; label?: string; linked?: boolean }) {
  const government = origin === "government";
  const badge = (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
        government ? "bg-ink text-paper" : "border border-line text-ink"
      }`}
    >
      {origin !== "other" && <Icon path={government ? GOVERNMENT_ICON : PARLIAMENT_ICON} className="size-3.5" />}
      {government ? "Governo" : origin === "parliament" ? "Parlamento" : (label ?? "Outra origem")}
    </span>
  );
  if (!linked || origin === "other") return badge;
  const page = ORIGIN_PAGES[origin];
  return (
    <Link href={page.href} title={page.title} className={BADGE_LINK}>
      {badge}
      <span className="sr-only">: {page.title}</span>
    </Link>
  );
}

const BADGE_LINK = "inline-flex shrink-0 rounded-full transition hover:opacity-80 hover:ring-2 hover:ring-link";
