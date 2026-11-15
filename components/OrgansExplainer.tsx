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
          points={[
            "O Primeiro-Ministro, os ministros e os secretários de Estado.",
            "O Primeiro-Ministro não é eleito diretamente: é nomeado pelo Presidente da República, tendo em conta os resultados das eleições.",
            "Governa o país e põe as leis em prática.",
            "Propõe leis e o Orçamento ao Parlamento, e responde perante ele.",
          ]}
        />
      </div>

      <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold">Projeto de Lei</dt>
          <dd className="text-muted">Proposta de deputados ou partidos no Parlamento.</dd>
        </div>
        <div>
          <dt className="font-bold">Proposta de Lei</dt>
          <dd className="text-muted">Proposta do Governo (ou de uma assembleia regional dos Açores ou da Madeira).</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">
        Um deputado que vai para o Governo suspende o mandato e é substituído no Parlamento pelo seguinte da sua lista.
      </p>
    </section>
  );
}

function Organ({ icon, badge, title, points }: { icon: string; badge: ReactNode; title: string; points: string[] }) {
  return (
    <div className="rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <Icon path={icon} />
          {title}
        </h3>
        {badge}
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

/** A small label, used the same way everywhere, so the Government never reads as one more party. */
export function OriginBadge({ origin, label }: { origin: Origin; label?: string }) {
  if (origin === "government") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-paper">
        <Icon path={GOVERNMENT_ICON} className="size-3.5" />
        Governo
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
      {origin === "parliament" && <Icon path={PARLIAMENT_ICON} className="size-3.5" />}
      {origin === "parliament" ? "Parlamento" : (label ?? "Outra origem")}
    </span>
  );
}
