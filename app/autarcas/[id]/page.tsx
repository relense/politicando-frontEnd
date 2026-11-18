import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { ArticleActions } from "@/components/ArticleActions";
import { PartyLogo } from "@/components/PartyLogo";
import { WhoIs } from "@/components/WhoIs";
import { ApiError, getParties } from "@/lib/api/client";
import { getLocalOfficial, localOfficialPath } from "@/lib/api/localOfficials";
import { placePath } from "@/lib/places";
import { formatDate } from "@/lib/format";
import { partyColor } from "@/lib/parliament";
import { partyPath } from "@/lib/parties";
import { localOfficialSummary } from "@/lib/personSummary";
import { absolute, breadcrumbs, jsonLd } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

/** The official, our parties in their list and the "Quem é" text; shared by the metadata and the page. Null if unknown. */
const load = cache(async (id: string) => {
  if (!/^[a-z0-9-]{1,120}$/.test(id)) return null;
  try {
    const [official, parties] = await Promise.all([getLocalOfficial(id), getParties().catch(() => [])]);
    const ours = official.parties.flatMap((slug) => {
      const party = parties.find((item) => item.slug === slug);
      return party ? [party] : [];
    });
    return {
      official,
      ours,
      summary: localOfficialSummary(
        official,
        ours.map((party) => party.acronym),
      ),
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load((await params).id);
  if (!loaded) return { title: "Autarca não encontrado" };
  return {
    title: loaded.summary.title,
    description: loaded.summary.description,
    alternates: { canonical: localOfficialPath(loaded.official.id) },
  };
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-ZÀ-Ý]/.test(word))
    .map((word) => word[0])
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .join("");

export default async function LocalOfficialPage({ params }: Props) {
  await connection();
  const loaded = await load((await params).id);
  if (!loaded) notFound();
  const { official, ours, summary } = loaded;
  const color = official.parties[0] ? partyColor(official.parties[0]) : "var(--muted)";
  const path = localOfficialPath(official.id);
  const trail = [
    { name: "Quem governa", path: "/sitios" },
    ...(official.district ? [{ name: official.district.name, path: placePath(official.district.key) }] : []),
    { name: official.place.name, path: placePath(official.place.key) },
    { name: official.shortName, path },
  ];

  return (
    <article data-wide className="pb-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            {
              "@context": "https://schema.org",
              "@type": "Person",
              "@id": `${absolute(path)}#pessoa`,
              name: official.shortName,
              ...(official.name !== official.shortName ? { alternateName: official.name } : {}),
              url: absolute(path),
              jobTitle: official.title,
              description: summary.sentences.join(" "),
              nationality: { "@type": "Country", name: "Portugal" },
              worksFor: {
                "@type": "GovernmentOrganization",
                name: `Câmara Municipal de ${official.place.name}`,
                url: absolute(placePath(official.place.key)),
              },
              ...(ours[0]
                ? {
                    memberOf: {
                      "@type": "PoliticalParty",
                      name: ours[0].name,
                      alternateName: ours[0].acronym,
                      url: absolute(partyPath(ours[0].slug)),
                    },
                  }
                : {}),
            },
            breadcrumbs(trail),
          ]),
        }}
      />
      <nav aria-label="Caminho" className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
        {trail.slice(0, -1).map((step, index) => (
          <span key={step.path} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            <Link href={step.path} className={index === trail.length - 2 ? "text-ink hover:underline" : "hover:text-ink hover:underline"}>
              {index === 0 ? `← ${step.name}` : step.name}
            </Link>
          </span>
        ))}
      </nav>

      <header
        className="relative overflow-hidden rounded-2xl border border-t-4 border-line p-5 sm:p-6"
        style={{
          borderTopColor: color,
          backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 16%, transparent), transparent 45%)`,
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 bg-paper font-mono text-3xl font-bold"
            style={{ borderColor: color }}
          >
            {initials(official.shortName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted">
              {official.current ? "Em funções" : "Mandato terminado"}
              {official.term.start && ` · desde ${formatDate(official.term.start)}`}
            </p>
            <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">{official.shortName}</h1>
            <p className="mt-1 text-lg text-muted">{official.title}</p>
            {official.name !== official.shortName && <p className="mt-0.5 font-mono text-xs text-muted">{official.name}</p>}
          </div>
          <div className="sm:self-start">
            <ArticleActions title={official.shortName} />
          </div>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <WhoIs name={official.shortName} sentences={summary.sentences} />

          {official.otherRoles.length > 0 && (
            <Section title="Outros cargos e candidaturas">
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {official.otherRoles.map((role, index) => (
                  <li key={`${role.title}-${index}`} className="px-4 py-3">
                    <p className="font-mono text-[11px] text-muted">
                      {role.date && formatDate(role.date)}
                      {role.current && " · atual"}
                      {role.elected && " · conseguiu o lugar"}
                    </p>
                    {role.href ? (
                      <Link href={role.href} className="font-bold leading-snug hover:underline">
                        {role.title}
                      </Link>
                    ) : (
                      <p className="font-bold leading-snug">{role.title}</p>
                    )}
                    {role.detail && <p className="text-sm text-muted">{role.detail}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Nas notícias">
            {official.articles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Sem notícias recentes com o nome.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {official.articles.map((article) => (
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
          </Section>
        </div>

        <aside aria-label="Ficha" className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line p-5">
            <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest">Ficha</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <Fact label="Câmara">
                <Link href={placePath(official.place.key)} className="text-link underline">
                  {official.place.name}
                </Link>
              </Fact>
              {official.label && <Fact label="Lista">{official.label}</Fact>}
              {ours.length > 0 && (
                <Fact label={ours.length === 1 ? "Partido" : "Partidos"}>
                  <span className="flex flex-wrap gap-2">
                    {ours.map((party) => (
                      <Link key={party.slug} href={partyPath(party.slug)} className="inline-flex items-center gap-1.5 hover:underline">
                        <PartyLogo slug={party.slug} acronym={party.acronym} size={16} />
                        {party.acronym}
                      </Link>
                    ))}
                  </span>
                </Fact>
              )}
              {official.term.end && <Fact label="Mandato até">{official.term.end.slice(0, 4)}</Fact>}
            </dl>
          </div>
          <p className="font-mono text-xs text-muted">Fonte: resultados oficiais das autárquicas (Ministério da Administração Interna).</p>
        </aside>
      </div>
    </article>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">{title}</h2>
      {children}
    </section>
  );
}
