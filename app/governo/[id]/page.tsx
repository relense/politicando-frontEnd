import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { CareerPath } from "@/components/CareerPath";
import { GovernmentPortrait } from "@/components/GovernmentPortrait";
import { OriginBadge } from "@/components/OrgansExplainer";
import { RecordsBox } from "@/components/Records";
import { ApiError, getGovernmentMember } from "@/lib/api/client";
import { tryPersonPath } from "@/lib/api/people";
import { formatDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { FEATURES } from "@/lib/features";

type Props = { params: Promise<{ id: string }> };

/** One request per page, shared by the metadata and the page. Null when there is no such member. */
const loadMember = cache(async (id: string) => {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  try {
    return await getGovernmentMember(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const member = await loadMember((await params).id);
  if (!member) return { title: "Membro do Governo não encontrado" };
  const title = member.positions[0]?.title;
  return {
    title: member.name,
    description: `${member.name}${title ? `, ${title}` : ""}: percurso, cargos e notícias.`,
    alternates: { canonical: `/governo/${member.id}` },
  };
}

export default async function GovernmentMemberPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const [member, path] = await Promise.all([loadMember(id), /^[0-9a-f]{32}$/.test(id) ? tryPersonPath("government", id) : null]);
  if (!member) notFound();
  const current = member.positions.find((position) => !position.endDate) ?? member.positions[0];
  const female = member.gender === "F";

  return (
    <article className="pb-4">
      <Link href="/governo" className="mb-6 inline-block font-mono text-sm text-muted hover:text-ink hover:underline">
        ← Governo
      </Link>

      <header className="rounded-2xl border border-t-4 border-line border-t-ink p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <GovernmentPortrait name={member.name} photoUrl={member.photoUrl} size="lg" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
              <OriginBadge origin="government" />
              {member.inOffice
                ? "Em funções"
                : `Já não está no Governo${current?.endDate ? ` (saiu a ${formatDate(current.endDate)})` : ""}`}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">{member.name}</h1>
            {current && <p className="text-muted">{current.title}</p>}
          </div>
        </div>
        {member.deputy && (
          <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3 text-sm">
            {member.deputy.partySlug && (
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: partyColor(member.deputy.partySlug) }} />
            )}
            <span>
              {female ? "Foi eleita deputada" : "Foi eleito deputado"} nesta legislatura e suspendeu o mandato para entrar no Governo.
            </span>
            <Link href={`/deputados/${member.deputy.id}`} className="font-mono text-link underline">
              Ver ficha de deputado
            </Link>
          </p>
        )}
        {member.links.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
            {member.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                  {link.network} ↗<span className="sr-only"> (abre num novo separador)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      {FEATURES.record && path && <RecordsBox records={path.records} kind="government" id={member.id} />}

      {member.bio.length > 0 && (
        <Section title="Biografia">
          <div className="max-w-3xl space-y-3 leading-relaxed">
            {member.bio.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-3 font-mono text-xs text-muted">Texto oficial do portal do Governo.</p>
        </Section>
      )}

      {member.positions.length > 0 && (
        <Section title="Cargos no Governo">
          <ul className="divide-y divide-line">
            {member.positions.map((position) => (
              <li key={`${position.title}-${position.startDate}`} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                <span className="font-bold">
                  {position.url ? (
                    <a href={position.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {position.title}
                      <span className="sr-only"> (abre num novo separador)</span>
                    </a>
                  ) : (
                    position.title
                  )}
                </span>
                <span className="font-mono text-xs text-muted">
                  {formatDate(position.startDate)} – {position.endDate ? formatDate(position.endDate) : "atualidade"}
                  {position.government && ` · ${position.government.toUpperCase()}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {path && (path.path.length > 0 || path.currentRoles.length > 0 || path.otherRoles.length > 0) && (
        <Section title="Percurso" id="percurso">
          <CareerPath path={path} here="government" />
        </Section>
      )}

      <Section title="Nas notícias">
        {member.articles.length === 0 ? (
          <p className="text-sm text-muted">Sem notícias recentes com o nome completo.</p>
        ) : (
          <ul className="divide-y divide-line">
            {member.articles.map((article) => (
              <li key={article.id} className="py-3">
                <p className="font-mono text-xs text-muted">
                  {article.source} · {formatDate(article.publishedAt)}
                </p>
                <Link href={`/article/${article.id}`} className="font-bold leading-snug hover:underline">
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 font-mono text-xs text-muted">
          Só contam as notícias que usam o nome completo, por isso podem faltar algumas (por exemplo, as que dizem só o apelido ou o cargo).
        </p>
      </Section>

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">Fonte: portal do Governo (portugal.gov.pt).</p>
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
