import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { cache } from "react";
import { InitiativeItem } from "@/components/InitiativeItem";
import { RelatedArticles } from "@/components/RelatedArticles";
import { ApiError } from "@/lib/api/client";
import { getPresidency, type Presidency } from "@/lib/api/presidency";
import { formatLongDate, formatNumber } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import type { Initiative } from "@/lib/types";

/** The Presidency's photo store, which the image optimiser accepts (next.config.ts). */
const PRESIDENCY_PHOTO = /^https:\/\/www\.presidencia\.pt\/media\//;
/** Paragraphs of the biography shown before "Ler a biografia completa". */
const BIO_LEAD = 2;

/** Null while the API doesn't serve the Presidency yet, so the page can say so calmly. */
const loadPresidency = cache(async (): Promise<Presidency | null> => {
  try {
    return await getPresidency();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata(): Promise<Metadata> {
  const data = await loadPresidency();
  const name = data?.president.name;
  return {
    title: name ? `${name}, Presidente da República` : "Presidente da República",
    description: name
      ? `${name}, Presidente da República: biografia, leis promulgadas e vetadas, o que está à espera de decisão e as notícias.`
      : "O Presidente da República: o que faz, as leis que promulgou e vetou, e as notícias.",
    alternates: { canonical: "/presidente" },
  };
}

function jsonLd({ president }: Presidency) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: president.name,
    alternateName: president.fullName !== president.name ? president.fullName : undefined,
    jobTitle: "Presidente da República Portuguesa",
    image: president.photoUrl ?? undefined,
    url: `${SITE_URL}/presidente`,
    sameAs: president.url ? [president.url] : undefined,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const POWERS: { title: string; text: string }[] = [
  {
    title: "Promulga ou veta as leis",
    text: "As leis aprovadas no Parlamento só entram em vigor depois de o Presidente as promulgar. Se discordar, pode vetá-las: voltam ao Parlamento, que as pode confirmar por maioria absoluta dos deputados (em alguns casos, dois terços). Nesse caso, o Presidente é obrigado a promulgar.",
  },
  {
    title: "Pode pedir ao Tribunal Constitucional",
    text: "Antes de decidir, pode enviar uma lei ao Tribunal Constitucional para verificar se respeita a Constituição. Se o Tribunal disser que não, o Presidente tem de a vetar.",
  },
  {
    title: "Nomeia o Primeiro-Ministro",
    text: "Depois das eleições legislativas, ouve os partidos e nomeia o Primeiro-Ministro tendo em conta os resultados. O Governo responde perante o Parlamento.",
  },
  {
    title: "Pode dissolver o Parlamento",
    text: "Pode dissolver a Assembleia da República e marcar eleições antecipadas, depois de ouvir os partidos e o Conselho de Estado. Não o pode fazer nos seis meses depois de eleições nem no último semestre do seu mandato.",
  },
];

export default async function PresidentPage() {
  await connection();
  const data = await loadPresidency();

  if (!data) {
    return (
      <div data-wide>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Presidente da República</h1>
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Esta página ainda não está disponível. Volta em breve.
        </p>
      </div>
    );
  }

  const { president, legislation, former } = data;
  const lead = president.bio.slice(0, BIO_LEAD);
  const rest = president.bio.slice(BIO_LEAD);

  return (
    <article data-wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />

      <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-center">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Chefe de Estado</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{president.name}</h1>
          <p className="mt-2 text-lg text-muted">
            Presidente da República desde <time dateTime={president.termStart}>{formatLongDate(president.termStart)}</time>
          </p>
          {president.fullName !== president.name && <p className="mt-1 text-sm text-muted">{president.fullName}</p>}
        </div>
        {president.photoUrl ? (
          <Image
            src={president.photoUrl}
            alt={`Fotografia oficial de ${president.name}`}
            width={704}
            height={469}
            sizes="(min-width: 768px) 22rem, 100vw"
            unoptimized={!PRESIDENCY_PHOTO.test(president.photoUrl)}
            priority
            className="aspect-[3/2] w-full rounded-2xl bg-surface object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-[3/2] w-full items-center justify-center rounded-2xl bg-surface text-5xl font-bold text-muted"
          >
            {initials(president.name)}
          </div>
        )}
      </header>

      <section aria-labelledby="leis" className="mt-10">
        <h2 id="leis" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          As leis do Parlamento neste mandato
        </h2>
        <dl className="grid grid-cols-3 gap-3">
          <Counter value={legislation.promulgated} label={legislation.promulgated === 1 ? "promulgada" : "promulgadas"} />
          <Counter value={legislation.vetoed} label={legislation.vetoed === 1 ? "vetada" : "vetadas"} />
          <Counter value={legislation.pending} label="à espera de decisão" />
        </dl>
        <p className="mt-2 text-xs text-muted">
          Só decretos da Assembleia da República. Os vetos incluem leis que o Parlamento voltou a aprovar. Os decretos do Governo ainda não
          estão incluídos.
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <InitiativeGroup
            id="pendentes"
            title="À espera de decisão"
            items={legislation.pendingNow}
            empty="Nada à espera de decisão agora."
            more="pending"
          />
          <InitiativeGroup id="vetos" title="Vetos" items={legislation.latestVetoes} empty="Ainda não vetou nenhuma lei." more="vetoed" />
        </div>
        <div className="mt-10">
          <InitiativeGroup
            id="promulgadas"
            title="Promulgadas recentemente"
            items={legislation.latestPromulgated}
            empty="Ainda não promulgou nenhuma lei."
            more="promulgated"
          />
        </div>
      </section>

      <section aria-labelledby="o-que-faz" className="mt-12 rounded-2xl bg-surface p-5 sm:p-6">
        <h2 id="o-que-faz" className="text-xl font-bold">
          O que faz o Presidente da República
        </h2>
        <p className="mt-2 max-w-3xl text-muted">
          É o chefe de Estado, eleito diretamente por cinco anos, no máximo dois mandatos seguidos. Não governa: quem governa é o Governo,
          que responde perante o Parlamento. O seu poder do dia a dia é sobre as leis.
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          {POWERS.map((power) => (
            <div key={power.title}>
              <dt className="font-bold">{power.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed">{power.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="biografia" className="mt-12 max-w-3xl">
        <h2 id="biografia" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          Biografia
        </h2>
        <div className="flex flex-col gap-3 leading-relaxed">
          {lead.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        {rest.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-sm font-bold text-link underline">Ler a biografia completa</summary>
            <div className="mt-3 flex flex-col gap-3 leading-relaxed">
              {rest.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </details>
        )}
        {president.url && (
          <p className="mt-4 font-mono text-xs text-muted">
            Biografia oficial:{" "}
            <a href={president.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
              presidencia.pt<span className="sr-only"> (abre num novo separador)</span>
            </a>
          </p>
        )}
      </section>

      <div className="max-w-3xl">
        <RelatedArticles title="Nas notícias" articles={data.articles} />
      </div>

      {former.length > 0 && (
        <section aria-labelledby="anteriores" className="mt-12 max-w-3xl border-t border-line pt-6">
          <h2 id="anteriores" className="mb-3 font-mono text-sm font-bold uppercase tracking-widest text-muted">
            Presidentes anteriores
          </h2>
          <ul className="divide-y divide-line">
            {former.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                <span className="font-bold">{item.name}</span>
                <span className="font-mono text-xs text-muted">
                  {item.termStart.slice(0, 4)}–{item.termEnd?.slice(0, 4) ?? ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-sm">
            <Link href="/historia" className="text-link underline">
              Os Presidentes e os governos desde 1974
            </Link>
          </p>
        </section>
      )}
    </article>
  );
}

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts.at(-1)![0] : ""}`.toUpperCase();
};

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse justify-end rounded-2xl border border-line p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{formatNumber(value)}</dd>
    </div>
  );
}

function InitiativeGroup({
  id,
  title,
  items,
  empty,
  more,
}: {
  id: string;
  title: string;
  items: Initiative[];
  empty: string;
  more: "pending" | "vetoed" | "promulgated";
}) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-xl font-bold">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-muted">{empty}</p>
      ) : (
        <>
          <ul>
            {items.map((initiative) => (
              <li key={initiative.id}>
                <InitiativeItem initiative={initiative} heading="h4" />
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-sm">
            <Link href={`/iniciativas?presidente=${more}`} className="text-link underline">
              Ver todas<span className="sr-only">: {title.toLowerCase()}</span>
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
