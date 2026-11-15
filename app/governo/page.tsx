import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { GovernmentPortrait } from "@/components/GovernmentPortrait";
import { GovernmentView, PartyTag } from "@/components/GovernmentView";
import { OriginBadge } from "@/components/OrgansExplainer";
import { ApiError, getGovernment, getParties } from "@/lib/api/client";
import { formatDate, formatLongDate } from "@/lib/format";
import type { Government, GovernmentMember, Party } from "@/lib/types";

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
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

type Props = { searchParams: Promise<{ membro?: string | string[] }> };

export default async function GovernmentPage({ searchParams }: Props) {
  await connection();
  const [government, parties, { membro }] = await Promise.all([loadGovernment(), getParties().catch((): Party[] => []), searchParams]);
  const partyOf = (slug: string | null) => (slug ? (parties.find((party) => party.slug === slug) ?? null) : null);

  const header = (
    <header className="mb-3">
      <p className="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        <OriginBadge origin="government" />
        {government?.name}
      </p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Quem governa</h1>
      <p className="mt-3 max-w-2xl text-muted">
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
          {/* The title sits in the table's column, so the card beside it can run from the title down. */}
          <GovernmentView
            government={government}
            parties={parties}
            initialMember={typeof membro === "string" ? membro : null}
            header={header}
          />

          <h2 className="mb-4 mt-12 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
            Todos os ministérios <span className="font-normal normal-case tracking-normal text-muted">· por ordem protocolar</span>
          </h2>
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {government.ministries
              .filter((ministry) => ministry.minister?.kind !== "prime_minister" || ministry.secretaries.length > 0)
              .map((ministry) => (
                <li key={ministry.area} className="rounded-2xl border border-line p-4">
                  <p className="font-mono text-xs uppercase tracking-wider text-muted">{ministry.name}</p>
                  {ministry.minister && ministry.minister.kind !== "prime_minister" ? (
                    <MemberRow member={ministry.minister} party={partyOf(ministry.minister.partySlug)} size="md" />
                  ) : ministry.minister ? null : (
                    <p className="mt-2 text-sm text-muted">Sem ministro em funções.</p>
                  )}
                  {ministry.secretaries.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-line pt-3">
                      {ministry.secretaries.map((secretary) => (
                        <li key={secretary.id}>
                          <MemberRow member={secretary} party={partyOf(secretary.partySlug)} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
          </ul>

          {government.former.length > 0 && (
            <section className="mt-10">
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
        {government?.updatedAt && ` · atualizado em ${formatDate(government.updatedAt)}`}. O partido só aparece quando a pessoa foi eleita
        deputada; o portal não o publica e muitos membros são independentes.
      </p>
    </div>
  );
}

function MemberRow({ member, party, size }: { member: GovernmentMember; party: Party | null; size: "sm" | "md" }) {
  return (
    <Link href={`/governo/${member.id}`} className="-mx-2 mt-2 flex items-center gap-3 rounded-lg p-2 hover:bg-surface">
      <GovernmentPortrait name={member.name} photoUrl={member.photoUrl} size={size} />
      <span className="min-w-0">
        <span className={`block font-bold leading-snug ${size === "md" ? "text-lg" : "text-sm"}`}>{member.name}</span>
        <span className="block text-xs text-muted">{member.title}</span>
        {party && <PartyTag party={party} gender={member.gender} />}
      </span>
    </Link>
  );
}
