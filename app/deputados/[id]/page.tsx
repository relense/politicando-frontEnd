import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { DeputyArticles, DeputyCareer, DeputyFacts, DeputyInitiatives, DeputyPortrait } from "@/components/DeputyProfile";
import { CareerPath } from "@/components/CareerPath";
import { DeputyVotes } from "@/components/DeputyVotes";
import { PartyChips } from "@/components/PartyChips";
import { RecordsBox } from "@/components/Records";
import { ApiError, getDeputy } from "@/lib/api/client";
import { tryPersonPath } from "@/lib/api/people";
import { partyColor } from "@/lib/parliament";
import { FEATURES } from "@/lib/features";

type Props = { params: Promise<{ id: string }> };

/** One request per page, shared by the metadata and the page. Null when there is no such deputy. */
const loadDeputy = cache(async (id: string) => {
  if (!/^\d+$/.test(id)) return null;
  try {
    return await getDeputy(Number(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const deputy = await loadDeputy((await params).id);
  if (!deputy) return { title: "Deputado não encontrado" };
  const party = deputy.party ? ` (${deputy.party.acronym})` : "";
  return {
    title: `${deputy.name}${party}`,
    description: `${deputy.name}, deputado${party} eleito por ${deputy.constituency}: iniciativas, comissões e notícias.`,
    alternates: { canonical: `/deputados/${deputy.id}` },
  };
}

export default async function DeputyPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const [deputy, path] = await Promise.all([loadDeputy(id), /^\d+$/.test(id) ? tryPersonPath("deputy", id) : null]);
  if (!deputy) notFound();

  return (
    <article className="pb-4">
      <Link
        href={deputy.partySlug ? `/deputados?partido=${deputy.partySlug}` : "/deputados"}
        className="mb-6 inline-block font-mono text-sm text-muted hover:text-ink hover:underline"
      >
        ← {deputy.party ? `Deputados do ${deputy.party.acronym}` : "Deputados"}
      </Link>

      <header className="rounded-2xl border border-t-4 border-line p-6" style={{ borderTopColor: partyColor(deputy.partySlug ?? "") }}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <DeputyPortrait deputy={deputy} size="lg" />
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight">{deputy.name}</h1>
            {deputy.fullName !== deputy.name && <p className="text-muted">{deputy.fullName}</p>}
            {deputy.party && <PartyChips parties={[deputy.party]} className="mt-2" />}
          </div>
        </div>
        <DeputyFacts summary={deputy} detail={deputy} />
        <dl className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center">
          <Stat value={deputy.initiatives.total} label="iniciativas assinadas" />
          <Stat value={deputy.initiatives.approved} label="aprovadas" />
          <Stat value={deputy.articles.length} label="notícias recentes" />
        </dl>
        <Link href={`/parlamento?deputado=${deputy.id}`} className="mt-5 inline-block font-mono text-sm text-link underline">
          Ver no hemiciclo
        </Link>
      </header>

      {FEATURES.record && path && <RecordsBox records={path.records} kind="deputy" id={deputy.id} />}

      <Section title="Iniciativas que assina">
        <DeputyInitiatives detail={deputy} />
      </Section>
      <Section title="Votações" id="votacoes">
        <DeputyVotes deputyId={deputy.id} group={deputy.party?.acronym ?? deputy.group} />
      </Section>
      <Section title="Nas notícias">
        <DeputyArticles detail={deputy} />
      </Section>
      {path && (path.path.length > 0 || path.currentRoles.length > 0) ? (
        <>
          <Section title="Percurso" id="percurso">
            <CareerPath path={path} here="deputy" />
          </Section>
          <Section title="Comissões e formação">
            <DeputyCareer detail={deputy} />
          </Section>
        </>
      ) : (
        <Section title="Percurso">
          <DeputyCareer detail={deputy} />
        </Section>
      )}

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">Fonte: Assembleia da República (dados abertos).</p>
    </article>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse px-1">
      <dt className="font-mono text-[11px] leading-tight text-muted">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </div>
  );
}
