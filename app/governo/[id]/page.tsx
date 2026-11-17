import type { Metadata } from "next";
import Link from "next/link";
import { ScrollToTop } from "@/components/ScrollToTop";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { CareerPath } from "@/components/CareerPath";
import { GovernmentPortrait } from "@/components/GovernmentPortrait";
import { RecordsBox } from "@/components/Records";
import { ArticleActions } from "@/components/ArticleActions";
import { PartyLogo } from "@/components/PartyLogo";
import { ApiError, getGovernment, getGovernmentMember, getParties } from "@/lib/api/client";
import { tryPersonPath } from "@/lib/api/people";
import { formatDate, formatLongDate } from "@/lib/format";
import { tidyName } from "@/lib/elections";
import { partyColor } from "@/lib/parliament";
import { FEATURES } from "@/lib/features";
import type { Government, GovernmentMember, GovernmentMemberKind } from "@/lib/types";
import { breadcrumbs, jsonLd, personLd } from "@/lib/seo";

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

/** "Chefe do Governo", "Ministra", "Secretário de Estado": what the role is, in a word or two. */
function roleOf(kind: GovernmentMemberKind, female: boolean) {
  if (kind === "prime_minister") return "Chefe do Governo";
  if (kind === "minister") return female ? "Ministra" : "Ministro";
  return female ? "Secretária de Estado" : "Secretário de Estado";
}

type TeamGroup = { label: string; people: GovernmentMember[] };

/**
 * The people this member works with in the Government in office: the Prime Minister's ministers, a minister's
 * secretaries of state, a secretary of state's minister and colleagues. Empty for someone no longer in it.
 */
function teamOf(id: string, government: Government | null): { team: TeamGroup[]; teamNote: string | null } {
  if (!government) return { team: [], teamNote: null };
  const pm = government.primeMinister;
  if (pm?.id === id) {
    const ministers = government.ministries.flatMap((ministry) => (ministry.minister ? [ministry.minister] : []));
    return {
      team: [{ label: "Os ministros", people: ministers }],
      teamNote: "Quem chefia cada ministério e responde ao Primeiro-Ministro.",
    };
  }
  const own = government.ministries.find((ministry) => ministry.minister?.id === id);
  if (own) {
    const team: TeamGroup[] = [];
    if (own.secretaries.length > 0) team.push({ label: "Secretários de Estado", people: own.secretaries });
    if (pm) team.push({ label: "Responde a", people: [pm] });
    return { team, teamNote: own.name };
  }
  const under = government.ministries.find((ministry) => ministry.secretaries.some((person) => person.id === id));
  if (under) {
    const team: TeamGroup[] = [];
    if (under.minister) team.push({ label: "Responde a", people: [under.minister] });
    const others = under.secretaries.filter((person) => person.id !== id);
    if (others.length > 0) team.push({ label: "Na mesma equipa", people: others });
    return { team, teamNote: under.name };
  }
  return { team: [], teamNote: null };
}

/** "XXV" from "XXV Governo Constitucional". */
const romanOf = (name: string) => name.split(" ")[0] ?? name;

export default async function GovernmentMemberPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const [member, path, government, parties] = await Promise.all([
    loadMember(id),
    /^[0-9a-f]{32}$/.test(id) ? tryPersonPath("government", id) : null,
    getGovernment().catch(() => null),
    getParties().catch(() => []),
  ]);
  if (!member) notFound();
  const current = member.positions.find((position) => !position.endDate) ?? member.positions[0];
  const female = member.gender === "F";
  const party = parties.find((item) => item.slug === member.partySlug) ?? null;
  const color = member.partySlug ? partyColor(member.partySlug) : "var(--ink)";
  const governmentName =
    current?.government && government?.code === current.government ? government.name : (current?.government?.toUpperCase() ?? null);
  const { team, teamNote } = teamOf(member.id, government);
  const since =
    member.positions
      .map((position) => position.startDate)
      .filter((day): day is string => Boolean(day))
      .sort()[0] ?? null;

  return (
    <article data-wide className="pb-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            personLd({
              path: `/governo/${member.id}`,
              name: member.name,
              jobTitle: member.positions[0]?.title,
              photoUrl: member.photoUrl,
              party: parties.find((party) => party.slug === member.partySlug) ?? null,
              worksFor: member.inOffice ? "government" : undefined,
              sameAs: member.links.map((link) => link.url),
            }),
            breadcrumbs([
              { name: "Governo", path: "/governo" },
              { name: member.name, path: `/governo/${member.id}` },
            ]),
          ]),
        }}
      />
      <ScrollToTop id={String(id)} />
      <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        <Link href="/governo" className="hover:text-ink hover:underline">
          ← Governo
        </Link>
        {governmentName && (
          <>
            <span aria-hidden="true">/</span>
            <span className="text-ink">{governmentName}</span>
          </>
        )}
      </nav>

      <header
        className="relative overflow-hidden rounded-2xl border border-t-4 border-line p-5 sm:p-6"
        style={{
          borderTopColor: color,
          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 16%, transparent), transparent 45%)`,
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="relative shrink-0 self-start rounded-full p-1" style={{ boxShadow: `0 0 0 3px ${color}` }}>
            <GovernmentPortrait name={member.name} photoUrl={member.photoUrl} size="lg" />
            {party && (
              <span
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 bg-paper px-2 py-0.5 font-mono text-[10px] font-bold text-ink"
                style={{ borderColor: color }}
              >
                {party.acronym}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold">
              {member.inOffice ? (
                <Chip color="var(--stage-law)">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  Em funções
                </Chip>
              ) : (
                <Chip color="var(--muted)">Já não está no Governo{current?.endDate ? ` · saiu a ${formatDate(current.endDate)}` : ""}</Chip>
              )}
              {governmentName && <Chip color="var(--stage-submitted)">Governo · {romanOf(governmentName)}</Chip>}
              {current && <Chip color="var(--muted)">{roleOf(current.kind, female)}</Chip>}
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">{member.name}</h1>
            {current && <p className="mt-1 text-lg text-muted">{current.title}</p>}
          </div>
          <div className="sm:self-start">
            <ArticleActions title={member.name} />
          </div>
        </div>
        {member.deputy && (
          <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3 text-sm">
            <span>
              {female ? "Foi eleita deputada" : "Foi eleito deputado"} nesta legislatura e suspendeu o mandato para entrar no Governo.
            </span>
            <Link href={`/deputados/${member.deputy.id}`} className="font-mono text-link underline">
              Ver ficha de deputado
            </Link>
          </p>
        )}
      </header>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {FEATURES.record && path && <RecordsBox records={path.records} kind="government" id={member.id} />}

          {member.bio.length > 0 && (
            <Section title="Biografia">
              <div className="max-w-3xl space-y-3 leading-relaxed">
                {member.bio.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              <p className="mt-3 font-mono text-xs text-muted">Texto oficial do portal do Governo · não editado.</p>
            </Section>
          )}

          {path && (path.path.length > 0 || path.currentRoles.length > 0 || path.otherRoles.length > 0) && (
            <Section title="Percurso" id="percurso">
              <CareerPath path={path} here="government" />
            </Section>
          )}

          {member.positions.length > 0 && (
            <Section title="Cargos no Governo">
              <ul className="space-y-2">
                {member.positions.map((position) => (
                  <li
                    key={`${position.title}-${position.startDate}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-l-4 border-line px-4 py-3"
                    style={{ borderLeftColor: position.endDate ? "var(--line)" : color }}
                  >
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

          <Section title="Nas notícias">
            {member.articles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Sem notícias recentes com o nome completo.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {member.articles.map((article) => (
                  <li key={article.id} className="px-4 py-3">
                    <p className="font-mono text-[11px] text-muted">
                      <span className="font-bold text-ink">{article.source}</span> · {formatDate(article.publishedAt)}
                    </p>
                    <Link href={`/article/${article.id}`} className="font-bold leading-snug hover:underline">
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-start gap-2 font-mono text-xs text-muted">
              <span
                aria-hidden="true"
                className="flex size-4 shrink-0 items-center justify-center rounded-full border border-line text-[10px]"
              >
                i
              </span>
              Contamos só as notícias com o nome completo. Podem faltar as que dizem apenas o apelido ou o cargo.
            </p>
          </Section>
        </div>

        <aside
          aria-label={`Sobre ${member.name}`}
          className="flex flex-col gap-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain no-scrollbar"
        >
          <section aria-labelledby="ficha" className="rounded-2xl border border-line p-4">
            <h2 id="ficha" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
              Ficha
            </h2>
            <dl className="space-y-2.5 text-sm">
              {current && <Fact label="Cargo">{current.title}</Fact>}
              {governmentName && <Fact label="Governo">{governmentName}</Fact>}
              {since && <Fact label={member.inOffice ? "No Governo desde" : "Entrou no Governo"}>{formatLongDate(since)}</Fact>}
              <Fact label="Partido">
                {party ? (
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                      <PartyLogo slug={party.slug} acronym={party.acronym} size={16} />
                    </span>
                    {tidyName(party.name)}
                  </span>
                ) : member.independent ? (
                  "Independente"
                ) : (
                  <span className="text-muted">Não indicado</span>
                )}
                {party && member.partySource === "curated" && (
                  <span className="mt-0.5 block font-mono text-[10px] text-muted">filiação pública, não indicada pelo Governo</span>
                )}
              </Fact>
            </dl>
          </section>

          {member.links.length > 0 && (
            <section aria-labelledby="canais" className="rounded-2xl border border-line p-4">
              <h2 id="canais" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
                Canais oficiais
              </h2>
              <ul className="flex flex-wrap gap-2">
                {member.links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-full border border-line px-3 py-1 font-mono text-xs font-bold hover:bg-surface"
                    >
                      {link.network} ↗<span className="sr-only"> (abre num novo separador)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {team.length > 0 && (
            <section aria-labelledby="equipa" className="rounded-2xl border border-line p-4">
              <h2 id="equipa" className="font-mono text-xs font-bold uppercase tracking-widest">
                A equipa
              </h2>
              {teamNote && <p className="mt-1 text-xs text-muted">{teamNote}</p>}
              {team.map((group) => (
                <div key={group.label} className="mt-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">{group.label}</p>
                  <ul className="space-y-0.5">
                    {group.people.map((person) => (
                      <li key={person.id}>
                        <Link
                          href={`/governo/${person.id}`}
                          className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface"
                        >
                          <GovernmentPortrait name={person.name} photoUrl={person.photoUrl} size="xs" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold leading-snug">{person.name}</span>
                            <span className="block text-xs leading-snug text-muted">{person.title}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          <p className="font-mono text-[11px] leading-relaxed text-muted">
            Fontes: portal do Governo (portugal.gov.pt){path ? ", Assembleia da República e Presidência" : ""}.
            {government?.updatedAt && ` Atualizado a ${formatDate(government.updatedAt)}.`}
          </p>
        </aside>
      </div>
    </article>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {children}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">{title}</h2>
      {children}
    </section>
  );
}
