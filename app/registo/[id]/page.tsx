import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { CasePeople, TermLabel } from "@/components/Records";
import { type CaseSource, getCase } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { reviewedLabel } from "@/lib/records";
import { CONTACT_EMAIL } from "@/lib/site";
import { FEATURES } from "@/lib/features";

type Props = { params: Promise<{ id: string }> };

const loadCase = cache(async (id: string) => {
  if (!/^\d{1,9}$/.test(id)) return null;
  try {
    return await getCase(Number(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!FEATURES.record) notFound();
  const item = await loadCase((await params).id);
  if (!item) return { title: "Processo não encontrado" };
  const names = item.people.map((person) => person.name).join(", ");
  return {
    title: `${item.title}: ${item.status.label}`,
    description: `${item.title}${names ? ` (${names})` : ""}: ${item.crimes.map((crime) => crime.label.toLowerCase()).join(", ")}. Fase atual: ${item.status.label}. Com fontes; todos se presumem inocentes até decisão definitiva.`,
    alternates: { canonical: `/registo/${item.id}` },
  };
}

const SOURCE_KINDS: Record<CaseSource["kind"], string> = { court: "Tribunal", official: "Fonte oficial", news: "Notícia" };

export default async function CasePage({ params }: Props) {
  if (!FEATURES.record) notFound();
  await connection();
  const item = await loadCase((await params).id);
  if (!item) notFound();
  const subject = encodeURIComponent(`Pedido de correção: ${item.title} (registo ${item.id})`);

  return (
    <article className="pb-4" data-wide>
      <Link href="/registo" className="mb-6 inline-block font-mono text-sm text-muted hover:text-ink hover:underline">
        ← Registo
      </Link>

      <header className="rounded-2xl border border-line p-6">
        <p className="flex flex-wrap gap-x-3 font-mono text-xs text-muted">
          {item.crimes.map((crime) => (
            <span key={crime.key}>{crime.label}</span>
          ))}
        </p>
        <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">{item.title}</h1>
        <p className="mt-3">
          <span className="text-muted">Fase do processo: </span>
          <TermLabel term={item.status} className="font-bold" />
          {item.statusDate && <span className="text-muted"> · desde {formatDate(item.statusDate)}</span>}
        </p>
        <p className="mt-3 rounded-xl bg-surface p-3 text-sm">
          Todos os visados se presumem inocentes até haver uma condenação transitada em julgado. Uma investigação ou uma acusação não é uma
          condenação.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 font-mono text-xs text-muted">
          {item.reviewedAt && <span>{reviewedLabel(item.reviewedAt)}</span>}
          {item.startedAt && <span>Início: {formatDate(item.startedAt)}</span>}
          <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} className="text-link underline">
            Pedir correção
          </a>
        </p>
      </header>

      {item.summary && (
        <Section title="Resumo">
          <div className="max-w-3xl space-y-3 leading-relaxed">
            {item.summary
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </div>
        </Section>
      )}

      {item.people.length > 0 && (
        <Section title="Visados">
          <CasePeople people={item.people} />
        </Section>
      )}

      {item.events.length > 0 && (
        <Section title="Cronologia">
          <ol className="relative ml-1.5 space-y-4 border-l-2 border-line pl-5">
            {item.events.map((event, index) => (
              <li key={index} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.72rem] top-1.5 size-3 rounded-full bg-ink ring-4 ring-paper" />
                {event.date && <p className="font-mono text-xs text-muted">{formatDate(event.date)}</p>}
                <p className="leading-snug">
                  {event.description}
                  {event.sources.map((position) => (
                    <a key={position} href={`#fonte-${position}`} className="ml-1 font-mono text-xs text-link underline">
                      [{position}]<span className="sr-only"> fonte {position}</span>
                    </a>
                  ))}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Fontes">
        {item.sources.length === 0 ? (
          <p className="text-sm text-muted">Sem fontes registadas.</p>
        ) : (
          <ul className="space-y-3">
            {item.sources.map((source) => (
              <li key={source.position} id={`fonte-${source.position}`} className="scroll-mt-24 text-sm">
                <span className="font-mono text-xs text-muted">[{source.position}] </span>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    {source.title}
                    <span className="sr-only"> (abre num novo separador)</span>
                  </a>
                ) : (
                  <span className="font-bold">{source.title}</span>
                )}
                <span className="block font-mono text-xs text-muted">
                  {[SOURCE_KINDS[source.kind], source.publisher, source.publishedAt && formatDate(source.publishedAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="mt-12 border-t border-line pt-4 font-mono text-xs text-muted">
        Entrada do registo editorial do Politicando. As pessoas referidas têm direito de resposta:{" "}
        <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">{title}</h2>
      {children}
    </section>
  );
}
