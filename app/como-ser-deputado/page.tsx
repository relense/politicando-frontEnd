import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CandidateLists, DhondtTable, FeaturedPaths, Replacements, SeatsByCircle } from "@/components/BecomeDeputy";
import {
  getBecomeDeputy,
  getCandidates,
  getDhondt,
  getFeaturedPeople,
  type Candidates,
  type Dhondt,
  type Explainer,
  type FeaturedPerson,
} from "@/lib/api/becomeDeputy";
import { ApiError, getParties } from "@/lib/api/client";
import { formatLongDate } from "@/lib/format";
import type { Party } from "@/lib/types";
import { FEATURES } from "@/lib/features";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Como se chega a deputado",
  description:
    "Quem pode ser deputado, como os partidos fazem as listas, como o método de Hondt reparte os lugares em cada círculo e quem entra quando alguém sai.",
  alternates: { canonical: "/como-ser-deputado" },
};

type Props = { searchParams: Promise<{ circulo?: string | string[] }> };

/** A small círculo and a big one: the contrast that explains d'Hondt. */
const PORTALEGRE = "LOCAL-120000";
const LISBOA = "LOCAL-110000";

/** Null while the API does not serve the explainer yet, so the page can say so calmly. */
async function loadExplainer(): Promise<Explainer | null> {
  try {
    return await getBecomeDeputy();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function BecomeDeputyPage({ searchParams }: Props) {
  if (!FEATURES.becomeDeputyPage) permanentRedirect("/editorial/como-se-chega-a-deputado");
  await connection();
  const [{ circulo }, explainer, parties, featured] = await Promise.all([
    searchParams,
    loadExplainer(),
    getParties().catch((): Party[] => []),
    getFeaturedPeople().catch((): FeaturedPerson[] => []),
  ]);

  const header = (
    <header className="mb-8">
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Eleições legislativas</p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{explainer?.title ?? "Como se chega a deputado"}</h1>
    </header>
  );

  if (!explainer) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Esta explicação estará disponível em breve.
        </p>
      </div>
    );
  }

  const circles = explainer.circles;
  const election = circles?.election ?? null;
  const requested = typeof circulo === "string" ? circulo : undefined;
  const circle = circles?.items.find((item) => item.key === requested)?.key ?? PORTALEGRE;
  const [dhondt, candidates] = election
    ? await Promise.all([
        getDhondt(election, circle).catch((): Dhondt | null => null),
        getCandidates(election, circle).catch((): Candidates | null => null),
      ])
    : [null, null];
  const circleName = dhondt?.place.name ?? candidates?.place.name ?? circles?.items.find((item) => item.key === circle)?.name ?? "";

  const picker = circles && (
    <div id="circulo" className="mb-4 flex scroll-mt-24 flex-wrap items-end gap-3">
      <Form action="/como-ser-deputado" scroll={false} className="flex items-end gap-2">
        <label className="block">
          <span className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Círculo</span>
          <select
            name="circulo"
            defaultValue={circle}
            className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm focus:border-ink focus:outline-none"
          >
            {[...circles.items]
              .sort((a, b) => a.name.localeCompare(b.name, "pt"))
              .map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name} ({item.seats})
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs font-bold hover:bg-surface">
          Ver
        </button>
      </Form>
      <span className="flex gap-2 font-mono text-xs">
        {[
          { key: PORTALEGRE, label: "Portalegre (pequeno)" },
          { key: LISBOA, label: "Lisboa (grande)" },
        ].map((item) => (
          <Link
            key={item.key}
            href={`/como-ser-deputado?circulo=${item.key}#circulo`}
            scroll={false}
            aria-current={item.key === circle ? "true" : undefined}
            className={`rounded-full border px-3 py-1.5 font-bold ${
              item.key === circle ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </span>
    </div>
  );

  /** What goes beside each section of the text: the real numbers behind it. */
  const extras: Record<string, ReactNode> = {
    circulos: circles && <SeatsByCircle circles={circles.items} current={circle} />,
    "listas-fechadas": (
      <>
        {picker}
        {candidates ? (
          <CandidateLists candidates={candidates} parties={parties} closest={dhondt?.firstLoser?.list} />
        ) : (
          <Unavailable>As listas de candidatos deste círculo não estão disponíveis.</Unavailable>
        )}
      </>
    ),
    dhondt: dhondt ? (
      <DhondtTable dhondt={dhondt} parties={parties} />
    ) : (
      <Unavailable>A repartição dos lugares deste círculo não está disponível.</Unavailable>
    ),
    substituicoes: candidates && <Replacements candidates={candidates} circleName={circleName} />,
  };

  return (
    <div className="mx-auto max-w-4xl">
      {header}

      <nav aria-label="Nesta página" className="mb-10 rounded-2xl border border-line p-4">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Nesta página</p>
        <ol className="grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm sm:grid-cols-2">
          {explainer.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-link underline">
                {section.title}
              </a>
            </li>
          ))}
          {featured.length > 0 && (
            <li>
              <a href="#percursos" className="text-link underline">
                Percursos reais
              </a>
            </li>
          )}
        </ol>
      </nav>

      {explainer.sections.map((section, index) => (
        <section key={section.id} aria-labelledby={section.id} className="mb-12 scroll-mt-24">
          <h2 id={section.id} className="mb-3 scroll-mt-24 text-2xl font-bold">
            <span className="mr-2 font-mono text-base text-muted">{index + 1}.</span>
            {section.title}
          </h2>
          <div className="max-w-2xl space-y-3 leading-relaxed">
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {section.sources.length > 0 && (
            <p className="mt-3 font-mono text-[11px] text-muted">
              {section.sources.length === 1 ? "Fonte: " : "Fontes: "}
              {section.sources.map((source, at) => (
                <span key={source.label}>
                  {at > 0 && "; "}
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                      {source.label}
                    </a>
                  ) : (
                    source.label
                  )}
                </span>
              ))}
            </p>
          )}
          {extras[section.id] && <div className="mt-6">{extras[section.id]}</div>}
        </section>
      ))}

      {featured.length > 0 && <FeaturedPaths people={featured} />}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        {explainer.reviewedAt && <>Texto revisto a {formatLongDate(explainer.reviewedAt)}, segundo a lei em vigor. </>}
        Listas e votos: resultados oficiais do Ministério da Administração Interna
        {election && (
          <>
            {" "}
            (
            <Link href={`/eleicoes/${election}`} className="underline hover:text-ink">
              ver os resultados
            </Link>
            )
          </>
        )}
        .
      </p>
    </div>
  );
}

function Unavailable({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</p>;
}
