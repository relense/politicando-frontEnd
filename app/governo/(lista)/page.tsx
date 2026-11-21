import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { GovernmentView } from "@/components/GovernmentView";
import { OriginBadge } from "@/components/OrgansExplainer";
import { ApiError, getGovernment, getParties } from "@/lib/api/client";
import { formatDate, formatLongDate } from "@/lib/format";
import type { Government, Party } from "@/lib/types";

export const metadata: Metadata = {
  title: "Governo",
  description:
    "Quem governa Portugal: o Primeiro-Ministro, os ministros e os secretários de Estado, com o percurso e as notícias de cada um.",
  alternates: { canonical: "/governo" },
};

/** Null while the API does not serve the Government yet, so the page can say so calmly. */
async function loadGovernment(): Promise<Government | null> {
  try {
    return await getGovernment();
  } catch (error) {
    // Not served yet (404) or the API down: the page's calm state, never the error page.
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/** Today in Lisbon, as YYYY-MM-DD; the page is rendered per request (connection()). */
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });

type Props = { searchParams: Promise<{ membro?: string | string[] }> };

export default async function GovernmentPage({ searchParams }: Props) {
  await connection();
  const [government, parties, { membro }] = await Promise.all([loadGovernment(), getParties().catch((): Party[] => []), searchParams]);

  const header = (
    <header key="header" className="mb-6">
      <p className="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        <OriginBadge origin="government" />
        {government?.name}
      </p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
        Quem <span className="bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1">governa</span>
      </h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        {government?.startDate && `Em funções desde ${formatLongDate(government.startDate)}. `}O Governo não é o Parlamento: é nomeado, não
        é eleito, e quem vem do Parlamento suspende o mandato de deputado.{" "}
        <Link href="/parlamento#orgaos-titulo" className="text-link underline">
          Qual é a diferença?
        </Link>
      </p>
    </header>
  );

  return (
    // data-wide lets this page use the full width, like the Parliament page.
    <div data-wide>
      {!government ? (
        <>
          {header}
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            Os dados do Governo estarão disponíveis em breve.
          </p>
        </>
      ) : (
        <>
          {/* The title spans the page; the card beside the ministries starts below it. */}
          {header}
          <GovernmentView
            government={government}
            parties={parties}
            initialMember={typeof membro === "string" ? membro : null}
            today={today()}
          />

          {government.former.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
                Saíram deste Governo
              </h2>
              <ul className="divide-y divide-line">
                {government.former.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                    <Link href={`/governo/${member.id}`} className="font-bold hover:underline">
                      {member.name}
                    </Link>
                    <span className="text-sm text-muted">
                      {member.title}
                      {member.endDate && ` · até ${formatDate(member.endDate)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Fonte: portal do Governo (portugal.gov.pt)
        {government?.updatedAt && ` · atualizado em ${formatDate(government.updatedAt)}`}. O portal não publica o partido: mostramos o
        partido por que a pessoa foi eleita deputada, ou a filiação quando é pública. Sem fonte, não mostramos nenhum.
      </p>
    </div>
  );
}
