import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ContractRankings } from "@/components/ContractRankings";
import { COMPETITION_COLOR, ContractList, ContractsSource, percentOf } from "@/components/ContractViews";
import { CountUp } from "@/components/CountUp";
import { MoreContracts } from "@/components/MoreContracts";
import { ApiError } from "@/lib/api/client";
import {
  byCompetition,
  competitionOf,
  directAwardTotals,
  eurosScale,
  contractsLabel,
  formatEurosCompact,
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
  { key: "open", label: "Concorrência aberta", hint: "Concursos públicos e limitados" },
  { key: "limited", label: "Pouca ou nenhuma concorrência", hint: "Ajustes diretos e consultas prévias" },
  { key: "other", label: "Outros", hint: "Acordos-quadro, contratação excluída e outros" },
] as const;

const MARKER = "bg-[linear-gradient(transparent_55%,var(--marker)_55%,var(--marker)_92%,transparent_92%)] px-1";

/** A share in words: "quase metade", "um décimo"… for the headline over the two bars. */
function shareWords(value: number): string {
  if (value >= 55) return "mais de metade";
  if (value >= 45) return "quase metade";
  if (value >= 30) return "cerca de um terço";
  if (value >= 20) return "cerca de um quarto";
  if (value >= 8) return "uma pequena parte";
  return "uma parte muito pequena";
}

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
      <header className="mb-6">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Dinheiro público · Portal BASE</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Contratos <span className={MARKER}>públicos</span>
          {where}
        </h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Tudo o que as entidades públicas publicam no Portal BASE: o que compraram, a quem e por quanto. E quanto vai para ajustes diretos,
          em que a entidade escolhe a empresa sem concurso aberto.
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

      <section aria-labelledby="contador">
        <h2 id="contador" className="sr-only">
          Ajustes diretos{where}
          {since ? ` desde ${since}` : ""}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Contratos publicados</p>
            <CountUp value={direct.allCount} className="mt-2 block text-3xl font-bold leading-none tabular-nums sm:text-4xl" />
            <p className="mt-2 font-mono text-[11px] text-muted">
              {formatEurosShort(direct.allTotal)}
              {since ? ` desde ${since}` : ""}
            </p>
          </div>
          <div
            className="rounded-2xl border p-5"
            style={{
              borderColor: COMPETITION_COLOR.limited,
              backgroundColor: `color-mix(in srgb, ${COMPETITION_COLOR.limited} 8%, transparent)`,
            }}
          >
            <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: COMPETITION_COLOR.limited }}>
              Ajustes diretos
            </p>
            <CountUp value={direct.count} className="mt-2 block text-3xl font-bold leading-none tabular-nums sm:text-4xl" />
            <p className="mt-2 font-mono text-[11px] text-muted">contratos sem concorrência aberta · {formatPercent(direct.countShare)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--stage-debate)]/50 bg-[color-mix(in_srgb,var(--marker)_14%,transparent)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[color:var(--stage-debate)]">Em ajustes diretos</p>
            <p className="mt-2 flex items-baseline gap-2">
              <CountUp value={direct.total} divisor={scale.divisor} className="text-3xl font-bold leading-none tabular-nums sm:text-4xl" />
              <span className="font-mono text-sm font-bold">{scale.unit}</span>
            </p>
            <p className="mt-2 font-mono text-[11px] text-muted">sem IVA · {formatPercent(direct.totalShare)} do dinheiro</p>
          </div>
        </div>

        <div className="mt-3 grid gap-5 rounded-2xl border border-line p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div>
            <h3 className="text-xl font-bold leading-snug">
              {(() => {
                const many = shareWords(direct.countShare);
                return `${many.charAt(0).toUpperCase()}${many.slice(1)} dos contratos, mas só ${shareWords(direct.totalShare)} do dinheiro`;
              })()}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Os ajustes diretos são sobretudo compras pequenas. O ajuste direto é legal dentro de limites de valor ou em casos previstos na
              lei, como urgência ou quando só uma empresa pode fazer o trabalho.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { label: "Do número de contratos", value: direct.countShare },
              { label: "Do dinheiro gasto", value: direct.totalShare },
            ].map((bar) => (
              <div key={bar.label}>
                <p className="flex justify-between gap-2 font-mono text-xs">
                  <span className="text-muted">{bar.label}</span>
                  <span className="font-bold">{formatPercent(bar.value)}</span>
                </p>
                <div aria-hidden="true" className="mt-1 h-2.5 rounded-full bg-surface">
                  <div className="h-full rounded-full" style={{ width: `${bar.value}%`, backgroundColor: COMPETITION_COLOR.limited }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="como-se-gasta" className="mt-12">
        <h2 id="como-se-gasta" className="border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          Como se gasta o dinheiro público
        </h2>
        <p className="mt-2 text-sm text-muted">Os euros de todos os contratos{where}, por tipo de procedimento.</p>
        <div aria-hidden="true" className="mt-4 flex h-7 overflow-hidden rounded-lg">
          {COMPETITION.map((group) => {
            const value = share(groups[group.key].total, direct.allTotal);
            return (
              <div
                key={group.key}
                className="flex items-center overflow-hidden px-2 font-mono text-[11px] font-bold text-paper"
                style={{ width: `${value}%`, backgroundColor: COMPETITION_COLOR[group.key] }}
              >
                {value >= 8 && formatPercent(value)}
              </div>
            );
          })}
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {COMPETITION.map((group) => (
            <li key={group.key} className="flex gap-2 text-sm">
              <span
                aria-hidden="true"
                className="mt-1 size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: COMPETITION_COLOR[group.key] }}
              />
              <span>
                <span className="font-bold">{group.label}</span>: {percentOf(groups[group.key].total, direct.allTotal) ?? "0,0%"} do
                dinheiro
                <span className="block font-mono text-xs text-muted">{group.hint}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_5.5rem_7rem] gap-3 border-b border-line pb-2 font-mono text-[11px] text-muted">
          <span>Procedimento · faixa: parte do dinheiro</span>
          <span className="text-right">Contratos</span>
          <span className="text-right">Valor</span>
        </div>
        <ul aria-label="Procedimentos" className="divide-y divide-line">
          {procedures
            .filter((item) => item.count > 0)
            .map((item) => {
              const competition = competitionOf(item.kind);
              const highlight = item.kind === "direct_award";
              return (
                <li
                  key={item.kind}
                  className={`grid grid-cols-[minmax(0,1fr)_5.5rem_7rem] items-start gap-3 py-3 ${highlight ? "-mx-3 rounded-lg px-3" : ""}`}
                  style={highlight ? { backgroundColor: `color-mix(in srgb, ${COMPETITION_COLOR.limited} 8%, transparent)` } : undefined}
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold">
                      {item.label}{" "}
                      <span className="font-mono text-[11px] font-normal text-muted">
                        · {percentOf(item.total, direct.allTotal)} do dinheiro
                      </span>
                    </h3>
                    <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-full bg-surface">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0.5, share(item.total, direct.allTotal))}%`,
                          backgroundColor: COMPETITION_COLOR[competition],
                        }}
                      />
                    </div>
                    {item.plain && <p className={`mt-2 text-xs leading-relaxed ${highlight ? "" : "text-muted"}`}>{item.plain}</p>}
                  </div>
                  <span className="text-right font-mono text-xs tabular-nums text-muted">{formatNumber(item.count)}</span>
                  <span className="whitespace-nowrap text-right font-mono text-sm font-bold tabular-nums">
                    {formatEurosShort(item.total)}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      {years && years.items.length > 0 && (
        <section aria-labelledby="por-ano" className="mt-12">
          <h2 id="por-ano" className="border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
            Por ano
          </h2>
          <ul className="mt-6 flex items-end gap-3">
            {years.items.slice(-6).map((item, index, shown) => {
              const current = item.key === String(new Date().getFullYear());
              const last = index === shown.length - 1;
              return (
                <li key={item.key} className="flex min-w-0 flex-1 flex-col">
                  <span className="mb-1 text-lg font-bold tabular-nums sm:text-2xl">{formatEurosCompact(item.total)}</span>
                  <span
                    aria-hidden="true"
                    className={`block rounded-t-lg ${current ? "" : last ? "bg-ink/80" : "bg-muted/40"}`}
                    style={{
                      height: `${Math.max(6, share(item.total, maxYear) * 1.6)}px`,
                      ...(current
                        ? {
                            backgroundImage: "repeating-linear-gradient(135deg, var(--stage-debate) 0 6px, transparent 6px 12px)",
                            border: "1px solid var(--stage-debate)",
                          }
                        : {}),
                    }}
                  />
                  <span className="mt-2 font-mono text-xs font-bold">
                    {item.label}
                    {current && <span className="font-normal text-muted"> · até agora</span>}
                  </span>
                  <span className="font-mono text-[11px] text-muted">{contractsLabel(item.count)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-mono text-[11px] text-muted">
            Todos os procedimentos, pela data de publicação. O ano corrente ainda não acabou.
          </p>
        </section>
      )}

      <section aria-labelledby="quem" className="mt-12">
        <h2 id="quem" className="mb-4 border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
          Quem contrata e quem recebe
        </h2>
        <ContractRankings
          tabs={[
            {
              key: "entidades",
              label: "Entidades",
              title: `As entidades públicas que mais contrataram${where}, em valor.`,
              items: entities?.items ?? [],
              hrefs: (entities?.items ?? []).map((item) => (isNif(item.key) ? `/contratos/entidade/${item.key}` : null)),
            },
            {
              key: "empresas",
              label: "Empresas",
              title: `As empresas e pessoas que mais receberam${where}.`,
              items: suppliers?.items ?? [],
              hrefs: (suppliers?.items ?? []).map((item) => (isNif(item.key) ? `/contratos/entidade/${item.key}` : null)),
            },
            ...(municipalities
              ? [
                  {
                    key: "concelhos",
                    label: "Concelhos",
                    title: "Os concelhos onde mais se contratou.",
                    items: municipalities.items,
                    hrefs: municipalities.items.map((item) => (isPlaceKey(item.key) ? `/contratos?local=${item.key}#lista` : null)),
                    note: "Lisboa e Porto aparecem à frente em parte porque muitos organismos nacionais têm lá sede e indicam-nas como local de execução. Um contrato executado em vários concelhos conta em cada um.",
                  },
                ]
              : []),
          ]}
        />
      </section>

      <section aria-labelledby="lista-titulo" id="lista" className="mt-12 scroll-mt-20">
        <h2 id="lista-titulo" className="border-b-2 border-ink pb-2 font-mono text-sm font-bold uppercase tracking-widest">
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
          <button
            type="submit"
            className="self-end rounded-full bg-[#f0c75e] px-5 py-2 font-mono text-sm font-bold text-[#1a1a1a] hover:opacity-90"
          >
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
