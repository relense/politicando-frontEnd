import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { ContractList, ContractsSource, percentOf, Ranking } from "@/components/ContractViews";
import { ApiError } from "@/lib/api/client";
import { contractsLabel, formatEurosShort, getContractParty, isNif, type ContractSide } from "@/lib/api/contracts";
import { formatNumber } from "@/lib/format";

type Props = { params: Promise<{ nif: string }> };

const loadParty = cache(async (nif: string) => {
  if (!isNif(nif)) return null;
  try {
    return await getContractParty(nif);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const party = await loadParty((await params).nif);
  if (!party) return { title: "Entidade não encontrada" };
  const parts = [
    party.asEntity.count > 0 && `${contractsLabel(party.asEntity.count)} adjudicados (${formatEurosShort(party.asEntity.total)})`,
    party.asSupplier.count > 0 && `${contractsLabel(party.asSupplier.count)} ganhos (${formatEurosShort(party.asSupplier.total)})`,
  ].filter(Boolean);
  return {
    title: `${party.name}: contratos públicos`,
    description: `${party.name} no Portal BASE: ${parts.join(" e ")}, ajustes diretos e principais parceiros.`,
    alternates: { canonical: `/contratos/entidade/${party.nif}` },
  };
}

function Side({ title, side, verb, counterpartTitle }: { title: string; side: ContractSide; verb: string; counterpartTitle: string }) {
  return (
    <section className="rounded-2xl border border-line p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <dt className="font-mono text-xs text-muted">Contratos</dt>
          <dd className="text-2xl font-bold tabular-nums">{formatNumber(side.count)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs text-muted">{verb}</dt>
          <dd className="text-2xl font-bold tabular-nums">{formatEurosShort(side.total)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs text-muted">Por ajuste direto</dt>
          <dd className="text-2xl font-bold tabular-nums">{formatNumber(side.directAwards)}</dd>
          <dd className="font-mono text-xs text-muted">{percentOf(side.directAwards, side.count)} dos contratos</dd>
        </div>
      </dl>
      {side.counterparts.length > 0 && (
        <div className="mt-5">
          <Ranking title={counterpartTitle} items={side.counterparts} href={(key) => (isNif(key) ? `/contratos/entidade/${key}` : null)} />
        </div>
      )}
    </section>
  );
}

export default async function ContractPartyPage({ params }: Props) {
  await connection();
  const party = await loadParty((await params).nif);
  if (!party) notFound();
  const buyer = party.asEntity.count > 0;
  const supplier = party.asSupplier.count > 0;
  const role = buyer && supplier ? "Entidade pública e fornecedor" : buyer ? "Entidade pública" : "Fornecedor do Estado";

  return (
    <div data-wide className="max-w-5xl pb-4">
      <Link href="/contratos" className="mb-6 inline-block font-mono text-sm text-muted hover:text-ink hover:underline">
        ← Contratos públicos
      </Link>
      <header className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">{role}</p>
        <h1 className="break-words text-3xl font-bold leading-tight sm:text-4xl">{party.name}</h1>
        <p className="mt-2 font-mono text-sm text-muted">NIF {party.nif}</p>
        <p className="mt-3 max-w-2xl leading-relaxed">
          {buyer && (
            <>
              Adjudicou <strong>{contractsLabel(party.asEntity.count)}</strong> públicos, no valor de{" "}
              <strong>{formatEurosShort(party.asEntity.total)}</strong> sem IVA.{" "}
            </>
          )}
          {supplier && (
            <>
              Ganhou <strong>{contractsLabel(party.asSupplier.count)}</strong> públicos, no valor de{" "}
              <strong>{formatEurosShort(party.asSupplier.total)}</strong> sem IVA.
            </>
          )}
        </p>
      </header>

      <div className={`grid gap-4 ${buyer && supplier ? "lg:grid-cols-2" : ""}`}>
        {buyer && <Side title="Como entidade pública" side={party.asEntity} verb="Adjudicado" counterpartTitle="A quem mais pagou" />}
        {supplier && <Side title="Como fornecedor" side={party.asSupplier} verb="Recebido" counterpartTitle="Quem mais lhe pagou" />}
      </div>

      {party.latest.length > 0 && (
        <section aria-labelledby="ultimos" className="mt-10">
          <h2 id="ultimos" className="text-2xl font-bold">
            Últimos contratos
          </h2>
          <div className="mt-4">
            <ContractList contracts={party.latest} label="Últimos contratos" />
          </div>
          <p className="mt-4 font-mono text-sm">
            <Link href={`/contratos?tipo=todos&${buyer ? "entidade" : "fornecedor"}=${party.nif}#lista`} className="text-link underline">
              Ver todos os contratos {buyer ? "que adjudicou" : "que ganhou"}
            </Link>
            {buyer && supplier && (
              <>
                {" · "}
                <Link href={`/contratos?tipo=todos&fornecedor=${party.nif}#lista`} className="text-link underline">
                  que ganhou
                </Link>
              </>
            )}
          </p>
        </section>
      )}

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
        Os números mostram o que as entidades públicas publicaram no Portal BASE. Um ajuste direto é legal dentro dos limites da lei; os
        dados servem para conhecer padrões, não para tirar conclusões sobre um contrato em particular.
      </p>
      <ContractsSource />
    </div>
  );
}
