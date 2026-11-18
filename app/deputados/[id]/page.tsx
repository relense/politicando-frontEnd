import type { Metadata } from "next";
import Link from "next/link";
import { ScrollToTop } from "@/components/ScrollToTop";
import { isLegislatureId, legislaturePath } from "@/lib/api/legislatures";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { ArticleActions } from "@/components/ArticleActions";
import { DeputyArticles, DeputyInitiatives, DeputyPortrait } from "@/components/DeputyProfile";
import { PartyLogo } from "@/components/PartyLogo";
import { CareerPath } from "@/components/CareerPath";
import { DeputyVotes } from "@/components/DeputyVotes";
import { RecordsBox } from "@/components/Records";
import { WhoIs } from "@/components/WhoIs";
import { ApiError, getDeputy, getDeputyVotes, getParliament } from "@/lib/api/client";
import { tryPersonPath } from "@/lib/api/people";
import { tidyName } from "@/lib/elections";
import { formatNumber } from "@/lib/format";
import { ageOn, partyColor } from "@/lib/parliament";
import { FEATURES } from "@/lib/features";
import { deputySummary } from "@/lib/personSummary";
import { breadcrumbs, jsonLd, personLd } from "@/lib/seo";

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

/** Their career path and the first page of their votes, shared by the metadata and the page; null when unavailable. */
const loadPath = cache(async (id: string) => (/^\d+$/.test(id) ? tryPersonPath("deputy", id) : null));
const VOTES_SHOWN = 20;
const loadVotes = cache(async (id: string) =>
  /^\d+$/.test(id) ? getDeputyVotes(Number(id), { limit: VOTES_SHOWN }).catch(() => null) : null,
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const deputy = await loadDeputy(id);
  if (!deputy) return { title: "Deputado não encontrado" };
  const [path, votes] = await Promise.all([loadPath(id), loadVotes(id)]);
  const summary = deputySummary(deputy, path, votes?.summary ?? null);
  return {
    title: summary.title,
    description: summary.description,
    alternates: { canonical: `/deputados/${deputy.id}` },
  };
}

export default async function DeputyPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const [deputy, path, parliament, votes] = await Promise.all([
    loadDeputy(id),
    loadPath(id),
    getParliament().catch(() => null),
    loadVotes(id),
  ]);
  if (!deputy) notFound();
  const summary = deputySummary(deputy, path, votes?.summary ?? null);
  const color = deputy.partySlug ? partyColor(deputy.partySlug) : "var(--ink)";
  const role = deputy.role ?? deputy.positions[0] ?? null;
  const age = ageOn(deputy.birthDate, new Date());
  const legislatures = deputy.pastLegislatures.length + 1;
  const education = deputy.education.map((item) => (item.completed ? item.course : `${item.course} (frequência)`));
  // The path already lists the current posts; the side box then keeps to the committees.
  const posts =
    path && path.currentRoles.length > 0
      ? []
      : [...new Set([...deputy.positions, ...deputy.roles.filter((item) => item.current).map((item) => item.title)])];
  const benchHref = deputy.partySlug ? `/parlamento?partido=${deputy.partySlug}` : "/parlamento";

  return (
    <article data-wide className="pb-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            personLd({
              path: `/deputados/${deputy.id}`,
              name: deputy.name,
              fullName: deputy.fullName,
              jobTitle:
                path?.currentRoles.find((step) => step.kind === "government")?.title ??
                `Membro da Assembleia da República, pelo círculo de ${deputy.constituency}`,
              photoUrl: deputy.photoUrl,
              party: deputy.party,
              worksFor: "parliament",
              description: summary.sentences.join(" "),
              birthDate: deputy.birthDate,
              sameAs: [
                `https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx?BID=${deputy.id}`,
                ...deputy.links.map((link) => link.url),
              ],
            }),
            breadcrumbs([
              { name: "Parlamento", path: "/parlamento" },
              { name: deputy.name, path: `/deputados/${deputy.id}` },
            ]),
          ]),
        }}
      />
      <ScrollToTop id={String(deputy.id)} />
      <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        <Link href="/parlamento" className="hover:text-ink hover:underline">
          ← Parlamento
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={benchHref} className="text-ink hover:underline">
          {deputy.party ? `Deputados do ${deputy.party.acronym}` : "Deputados"}
        </Link>
      </nav>

      <header
        className="relative overflow-hidden rounded-2xl border border-t-4 border-line p-5 sm:p-6"
        style={{
          borderTopColor: color,
          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 16%, transparent), transparent 45%)`,
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="relative shrink-0 self-start">
            <DeputyPortrait deputy={deputy} size="lg" />
            {deputy.party && (
              <span
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 bg-paper px-2 py-0.5 font-mono text-[10px] font-bold text-ink"
                style={{ borderColor: color }}
              >
                {deputy.party.acronym}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold">
              {deputy.active ? (
                <Chip color="var(--stage-law)">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                  Em funções
                </Chip>
              ) : (
                <Chip color="var(--muted)">{deputy.situation ?? "Sem mandato ativo"}</Chip>
              )}
              <Chip color="var(--stage-approved)">Parlamento{parliament ? ` · ${parliament.legislature}` : ""}</Chip>
              <Chip color="var(--muted)">Círculo de {deputy.constituency}</Chip>
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">{deputy.name}</h1>
            <p className="mt-1 text-lg text-muted">
              {role ?? `${deputy.gender === "F" ? "Deputada" : "Deputado"} à Assembleia da República`}
            </p>
            {deputy.fullName !== deputy.name && <p className="mt-0.5 font-mono text-xs text-muted">{deputy.fullName}</p>}
          </div>
          <div className="sm:self-start">
            <ArticleActions title={deputy.name} />
          </div>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <WhoIs name={deputy.name} sentences={summary.sentences} />
          {FEATURES.record && path && <RecordsBox records={path.records} kind="deputy" id={deputy.id} />}

          {path && (path.path.length > 0 || path.currentRoles.length > 0) && (
            <Section title="Percurso" id="percurso">
              <CareerPath path={path} here="deputy" />
            </Section>
          )}

          <Section title="Iniciativas que assina">
            <div className="rounded-2xl border border-line px-4">
              <DeputyInitiatives detail={deputy} />
            </div>
          </Section>

          <Section title="Votações" id="votacoes">
            <DeputyVotes deputyId={deputy.id} group={deputy.party?.acronym ?? deputy.group} initialPage={votes} />
          </Section>

          <Section title="Nas notícias">
            <div className="rounded-2xl border border-line px-4">
              <DeputyArticles detail={deputy} />
            </div>
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
          aria-label={`Sobre ${deputy.name}`}
          className="flex flex-col gap-4 no-scrollbar xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overflow-x-hidden xl:overscroll-contain"
        >
          <section aria-labelledby="ficha" className="rounded-2xl border border-line p-4">
            <h2 id="ficha" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
              Ficha
            </h2>
            <dl className="space-y-2.5 text-sm">
              <Fact label="Partido">
                {deputy.party ? (
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-line bg-white">
                      <PartyLogo slug={deputy.party.slug} acronym={deputy.party.acronym} size={16} />
                    </span>
                    {tidyName(deputy.party.name)}
                  </span>
                ) : (
                  "Independente"
                )}
              </Fact>
              <Fact label="Círculo">{deputy.constituency}</Fact>
              {role && <Fact label="Cargo">{role}</Fact>}
              {deputy.seat !== null && (
                <Fact label="Lugar no hemiciclo">
                  {deputy.seat}
                  {deputy.seatEstimated && <span className="text-muted"> (aproximado)</span>}{" "}
                  <Link href={`/parlamento?deputado=${deputy.id}`} className="font-mono text-xs text-link underline">
                    ver
                  </Link>
                </Fact>
              )}
              {age !== null && <Fact label="Idade">{age} anos</Fact>}
              {deputy.profession && <Fact label="Profissão">{deputy.profession}</Fact>}
              {education.length > 0 && <Fact label="Formação">{education.join(" · ")}</Fact>}
              <Fact label="Legislaturas">
                {legislatures === 1 ? "Primeira legislatura" : `${legislatures} legislaturas`}
                {deputy.pastLegislatures.length > 0 && (
                  <span className="mt-0.5 block font-mono text-[10px] text-muted">
                    antes:{" "}
                    {deputy.pastLegislatures.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ", "}
                        {isLegislatureId(id) ? (
                          <Link href={legislaturePath(id)} className="underline hover:text-ink">
                            {id}
                          </Link>
                        ) : (
                          id
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </Fact>
            </dl>
          </section>

          <section aria-labelledby="numeros" className="rounded-2xl border border-line p-4">
            <h2 id="numeros" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
              Em números
            </h2>
            <dl className="grid grid-cols-3 gap-2">
              <Stat value={deputy.initiatives.total} label="iniciativas assinadas" />
              <Stat value={deputy.initiatives.approved} label="aprovadas" />
              <Stat value={deputy.articles.length} label="notícias recentes" />
            </dl>
          </section>

          {(deputy.committees.length > 0 || posts.length > 0) && (
            <section aria-labelledby="cargos" className="rounded-2xl border border-line p-4">
              <h2 id="cargos" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
                Cargos e comissões
              </h2>
              {posts.length > 0 && (
                <ul className="mb-3 space-y-1.5 text-sm">
                  {posts.map((title) => (
                    <li key={title} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      {title}
                    </li>
                  ))}
                </ul>
              )}
              {deputy.committees.length > 0 && (
                <>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">Comissões</p>
                  <ul className="space-y-1.5 text-sm">
                    {deputy.committees.map((committee) => (
                      <li key={committee.name} className="leading-snug">
                        {committee.name}
                        {(committee.role || committee.membership) && (
                          <span className="block font-mono text-[10px] text-muted">{committee.role ?? committee.membership}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          <Link href={`/parlamento?deputado=${deputy.id}`} className="group block rounded-2xl border border-line p-4 hover:bg-surface">
            <span className="block font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--stage-approved)]">
              {deputy.party ? `Bancada do ${deputy.party.acronym}` : "Parlamento"}
            </span>
            <span className="mt-1 block text-lg font-bold leading-snug">Ver no hemiciclo</span>
            <span className="mt-1 block text-sm text-muted">Onde se senta e quem são os colegas de bancada.</span>
            <span className="mt-2 block font-mono text-xs font-bold group-hover:underline">Abrir →</span>
          </Link>

          {deputy.links.length > 0 && (
            <section aria-labelledby="ligacoes" className="rounded-2xl border border-line p-4">
              <h2 id="ligacoes" className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">
                Ligações
              </h2>
              <ul className="flex flex-wrap gap-2">
                {deputy.links.map((link) => (
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

          <p className="font-mono text-[11px] leading-relaxed text-muted">
            Fonte: Assembleia da República (dados abertos).{" "}
            <a
              href={`https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx?BID=${deputy.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link underline"
            >
              Biografia no Parlamento ↗<span className="sr-only"> (abre num novo separador)</span>
            </a>
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-line p-2.5">
      <dt className="font-mono text-[10px] leading-tight text-muted">{label}</dt>
      <dd className="text-xl font-bold leading-tight">{formatNumber(value)}</dd>
    </div>
  );
}
