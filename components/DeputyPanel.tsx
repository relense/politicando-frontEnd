"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { getDeputy } from "@/lib/api/client";
import { partyColor } from "@/lib/parliament";
import type { DeputySummary, ParliamentGroup } from "@/lib/types";
import { DeputyVotes } from "./DeputyVotes";
import { DeputyArticles, DeputyCareer, DeputyFacts, DeputyInitiatives, DeputyPortrait } from "./DeputyProfile";

type Props = {
  group: ParliamentGroup | null;
  deputies: DeputySummary[];
  deputy: DeputySummary | null;
  onDeputy: (id: number) => void;
  onBackToGroup: () => void;
  onClose: () => void;
};

/** The card beside the map: a party's bench after pressing a seat, then the deputy chosen from it. */
export function DeputyPanel({ group, deputies, deputy, onDeputy, onBackToGroup, onClose }: Props) {
  if (deputy) return <DeputyCard key={deputy.id} summary={deputy} group={group} onBack={onBackToGroup} onClose={onClose} />;
  if (group) return <GroupCard group={group} deputies={deputies} onDeputy={onDeputy} onClose={onClose} />;
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-muted">
      <p className="font-bold text-ink">Carrega num lugar</p>
      <p className="mt-1 text-sm">para ver quem lá se senta: quem é, o que propôs e o que dizem as notícias.</p>
      <Link href="/deputados" className="mt-4 font-mono text-sm text-link underline">
        Ver todos os deputados
      </Link>
    </div>
  );
}

/** A card with the party's colour along the top, as in the rest of the Parliament page. */
function Card({
  color,
  label,
  labelledBy,
  onClose,
  children,
}: {
  color: string;
  label: ReactNode;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-t-4 border-line bg-paper"
      style={{ borderTopColor: color }}
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-3">
        <div className="font-mono text-xs text-muted">{label}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-2 flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {/* Long content scrolls inside the card, so it never grows past the map beside it. */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
    </section>
  );
}

/** A party's bench. Which deputy sits in which chair isn't published, so the seat opens the whole bench. */
function GroupCard({
  group,
  deputies,
  onDeputy,
  onClose,
}: {
  group: ParliamentGroup;
  deputies: DeputySummary[];
  onDeputy: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <Card color={partyColor(group.party.slug)} label="Bancada" labelledBy="bancada-nome" onClose={onClose}>
      <h2 id="bancada-nome" className="text-xl font-bold leading-tight">
        {group.party.name}
      </h2>
      <p className="font-mono text-xs text-muted">
        {group.party.acronym} · {group.seats} {group.seats === 1 ? "deputado" : "deputados"}
      </p>
      <p className="mt-3 text-sm text-muted">Escolhe um deputado desta bancada:</p>
      <ul className="mt-2">
        {deputies.map((deputy) => (
          <li key={deputy.id}>
            <button
              type="button"
              onClick={() => onDeputy(deputy.id)}
              className="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-surface"
            >
              <span className="font-bold">{deputy.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted">{deputy.role ?? deputy.constituency}</span>
            </button>
          </li>
        ))}
      </ul>
      <Link
        href={`/deputados?partido=${group.party.slug}`}
        className="mt-4 block rounded-lg border border-line py-2.5 text-center font-mono text-sm font-bold hover:bg-surface"
      >
        Ver a bancada com fotografias →
      </Link>
    </Card>
  );
}

const TABS = ["Iniciativas", "Votações", "Notícias", "Percurso"] as const;

/** One deputy at a glance, with tabs and a link to the full record. `group` adds a way back to their bench. */
export function DeputyCard({
  summary,
  group,
  onBack,
  onClose,
}: {
  summary: DeputySummary;
  group: ParliamentGroup | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const { data: detail, isPending, isError } = useQuery({ queryKey: ["deputy", summary.id], queryFn: () => getDeputy(summary.id) });
  const [tab, setTab] = useState<(typeof TABS)[number]>("Iniciativas");
  const party = detail?.party ?? group?.party ?? null;

  return (
    <Card
      color={partyColor(summary.partySlug ?? "")}
      labelledBy="deputado-nome"
      onClose={onClose}
      label={
        group ? (
          <button type="button" onClick={onBack} className="hover:text-ink hover:underline">
            ← Bancada {group.party.acronym}
          </button>
        ) : (
          "Deputado"
        )
      }
    >
      <div className="flex items-center gap-4">
        <DeputyPortrait deputy={summary} size="md" />
        <div className="min-w-0">
          <h2 id="deputado-nome" className="text-xl font-bold leading-tight outline-none">
            {summary.name}
          </h2>
          {party && (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: partyColor(party.slug) }} />
              <span className="font-bold text-ink">{party.acronym}</span> {party.name}
            </p>
          )}
        </div>
      </div>

      <DeputyFacts summary={summary} detail={detail} />

      {isPending && <p className="mt-4 text-sm text-muted">A carregar o perfil…</p>}
      {isError && <p className="mt-4 text-sm text-muted">Não foi possível carregar o perfil completo.</p>}

      {detail && (
        <>
          <dl className="mt-4 grid grid-cols-3 divide-x divide-line border-y border-line py-3 text-center">
            <Stat value={detail.initiatives.total} label="iniciativas assinadas" />
            <Stat value={detail.initiatives.approved} label="aprovadas" />
            <Stat value={detail.articles.length} label="notícias recentes" />
          </dl>

          <div
            role="tablist"
            aria-label="Sobre o deputado"
            className="mt-4 flex gap-3 border-b border-line font-mono text-[11px] font-bold uppercase tracking-wider"
          >
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={`-mb-px border-b-2 pb-2 ${tab === name ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {name}
              </button>
            ))}
          </div>
          <div role="tabpanel" aria-label={tab} className="pt-3">
            {tab === "Iniciativas" && <DeputyInitiatives detail={detail} limit={5} />}
            {tab === "Votações" && <DeputyVotes deputyId={summary.id} group={party?.acronym ?? summary.group} compact />}
            {tab === "Notícias" && <DeputyArticles detail={detail} limit={5} />}
            {tab === "Percurso" && <DeputyCareer detail={detail} />}
          </div>
        </>
      )}

      <Link
        href={`/deputados/${summary.id}`}
        className="mt-5 block rounded-lg border border-line py-2.5 text-center font-mono text-sm font-bold hover:bg-surface"
      >
        Ver ficha completa →
      </Link>
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col-reverse px-1">
      <dt className="font-mono text-[11px] leading-tight text-muted">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </div>
  );
}
