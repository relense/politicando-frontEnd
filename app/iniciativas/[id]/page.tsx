import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { PartyChips } from "@/components/PartyChips";
import { InitiativePredictionBox } from "@/components/Predictions";
import { ProposalNews } from "@/components/RelatedArticles";
import { StageProgress } from "@/components/StageProgress";
import { ApiError, getInitiative, getParties } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { hasPlainTitle, headlineOf, initiativePath, presidencyLabel } from "@/lib/initiatives";
import { partyColor, STATUS_LABELS } from "@/lib/parliament";
import type { InitiativeDetail, Vote, VotePosition } from "@/lib/types";
import { breadcrumbs, jsonLd, legislationLd, pageTitle } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

/** One request per page, shared by the metadata and the page. Null when there is no such initiative. */
const loadInitiative = cache(async (id: string) => {
  if (!/^\d{1,9}$/.test(id)) return null;
  try {
    return await getInitiative(Number(id));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const initiative = await loadInitiative((await params).id);
  if (!initiative) return { title: "Iniciativa não encontrada" };
  const kind = initiative.plain?.type.label ?? initiative.type;
  const status = initiative.plain?.status.label ?? STATUS_LABELS[initiative.status];
  return {
    title: pageTitle(headlineOf(initiative)),
    description: `${kind}. ${status}. Quem propôs, em que fase está, como votaram os partidos e o texto oficial.`,
    alternates: { canonical: initiativePath(initiative.id) },
  };
}

const POSITIONS: { key: "favor" | "against" | "abstention" | "absent"; label: string }[] = [
  { key: "favor", label: "A favor" },
  { key: "against", label: "Contra" },
  { key: "abstention", label: "Abstenção" },
  { key: "absent", label: "Ausentes" },
];
const NAMED_POSITIONS: Record<string, string> = { favor: "a favor", against: "contra", abstention: "abstenção" };

export default async function InitiativePage({ params }: Props) {
  await connection();
  const [initiative, parties] = await Promise.all([loadInitiative((await params).id), getParties().catch(() => [])]);
  if (!initiative) notFound();
  const acronyms = new Map(parties.map((party) => [party.slug, party.acronym]));
  const acronym = (slug: string) => acronyms.get(slug) ?? slug.toUpperCase();
  const { plain, presidency, authors } = initiative;

  return (
    // A second column only when there's a "Passa ou chumba?" to show.
    <div className="gap-8 xl:has-[>aside>*]:grid xl:has-[>aside>*]:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="min-w-0">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              legislationLd({
                path: initiativePath(initiative.id),
                name: headlineOf(initiative),
                kind: initiative.plain?.type.label ?? initiative.type,
                date: initiative.submittedAt?.slice(0, 10),
                officialUrl: initiative.textUrl,
              }),
              breadcrumbs([
                { name: "Iniciativas", path: "/iniciativas" },
                { name: headlineOf(initiative), path: initiativePath(initiative.id) },
              ]),
            ]),
          }}
        />
        <p className="mb-3 font-mono text-xs">
          <Link href="/iniciativas" className="text-muted underline hover:text-ink">
            Iniciativas
          </Link>
          <span aria-hidden="true" className="text-muted">
            {" "}
            ›{" "}
          </span>
          <span className="font-bold uppercase tracking-widest">
            {initiative.type}
            {initiative.number && ` n.º ${initiative.number}`}
          </span>
        </p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{headlineOf(initiative)}</h1>
        {hasPlainTitle(initiative) && (
          <p className="mt-3 text-muted">
            <span className="font-mono text-xs uppercase tracking-wider">Título oficial: </span>
            {initiative.title}
          </p>
        )}

        <section aria-labelledby="fase" className="mt-8 rounded-2xl border border-line p-5">
          <h2 id="fase" className="font-mono text-xs font-bold uppercase tracking-widest text-muted">
            Em que fase está
          </h2>
          <p className="mt-2 text-lg font-bold">{plain?.status.label ?? STATUS_LABELS[initiative.status]}</p>
          {initiative.phase && (
            <p className="text-sm text-muted">
              {initiative.phase}
              {initiative.phaseDate && `, ${formatDate(initiative.phaseDate)}`}
            </p>
          )}
          {plain?.status.stage && (
            <div className="mt-4">
              <StageProgress stage={plain.status.stage} makesLaw={plain.type.makesLaw} labels />
            </div>
          )}
        </section>

        {plain && (
          <section aria-labelledby="o-que-e" className="mt-4 rounded-2xl bg-surface p-5">
            <h2 id="o-que-e" className="font-mono text-xs font-bold uppercase tracking-widest text-muted">
              O que é: {plain.type.label}
            </h2>
            {plain.type.explainer && <p className="mt-2 leading-relaxed">{plain.type.explainer}</p>}
            {!plain.type.makesLaw && (
              <p className="mt-2 font-bold">Mesmo que seja aprovada, não muda nenhuma lei: é uma recomendação ou uma decisão interna.</p>
            )}
          </section>
        )}

        <dl className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-muted">Proposta por</dt>
            <dd className="mt-1">
              {authors.other && <p className="font-bold">{authors.other}</p>}
              <PartyChips parties={authors.parties} />
              {/* A whole group's signatures say no more than its chip (which opens the party and its deputies): names
                only when a few deputies signed it. */}
              {authors.deputies.length > 3 && <p className="mt-2 font-mono text-xs text-muted">{authors.deputies.length} deputados</p>}
              {authors.deputies.length > 0 && authors.deputies.length <= 3 && (
                <ul className="mt-2 flex flex-col gap-0.5 text-sm">
                  {authors.deputies.map((deputy) => (
                    <li key={deputy.id}>
                      <Link href={`/deputados/${deputy.id}`} className="text-link underline">
                        {deputy.name}
                      </Link>
                      {deputy.partySlug && <span className="font-mono text-xs text-muted"> {acronym(deputy.partySlug)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wider text-muted">Datas</dt>
            <dd className="mt-1 text-sm">
              {initiative.submittedAt && <p>Entregue a {formatDate(initiative.submittedAt)}</p>}
              {initiative.publishedAt && <p>Publicada no Diário da República a {formatDate(initiative.publishedAt)}</p>}
            </dd>
          </div>
          {initiative.topics.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="font-mono text-xs uppercase tracking-wider text-muted">Temas</dt>
              <dd className="mt-1">
                <ul className="flex flex-wrap gap-1.5">
                  {initiative.topics.map((topic) => (
                    <li key={topic.slug}>
                      <Link
                        href={`/iniciativas?tema=${topic.slug}`}
                        className="inline-block rounded-full border border-line px-3 py-1 font-mono text-xs font-bold hover:bg-surface"
                      >
                        {topic.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3 font-mono text-sm">
          {initiative.textUrl && (
            <a
              href={initiative.textUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-ink px-4 py-2 font-bold text-paper hover:opacity-90"
            >
              Ler o texto oficial ↗<span className="sr-only"> (abre num novo separador)</span>
            </a>
          )}
          <Link
            href={`/forum/geral?iniciativa=${initiative.id}#nova`}
            className="rounded-full border border-line px-4 py-2 font-bold hover:bg-surface"
          >
            Discutir no fórum
          </Link>
        </div>

        {presidency && (
          <section aria-labelledby="presidente" className="mt-12">
            <h2 id="presidente" className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
              No Presidente da República
            </h2>
            <p className="font-bold">
              {presidencyLabel(presidency)}
              {presidency.by && <span className="font-normal text-muted"> · {presidency.by}</span>}
            </p>
            <ol className="mt-3 flex flex-col gap-2 border-l-2 border-line pl-4 text-sm">
              {presidency.sentAt && <li>Enviada para Belém a {formatDate(presidency.sentAt)}</li>}
              {(presidency.vetoes.length > 0
                ? presidency.vetoes
                : presidency.vetoedAt
                  ? [{ date: presidency.vetoedAt, kind: presidency.vetoKind, constitutionalCourt: presidency.constitutionalCourt }]
                  : []
              ).map((veto, index) => (
                <li key={`${veto.date}-${index}`}>
                  {veto.kind === "unconstitutionality" ? "Vetada por inconstitucionalidade" : "Vetada"}
                  {veto.date && ` a ${formatDate(veto.date)}`}
                  {veto.constitutionalCourt.length > 0 && (
                    <>
                      , depois {veto.constitutionalCourt.length === 1 ? "do acórdão" : "dos acórdãos"} do Tribunal Constitucional{" "}
                      {veto.constitutionalCourt.map((item, at) => (
                        <span key={item.ruling}>
                          {at > 0 && ", "}
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
                              n.º {item.ruling}
                              <span className="sr-only"> (abre num novo separador)</span>
                            </a>
                          ) : (
                            `n.º ${item.ruling}`
                          )}
                        </span>
                      ))}
                    </>
                  )}
                </li>
              ))}
              {presidency.promulgatedAt && <li>Promulgada a {formatDate(presidency.promulgatedAt)}</li>}
              {presidency.status === "promulgated" && !presidency.promulgationRecorded && (
                <li>
                  Promulgada{initiative.publishedAt && <>; publicada em Diário da República a {formatDate(initiative.publishedAt)}</>}
                  <span className="block text-xs text-muted">O registo do Parlamento não tem a data da promulgação.</span>
                </li>
              )}
              {presidency.status === "pending" && <li className="text-muted">À espera da decisão do Presidente</li>}
            </ol>
            <p className="mt-3 text-sm text-muted">
              <Link href="/presidente" className="text-link underline">
                O que faz o Presidente com as leis
              </Link>
            </p>
          </section>
        )}

        <section aria-labelledby="votacoes" className="mt-12">
          <h2 id="votacoes" className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
            Como votaram os partidos
          </h2>
          {initiative.votes.length === 0 ? (
            <p className="text-muted">Ainda não foi votada.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {[...initiative.votes].reverse().map((vote) => (
                <li key={vote.id}>
                  <VoteCard vote={vote} acronym={acronym} />
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">
            O Parlamento regista os votos por partido. Um número antes da sigla quer dizer que só esses deputados do partido votaram assim.
          </p>
        </section>

        <Footnote initiative={initiative} />
      </article>
      {/* Its vote (when it has one) and the news about it: beside it on wide screens, after it on narrow ones. */}
      <aside className="flex flex-col gap-4 max-xl:mt-10 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto no-scrollbar">
        <InitiativePredictionBox id={initiative.id} />
        <ProposalNews articles={initiative.articles} />
      </aside>
    </div>
  );
}

function VoteCard({ vote, acronym }: { vote: Vote; acronym: (slug: string) => string }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="font-mono text-xs text-muted">
        {vote.phase ?? "Votação"}
        {vote.date && `, ${formatDate(vote.date)}`}
      </p>
      <p className="mt-1 font-bold">
        {vote.result}
        {vote.unanimous && " por unanimidade"}
      </p>
      {!vote.unanimous && (
        <dl className="mt-3 flex flex-col gap-2">
          {POSITIONS.map(({ key, label }) => (
            <VoteRow key={key} label={label} positions={vote[key]} acronym={acronym} />
          ))}
        </dl>
      )}
      {vote.named.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Votaram à parte da sua bancada:{" "}
          {vote.named
            .map((person) => `${person.name} (${person.group}, ${NAMED_POSITIONS[person.position] ?? person.position})`)
            .join("; ")}
        </p>
      )}
    </div>
  );
}

function VoteRow({ label, positions, acronym }: { label: string; positions: VotePosition[]; acronym: (slug: string) => string }) {
  if (positions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <dt className="w-24 shrink-0 font-mono text-xs text-muted">{label}</dt>
      {positions.map(({ partySlug, count }) => (
        <dd
          key={`${partySlug}-${count}`}
          className="flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-xs font-bold"
        >
          <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: partyColor(partySlug) }} />
          {count !== null && `${count} `}
          {acronym(partySlug)}
        </dd>
      ))}
    </div>
  );
}

function Footnote({ initiative }: { initiative: InitiativeDetail }) {
  return (
    <p className="mt-12 border-t border-line pt-4 text-xs text-muted">
      Fonte: dados abertos da Assembleia da República
      {initiative.legislature && `, ${initiative.legislature} Legislatura`}. O título simples e a explicação vêm de regras fixas aplicadas
      ao título oficial; em caso de dúvida, vale o texto oficial.
    </p>
  );
}
