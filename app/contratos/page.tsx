import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ContractList, ContractsSource, percentOf, Ranking } from "@/components/ContractViews";
import { CountUp } from "@/components/CountUp";
import { MoreContracts } from "@/components/MoreContracts";
import { ApiError } from "@/lib/api/client";
import {
  byCompetition,
  competitionOf,
  directAwardTotals,
  eurosScale,
  contractsLabel,
  formatEurosShort,
  getContracts,
  getContractStats,
  getPlaceName,
  getProcedureTotals,
  isNif,
  isPlaceKey,
  procedureFilter,
  share,
  type ContractQuery,
  type ContractStats,
} from "@/lib/api/contracts";
import { formatNumber, formatPercent } from "@/lib/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const PROCEDURE_OPTIONS = [
  { value: "direct_award", label: "Ajustes diretos" },
  { value: "direct_award_simplified", label: "Ajustes diretos simplificados" },
  { value: "prior_consultation", label: "Consulta prévia" },
  { value: "public_tender", label: "Concurso público" },
  { value: "limited_tender", label: "Concurso limitado" },
  { value: "framework_agreement", label: "Acordo-quadro" },
  { value: "todos", label: "Todos os procedimentos" },
];

const COMPETITION = [
  { key: "open", label: "Concorrência aberta", hint: "Concursos públicos e limitados", className: "bg-paper border border-ink" },
  { key: "limited", label: "Pouca ou nenhuma concorrência", hint: "Ajustes diretos e consultas prévias", className: "bg-ink" },
  { key: "other", label: "Outros", hint: "Acordos-quadro, contratação excluída e outros", className: "bg-muted" },
] as const;

async function placeName(key: string | undefined): Promise<string | null> {
  if (!key || !isPlaceKey(key)) return null;
  return getPlaceName(key).catch(() => null);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const name = await placeName(first((await searchParams).local));
  return name
    ? {
        title: `Contratos públicos e ajustes diretos em ${name}`,
        description: `Os contratos públicos executados em ${name}: quanto se gastou, por ajuste direto ou concurso, e quem ganhou.`,
        alternates: { canonical: "/contratos" },
      }
    : {
        title: "Contratos públicos e ajustes diretos",
        description:
          "Quantos contratos públicos são feitos por ajuste direto, sem concorrência aberta, quanto custam e quem os ganha. Dados do Portal BASE.",
        alternates: { canonical: "/contratos" },
      };
}

/** The first year with a meaningful number of contracts: a handful of stray older ones shouldn't set "since". */
function firstYear(stats: ContractStats | null): string | null {
  if (!stats || stats.items.length === 0) return null;
  const busiest = Math.max(...stats.items.map((item) => item.count));
  return stats.items.find((item) => item.count >= busiest / 100)?.key ?? null;
}

export default async function ContractsPage({ searchParams }: Props) {
  await connection();
  const params = await searchParams;
  const local = first(params.local);
  const place = local && isPlaceKey(local) ? local : undefined;
  const q = first(params.q)?.trim().slice(0, 200) || undefined;
  const filter = procedureFilter(first(params.tipo));
  const sort = first(params.ordem) === "preco" ? "price" : "date";
  const nif = (value: string | undefined) => (value && isNif(value) ? value : undefined);
  const entity = nif(first(params.entidade));
  const supplier = nif(first(params.fornecedor));
  const query: ContractQuery = { procedure: filter.procedure, q, place, entity, supplier, sort, limit: 20 };

  let procedures;
  try {
    procedures = await getProcedureTotals({ place });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return <ComingSoon />;
    throw error;
  }

  const [name, years, entities, suppliers, municipalities, page] = await Promise.all([
    placeName(place),
    getContractStats("year", { place }).catch(() => null),
    getContractStats("entity", { place, limit: 8 }).catch(() => null),
    getContractStats("supplier", { place, limit: 8 }).catch(() => null),
    place ? Promise.resolve(null) : getContractStats("municipality", { limit: 8 }).catch(() => null),
    getContracts(query).catch(() => null),
  ]);

  const direct = directAwardTotals(procedures);
  const scale = eurosScale(direct.total);
  const groups = byCompetition(procedures);
  const since = firstYear(years);
  const where = name ? ` em ${name}` : "";
  const maxYear = Math.max(0, ...(years?.items ?? []).map((item) => item.total));
  const updated = years ?? entities;

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Dinheiro público</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Contratos públicos{where}</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Todos os contratos que as entidades públicas publicam no Portal BASE: o que compraram, a quem e por quanto. Quanto vai para
          ajustes diretos, em que a entidade escolhe a empresa sem concurso aberto?
        </p>
        {name && (
          <p className="mt-3 font-mono text-sm">
            A ver os contratos executados em <strong>{name}</strong> ·{" "}
            <Link href="/contratos" className="text-link underline">
              ver o país todo
            </Link>
          </p>
        )}
      </header>

      <section aria-labelledby="contador" className="rounded-2xl border border-t-4 border-line border-t-ink p-6 sm:p-8">
        <h2 id="contador" className="font-mono text-xs uppercase tracking-widest text-muted">
          Ajustes diretos{where}
          {since ? ` desde ${since}` : ""}
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <p>
            <CountUp value={direct.count} className="block text-4xl font-bold leading-none sm:text-6xl" />
            <span className="mt-2 block text-muted">contratos sem concorrência aberta</span>
          </p>
          <p>
            <CountUp value={direct.total} divisor={scale.divisor} className="block text-4xl font-bold leading-none sm:text-6xl" />
            <span className="mt-2 block text-muted">{scale.unit} em ajustes diretos, sem IVA</span>
          </p>
        </div>
        <p className="mt-6 max-w-2xl leading-relaxed">
          São <strong>{formatPercent(direct.countShare)}</strong> dos {formatNumber(direct.allCount)} contratos publicados e{" "}
          <strong>{formatPercent(direct.totalShare)}</strong> dos {formatEurosShort(direct.allTotal)} gastos. O ajuste direto é legal dentro
          de limites de valor ou em casos previstos na lei, como urgência ou quando só uma empresa pode fazer o trabalho.
        </p>
      </section>

      <section aria-labelledby="como-se-gasta" className="mt-12">
        <h2 id="como-se-gasta" className="text-2xl font-bold">
          Como se gasta o dinheiro público
        </h2>
        <p className="mt-1 text-muted">Os euros de todos os contratos{where}, por tipo de procedimento.</p>
        <div aria-hidden="true" className="mt-4 flex h-6 overflow-hidden rounded-full border border-line">
          {COMPETITION.map((group) => (
            <div key={group.key} className={group.className} style={{ width: `${share(groups[group.key].total, direct.allTotal)}%` }} />
          ))}
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {COMPETITION.map((group) => (
            <li key={group.key} className="flex gap-2 text-sm">
              <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-full ${group.className}`} />
              <span>
                <span className="font-bold">{group.label}</span>: {percentOf(groups[group.key].total, direct.allTotal) ?? "0,0%"} do
                dinheiro
                <span className="block font-mono text-xs text-muted">{group.hint}</span>
              </span>
            </li>
          ))}
        </ul>

        <ul aria-label="Procedimentos" className="mt-6 grid gap-3 md:grid-cols-2">
          {procedures
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.kind} className="rounded-2xl border border-line p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold">{item.label}</h3>
                  <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums">
                    {formatEurosShort(item.total)}
                  </span>
                </div>
                <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${competitionOf(item.kind) === "limited" ? "bg-ink" : "bg-muted"}`}
                    style={{ width: `${Math.max(0.5, share(item.total, direct.allTotal))}%` }}
                  />
                </div>
                <p className="mt-1 font-mono text-xs text-muted">
                  {contractsLabel(item.count)} · {percentOf(item.total, direct.allTotal)} do dinheiro
                </p>
                {item.plain && <p className="mt-2 text-sm leading-relaxed">{item.plain}</p>}
              </li>
            ))}
        </ul>
      </section>

      {years && years.items.length > 0 && (
        <section aria-labelledby="por-ano" className="mt-12">
          <h2 id="por-ano" className="text-2xl font-bold">
            Por ano
          </h2>
          <p className="mt-1 text-muted">Todos os procedimentos, pela data de publicação.</p>
          <ul className="mt-4 space-y-3">
            {years.items.map((item) => (
              <li key={item.key} className="grid grid-cols-[3.5rem_1fr] items-center gap-3 text-sm">
                <span className="font-mono font-bold">{item.label}</span>
                <span>
                  <span aria-hidden="true" className="block h-4 rounded bg-surface">
                    <span className="block h-full rounded bg-ink" style={{ width: `${Math.max(0.5, share(item.total, maxYear))}%` }} />
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-muted">
                    {formatEurosShort(item.total)} · {contractsLabel(item.count)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="quem" className="mt-12">
        <h2 id="quem" className="text-2xl font-bold">
          Quem contrata e quem recebe
        </h2>
        <p className="mt-1 text-muted">Os maiores valores{where}, em todos os procedimentos.</p>
        <div className={`mt-4 grid gap-4 ${municipalities ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
          <Ranking
            title="Entidades públicas que mais contrataram"
            items={entities?.items ?? []}
            href={(key) => (isNif(key) ? `/contratos/entidade/${key}` : null)}
          />
          <Ranking
            title="Empresas e pessoas que mais receberam"
            items={suppliers?.items ?? []}
            href={(key) => (isNif(key) ? `/contratos/entidade/${key}` : null)}
          />
          {municipalities && (
            <Ranking
              title="Concelhos onde mais se contratou"
              items={municipalities.items}
              href={(key) => (isPlaceKey(key) ? `/contratos?local=${key}#lista` : null)}
              note="Lisboa e Porto aparecem à frente em parte porque muitos organismos nacionais têm lá sede e indicam-nas como local de execução. Um contrato executado em vários concelhos conta em cada um."
            />
          )}
        </div>
      </section>

      <section aria-labelledby="lista-titulo" id="lista" className="mt-12 scroll-mt-20">
        <h2 id="lista-titulo" className="text-2xl font-bold">
          Procurar contratos
        </h2>
        <form
          method="get"
          action="/contratos#lista"
          className="mt-4 grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          {place && <input type="hidden" name="local" value={place} />}
          {entity && <input type="hidden" name="entidade" value={entity} />}
          {supplier && <input type="hidden" name="fornecedor" value={supplier} />}
          <label className="block">
            <span className="mb-1 block font-mono text-xs text-muted">O que foi comprado</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="ex.: refeições escolares"
              className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-xs text-muted">Procedimento</span>
            <select
              name="tipo"
              defaultValue={filter.value}
              className="w-full rounded-full border border-line bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
            >
              {PROCEDURE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-xs text-muted">Ordem</span>
            <select
              name="ordem"
              defaultValue={sort === "price" ? "preco" : "data"}
              className="w-full rounded-full border border-line bg-paper px-3 py-2 text-sm focus:border-ink focus:outline-none"
            >
              <option value="data">Mais recentes</option>
              <option value="preco">Mais caros</option>
            </select>
          </label>
          <button type="submit" className="self-end rounded-full bg-ink px-5 py-2 font-mono text-sm font-bold text-paper hover:opacity-90">
            Procurar
          </button>
        </form>

        {(entity || supplier) && (
          <p className="mt-3 font-mono text-sm">
            Só contratos {entity ? "adjudicados por" : "ganhos por"}{" "}
            <Link href={`/contratos/entidade/${entity ?? supplier}`} className="text-link underline">
              NIF {entity ?? supplier}
            </Link>{" "}
            ·{" "}
            <Link href={place ? `/contratos?local=${place}#lista` : "/contratos#lista"} className="text-link underline">
              tirar filtro
            </Link>
          </p>
        )}
        <div className="mt-4">
          {page === null ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
              Não foi possível carregar os contratos.
            </p>
          ) : page.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhum contrato com estes filtros.</p>
          ) : (
            <>
              <ContractList contracts={page.items} label="Contratos" />
              <MoreContracts key={JSON.stringify(query)} query={query} cursor={page.nextCursor} />
            </>
          )}
        </div>
      </section>

      <ContractsSource updatedAt={updated?.updatedAt} source={updated?.source} />
    </div>
  );
}

function ComingSoon() {
  return (
    <div data-wide>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Contratos públicos</h1>
      <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
        Os contratos estarão disponíveis em breve.
      </p>
    </div>
  );
}
