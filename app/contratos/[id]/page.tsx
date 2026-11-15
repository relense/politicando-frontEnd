import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { cache } from "react";
import { ContractsSource, PartyName, ProcedureBadge } from "@/components/ContractViews";
import { ApiError } from "@/lib/api/client";
import { formatEuros, getContract, isContractId } from "@/lib/api/contracts";
import { formatLongDate, formatNumber } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

/** One request per page, shared by the metadata and the page. Null when there is no such contract. */
const loadContract = cache(async (id: string) => {
  if (!isContractId(id)) return null;
  try {
    return await getContract(id);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const contract = await loadContract((await params).id);
  if (!contract) return { title: "Contrato não encontrado" };
  const entity = contract.entities[0]?.name;
  const supplier = contract.suppliers[0]?.name;
  return {
    title: clip(contract.object, 70),
    description: clip(
      `${contract.procedure.label}${entity ? ` de ${entity}` : ""}${supplier ? ` a ${supplier}` : ""}${
        contract.price !== null ? `, por ${formatEuros(contract.price)} sem IVA` : ""
      }. ${contract.object}`,
      160,
    ),
    alternates: { canonical: `/contratos/${contract.id}` },
  };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="font-mono text-xs text-muted sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function ContractPage({ params }: Props) {
  await connection();
  const contract = await loadContract((await params).id);
  if (!contract) notFound();
  const direct = contract.procedure.kind.startsWith("direct_award");

  return (
    <article className="mx-auto max-w-3xl pb-4" data-wide>
      <Link href="/contratos" className="mb-6 inline-block font-mono text-sm text-muted hover:text-ink hover:underline">
        ← Contratos públicos
      </Link>

      <header className="rounded-2xl border border-t-4 border-line border-t-ink p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProcedureBadge kind={contract.procedure.kind} label={contract.procedure.label} />
          {contract.contractTypes.map((type) => (
            <span key={type} className="font-mono text-xs text-muted">
              {type}
            </span>
          ))}
        </div>
        <h1 className="mt-3 break-words text-xl font-bold leading-snug sm:text-2xl">{contract.object}</h1>
        {contract.description && <p className="mt-3 leading-relaxed">{contract.description}</p>}
        <p className="mt-4 text-3xl font-bold tabular-nums">
          {contract.price === null ? "Preço não publicado" : formatEuros(contract.price)}
          {contract.price !== null && <span className="ml-2 font-mono text-sm font-normal text-muted">sem IVA</span>}
        </p>
        {contract.baseUrl && (
          <a
            href={contract.baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-full border border-line px-4 py-2 font-mono text-sm font-bold hover:bg-surface"
          >
            Ver no Portal BASE<span className="sr-only"> (abre noutra janela)</span>
          </a>
        )}
      </header>

      {contract.procedureExplained && (
        <section aria-labelledby="procedimento" className="mt-6 rounded-2xl bg-surface p-5">
          <h2 id="procedimento" className="font-bold">
            O que é {direct ? "um ajuste direto" : `“${contract.procedure.label}”`}?
          </h2>
          <p className="mt-2 leading-relaxed">{contract.procedureExplained}</p>
          {contract.directAwardReason && (
            <p className="mt-2 leading-relaxed">
              <span className="font-bold">Motivo indicado:</span> {contract.directAwardReason}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="detalhes" className="mt-8">
        <h2 id="detalhes" className="text-xl font-bold">
          Detalhes
        </h2>
        <dl className="mt-3">
          <Row label="Quem contratou">
            {contract.entities.length === 0
              ? "Não publicado"
              : contract.entities.map((party, index) => (
                  <span key={`${party.nif}-${index}`} className="block">
                    <PartyName party={party} />
                  </span>
                ))}
          </Row>
          <Row label="Adjudicado a">
            {contract.suppliers.length === 0
              ? "Não publicado"
              : contract.suppliers.map((party, index) => (
                  <span key={`${party.nif}-${index}`} className="block">
                    <PartyName party={party} />
                  </span>
                ))}
          </Row>
          <Row label="Preço contratual">{contract.price === null ? "Não publicado" : formatEuros(contract.price)}</Row>
          {contract.basePrice !== null && <Row label="Preço base">{formatEuros(contract.basePrice)} (o máximo que podia custar)</Row>}
          <Row label="Preço efetivo">
            {contract.effectivePrice === null
              ? "Ainda não publicado (o contrato pode não ter terminado)"
              : formatEuros(contract.effectivePrice)}
          </Row>
          {contract.procedure.published && contract.procedure.published !== contract.procedure.label && (
            <Row label="Procedimento publicado">{contract.procedure.published}</Row>
          )}
          {contract.invited !== null && <Row label="Empresas convidadas">{formatNumber(contract.invited)}</Row>}
          {contract.frameworkAgreement && <Row label="Acordo-quadro">{contract.frameworkAgreement}</Row>}
          {contract.centralized && <Row label="Compra centralizada">Feita através de uma central de compras</Row>}
          {contract.cpv && (
            <Row label="Categoria (CPV)">
              {contract.cpv.description ?? "—"} <span className="font-mono text-xs text-muted">{contract.cpv.code}</span>
            </Row>
          )}
          {contract.legalBasis && <Row label="Fundamento legal">{contract.legalBasis}</Row>}
          {contract.signedAt && <Row label="Assinado a">{formatLongDate(contract.signedAt)}</Row>}
          {contract.publishedAt && <Row label="Publicado a">{formatLongDate(contract.publishedAt)}</Row>}
          {contract.deadlineDays !== null && <Row label="Prazo de execução">{formatNumber(contract.deadlineDays)} dias</Row>}
          {(contract.municipalities.length > 0 || contract.places.length > 0) && (
            <Row label="Local de execução">
              {contract.municipalities.length > 0
                ? contract.municipalities.map((place, index) => (
                    <span key={place.key}>
                      {index > 0 && ", "}
                      <Link href={`/sitios/${place.key}`} className="text-link underline-offset-2 hover:underline">
                        {place.name}
                      </Link>
                    </span>
                  ))
                : contract.places.join("; ")}
            </Row>
          )}
          {contract.status && <Row label="Estado">{contract.status}</Row>}
          {contract.documentsUrl && (
            <Row label="Peças do procedimento">
              <a href={contract.documentsUrl} target="_blank" rel="noopener noreferrer" className="text-link underline">
                Ver documentos<span className="sr-only"> (abre noutra janela)</span>
              </a>
            </Row>
          )}
        </dl>
      </section>

      <ContractsSource />
    </article>
  );
}
