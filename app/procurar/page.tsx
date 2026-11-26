import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteSearchBox } from "@/components/SiteSearchBox";
import { searchSite, type SearchGroup } from "@/lib/siteSearch";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "Procurar",
  description: "Procura pessoas, sítios, partidos, notícias, iniciativas, o Orçamento, contratos públicos e o fórum.",
  alternates: { canonical: "/procurar" },
  // A search is the site's own pages again: kept out of the index.
  robots: { index: false, follow: true },
};

const SHOWN = 5;

function Group({ group }: { group: SearchGroup }) {
  const id = `resultados-${group.key}`;
  return (
    <section aria-labelledby={id} className="mb-6">
      <h2 id={id} className="border-b-2 border-ink pb-1 font-mono text-xs font-bold uppercase tracking-widest">
        {group.label}
      </h2>
      <ul className="mt-1 flex flex-col">
        {group.hits.map((hit) => (
          <li key={`${hit.title}|${hit.href}`} className="border-b border-line">
            <Link href={hit.href} className="group block py-2">
              <span className="block font-serif text-lg font-bold leading-snug [overflow-wrap:anywhere] group-hover:underline">
                {hit.title}
              </span>
              {hit.meta && <span className="block font-mono text-[11px] text-muted [overflow-wrap:anywhere]">{hit.meta}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {group.more && group.hits.length >= SHOWN && (
        <Link href={group.more} className="mt-2 inline-block font-mono text-xs font-bold underline">
          Ver mais em {group.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  await connection();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const result = q ? await searchSite(q) : null;
  return (
    <div data-wide className="max-w-3xl">
      <h1 className="font-serif text-3xl font-bold">Procurar</h1>
      <div className="mt-4">
        <SiteSearchBox defaultValue={q} autoFocus={!q} />
      </div>
      {!result && (
        <p className="mt-4 text-sm text-muted">
          Procura deputados, eleitos das câmaras, assembleias e juntas, distritos, concelhos e freguesias, partidos, notícias, iniciativas
          no Parlamento, propostas ao Orçamento, contratos públicos e conversas do fórum.
        </p>
      )}
      {result?.state === "too_short" && <p className="mt-4 text-sm text-muted">Escreve pelo menos 3 letras.</p>}
      {result?.state === "error" && (
        <p role="alert" className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
          Não foi possível procurar agora. Tenta daqui a pouco.
        </p>
      )}
      {result?.state === "done" && result.groups.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nada encontrado para «{q}».</p>
      )}
      {result?.state === "done" && result.groups.length > 0 && (
        <div className="mt-6">
          {result.groups.map((group) => (
            <Group key={group.key} group={group} />
          ))}
        </div>
      )}
      <p className="mt-6 font-mono text-[11px] text-muted">
        Os eleitos locais são os das últimas autárquicas, segundo o mapa oficial da CNE; substituições posteriores não estão refletidas.
      </p>
    </div>
  );
}
