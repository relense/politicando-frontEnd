import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { TermLabel } from "@/components/Records";
import { type Interest, getInterests } from "@/lib/api/cases";
import { formatDate } from "@/lib/format";
import { formatEuros } from "@/lib/records";
import { CONTACT_EMAIL } from "@/lib/site";
import { FEATURES } from "@/lib/features";
import { notFound } from "next/navigation";

type Props = { searchParams: Promise<{ deputado?: string | string[]; membro?: string | string[] }> };

type Filter = { deputy: number | null; member: string | null };

function filterOf(search: Awaited<Props["searchParams"]>): Filter {
  const deputy = typeof search.deputado === "string" && /^\d{1,9}$/.test(search.deputado) ? Number(search.deputado) : null;
  const member = typeof search.membro === "string" && /^[0-9a-f]{32}$/.test(search.membro) ? search.membro : null;
  return { deputy, member: deputy === null ? member : null };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (!FEATURES.record) notFound();
  const filter = filterOf(await searchParams);
  const personal = filter.deputy !== null || filter.member !== null;
  return {
    title: personal ? "Interesses declarados" : "Empresas de titulares de cargos políticos com contratos públicos",
    description:
      "Empresas, participações e cargos declarados por titulares de cargos políticos, e os contratos públicos que essas entidades ganharam, segundo o Portal BASE.",
    alternates: { canonical: "/interesses" },
    robots: personal ? { index: false, follow: true } : undefined,
  };
}

const contractsLabel = (count: number) => (count === 1 ? "1 contrato público" : `${count} contratos públicos`);

function InterestCard({ item }: { item: Interest }) {
  const personHref =
    item.deputyId !== null ? `/deputados/${item.deputyId}` : item.governmentMemberId ? `/governo/${item.governmentMemberId}` : null;
  const person = personHref ? (
    <Link href={personHref} className="font-bold underline">
      {item.personName}
    </Link>
  ) : (
    <strong>{item.personName}</strong>
  );
  const entity = item.nif ? (
    <Link href={`/contratos/entidade/${item.nif}`} className="font-bold underline">
      {item.entityName}
    </Link>
  ) : (
    <strong>{item.entityName}</strong>
  );
  const period = [item.startDate && `desde ${formatDate(item.startDate)}`, item.endDate && `até ${formatDate(item.endDate)}`]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="rounded-2xl border border-line p-5">
      <p className="font-mono text-xs text-muted">
        <TermLabel term={item.kind} />
        {item.nif && <span> · NIF {item.nif}</span>}
      </p>
      <h2 className="mt-1 text-lg font-bold leading-snug">{item.entityName}</h2>
      <p className="mt-2 text-sm">
        Declarado por {person}
        {period && <span className="text-muted"> ({period})</span>}.
      </p>
      {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
      {item.contracts && (
        <p className="mt-3 rounded-xl bg-surface p-3 text-sm">
          {item.contracts.won.count === 0 ? (
            <>{entity} não ganhou contratos públicos nos dados do Portal BASE (desde 2024).</>
          ) : (
            <>
              A entidade {entity}, declarada por {item.personName}, ganhou {contractsLabel(item.contracts.won.count)} (
              {formatEuros(item.contracts.won.total)}).
              {item.contracts.duringInterest && (
                <>
                  {" "}
                  Enquanto o interesse estava declarado: {contractsLabel(item.contracts.duringInterest.count)} (
                  {formatEuros(item.contracts.duringInterest.total)}).
                </>
              )}{" "}
              {item.nif && (
                <Link href={`/contratos?fornecedor=${item.nif}`} className="font-mono text-xs text-link underline">
                  Ver contratos
                </Link>
              )}
            </>
          )}
        </p>
      )}
      <p className="mt-3 font-mono text-xs text-muted">
        {item.declaredAt && <span>Declarado a {formatDate(item.declaredAt)} · </span>}
        {item.source.url ? (
          <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="text-link underline">
            {item.source.title ?? "Declaração"}
            <span className="sr-only"> (abre num novo separador)</span>
          </a>
        ) : (
          (item.source.title ?? "Declaração")
        )}
      </p>
    </article>
  );
}

export default async function InterestsPage({ searchParams }: Props) {
  if (!FEATURES.record) notFound();
  await connection();
  const filter = filterOf(await searchParams);
  const personal = filter.deputy !== null || filter.member !== null;
  const items = await getInterests({ deputy: filter.deputy ?? undefined, member: filter.member ?? undefined }).catch(() => []);
  const name = personal ? items[0]?.personName : null;

  return (
    <div data-wide>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">Interesses declarados</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {personal ? `Interesses declarados${name ? ` por ${name}` : ""}` : "Empresas de titulares de cargos com contratos públicos"}
        </h1>
        <div className="mt-3 max-w-3xl space-y-2 text-muted">
          <p>
            Empresas, participações sociais, cargos e clientes que titulares de cargos políticos declararam à Entidade para a Transparência,
            copiados das declarações e ligados a cada uma. Quando sabemos o NIF da entidade, mostramos os contratos públicos que ganhou.
          </p>
          <p>
            Ganhar contratos públicos não é ilegal, e a maioria destes contratos é legal. Mostramos os factos e as fontes; cada leitor tira
            as suas conclusões.
          </p>
          {personal && (
            <p>
              <Link href="/interesses" className="text-link underline">
                Ver todas as empresas com contratos públicos
              </Link>
            </p>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          {personal ? "Sem interesses declarados publicados para esta pessoa." : "Ainda não há interesses declarados publicados."}
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <InterestCard item={item} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 border-t border-line pt-4 font-mono text-xs text-muted">
        Fontes: declarações na Entidade para a Transparência; contratos do Portal BASE / IMPIC (desde 2024), sem IVA. Algum erro?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Pedido de correção: interesses declarados")}`}
          className="underline"
        >
          Pede uma correção
        </a>
        .
      </p>
    </div>
  );
}
