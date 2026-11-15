import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CaseCard } from "@/components/Records";
import { type CasePage, type Glossary, getCaseGlossary, getCases } from "@/lib/api/cases";
import { getParties } from "@/lib/api/client";
import { CONTACT_EMAIL } from "@/lib/site";
import type { Party } from "@/lib/types";

const PAGE_SIZE = 20;

type Search = { partido?: string | string[]; fase?: string | string[]; crime?: string | string[]; pagina?: string | string[] };
type Props = { searchParams: Promise<Search> };

const one = (value: string | string[] | undefined) => (typeof value === "string" && /^[a-z0-9_-]{1,40}$/.test(value) ? value : null);
const pageOf = (value: unknown) => (typeof value === "string" && /^[1-9]\d{0,3}$/.test(value) ? Number(value) : 1);

type Filters = { party: string | null; status: string | null; crime: string | null };

function pathOf({ party, status, crime }: Filters, page = 1) {
  const query = new URLSearchParams();
  if (party) query.set("partido", party);
  if (status) query.set("fase", status);
  if (crime) query.set("crime", crime);
  if (page > 1) query.set("pagina", String(page));
  return query.size > 0 ? `/registo?${query}` : "/registo";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const search = await searchParams;
  const filtered = Boolean(one(search.partido) || one(search.fase) || one(search.crime));
  return {
    title: "Registo de processos judiciais de titulares de cargos políticos",
    description:
      "Processos por corrupção, tráfico de influência, peculato e outros crimes que envolvem titulares de cargos políticos: a fase de cada processo, com fontes. Todos se presumem inocentes até decisão definitiva.",
    alternates: { canonical: "/registo" },
    // Filtered views repeat the same entries.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const EMPTY_GLOSSARY: Glossary = { crimes: [], caseStatuses: [], personStatuses: [], interestKinds: [] };

async function load(filters: Filters, page: number): Promise<[CasePage, Glossary, Party[]]> {
  return Promise.all([
    getCases({
      party: filters.party ?? undefined,
      status: filters.status ?? undefined,
      crime: filters.crime ?? undefined,
      page,
      limit: PAGE_SIZE,
    }).catch(() => ({ items: [], total: 0 })),
    getCaseGlossary().catch(() => EMPTY_GLOSSARY),
    getParties().catch(() => []),
  ]);
}

export default async function RecordPage({ searchParams }: Props) {
  await connection();
  const search = await searchParams;
  const filters: Filters = { party: one(search.partido), status: one(search.fase), crime: one(search.crime) };
  const page = pageOf(search.pagina);
  const [{ items, total }, glossary, parties] = await load(filters, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(filters.party || filters.status || filters.crime);
  const select = "w-full rounded-full border border-line bg-paper px-3 py-1.5 text-sm";

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Registo</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Processos judiciais de titulares de cargos políticos</h1>
        <div className="mt-3 max-w-3xl space-y-2 text-muted">
          <p>
            Processos por corrupção e crimes semelhantes que envolvem quem ocupa ou ocupou cargos políticos. Cada entrada é escrita pela
            redação a partir de fontes públicas, com os tribunais e as fontes oficiais primeiro, e diz em que fase está o processo.
          </p>
          <p>
            <strong className="text-ink">Todos se presumem inocentes</strong> até haver uma condenação transitada em julgado. Uma
            investigação ou uma acusação não é uma condenação. Não fazemos classificações de pessoas.
          </p>
          <p className="text-sm">
            Encontraste um erro ou és visado?{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Pedido de correção: registo")}`}
              className="text-link underline"
            >
              Pede uma correção
            </a>
            .
          </p>
        </div>
      </header>

      {glossary.caseStatuses.length > 0 && (
        <section aria-labelledby="como-funciona" className="mb-10 rounded-2xl bg-surface p-5">
          <h2 id="como-funciona" className="font-mono text-sm font-bold uppercase tracking-widest">
            Como funciona um processo
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {glossary.caseStatuses.map((status, index) => (
              <li key={status.key} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-bold text-paper"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="font-bold leading-snug">{status.label}</p>
                  {status.plain && <p className="text-sm text-muted">{status.plain}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(total > 0 || filtered) && (
        <form action="/registo" className="mb-6 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block font-mono text-xs text-muted">Partido à data</span>
            <select name="partido" defaultValue={filters.party ?? ""} className={select}>
              <option value="">Todos</option>
              {parties.map((party) => (
                <option key={party.slug} value={party.slug}>
                  {party.acronym}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-mono text-xs text-muted">Fase</span>
            <select name="fase" defaultValue={filters.status ?? ""} className={select}>
              <option value="">Todas</option>
              {glossary.caseStatuses.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-mono text-xs text-muted">Crime</span>
            <select name="crime" defaultValue={filters.crime ?? ""} className={select}>
              <option value="">Todos</option>
              {glossary.crimes.map((crime) => (
                <option key={crime.key} value={crime.key}>
                  {crime.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-full bg-ink px-4 py-1.5 font-mono text-sm font-bold text-paper">
            Filtrar
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {filtered || page > 1 ? (
            <p>
              Nenhum processo com estes filtros.{" "}
              <Link href="/registo" className="text-link underline">
                Ver todos
              </Link>
            </p>
          ) : (
            <>
              <p className="font-bold text-ink">O registo ainda não tem entradas publicadas.</p>
              <p className="mx-auto mt-1 max-w-xl text-sm">
                Cada processo só é publicado depois de revisto, com pelo menos uma fonte e, para qualquer decisão de um tribunal, uma fonte
                judicial ou oficial.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 font-mono text-xs text-muted" aria-live="polite">
            {total === 1 ? "1 processo" : `${total} processos`}, por data do último desenvolvimento
          </p>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <CaseCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-8 flex items-center justify-between font-mono text-sm">
          {page > 1 ? (
            <Link href={pathOf(filters, page - 1)} rel="prev" className="text-link underline">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={pathOf(filters, page + 1)} rel="next" className="text-link underline">
              Seguintes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <p className="mt-10 border-t border-line pt-4 font-mono text-xs text-muted">
        Registo editorial do Politicando, com fontes em cada entrada. Ver também os{" "}
        <Link href="/interesses" className="underline">
          interesses declarados
        </Link>{" "}
        de titulares de cargos.
      </p>
    </div>
  );
}
