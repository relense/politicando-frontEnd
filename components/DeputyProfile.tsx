"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { ageOn, partyColor, STATUS_LABELS } from "@/lib/parliament";
import { photoSource } from "@/lib/photos";
import type { DeputyDetail, DeputySummary } from "@/lib/types";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .join("")
    .toUpperCase();

const SIZES = { sm: "size-14 text-base", md: "size-16 text-lg", lg: "size-28 text-3xl" } as const;
const PIXELS = { sm: 56, md: 64, lg: 112 } as const;

/** The deputy's photo with a ring in the party's colour, or their initials when there is no photo or it fails. */
export function DeputyPortrait({
  deputy,
  size,
}: {
  deputy: Pick<DeputySummary, "id" | "name" | "photoUrl" | "partySlug">;
  size: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const ring = { boxShadow: `0 0 0 3px ${partyColor(deputy.partySlug ?? "")}` };
  const classes = `${SIZES[size]} shrink-0 rounded-full`;
  const src = photoSource(deputy);
  if (src && !failed) {
    // Through the image optimiser: resized for this size, cached on our server and in the browser.
    return (
      <Image
        src={src}
        // Addresses other than our cached route (a CDN, later) are already small and cached; use them as they are.
        unoptimized={!src.startsWith("/")}
        alt=""
        width={PIXELS[size]}
        height={PIXELS[size]}
        onError={() => setFailed(true)}
        className={`${classes} bg-surface object-cover object-top`}
        style={ring}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`${classes} flex items-center justify-center bg-surface font-bold text-muted`} style={ring}>
      {initials(deputy.name)}
    </span>
  );
}

/** The key facts as a two-column grid. Works with just the summary while the full profile loads. */
export function DeputyFacts({ summary, detail }: { summary: DeputySummary; detail: DeputyDetail | undefined }) {
  const age = ageOn(detail?.birthDate ?? null, new Date());
  const legislatures = detail ? detail.pastLegislatures.length + 1 : null;
  const facts: [string, string | null][] = [
    ["Círculo", summary.constituency],
    ["Cargo", summary.role ?? summary.positions[0] ?? null],
    ["Lugar", summary.seat !== null ? `${summary.seat}${summary.seatEstimated ? " (aproximado)" : ""}` : null],
    ["Situação", detail && !detail.active ? detail.situation : null],
    ["Idade", age !== null ? `${age} anos` : null],
    ["Profissão", detail?.profession ?? null],
    ["Legislaturas", legislatures !== null ? (legislatures === 1 ? "1.ª legislatura" : `${legislatures} legislaturas`) : null],
    ["Comissões", detail ? String(detail.committees.length) : null],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
      {facts
        .filter((fact): fact is [string, string] => fact[1] !== null && fact[1] !== "")
        .map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{label}</dt>
            <dd className="text-sm font-bold">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function DeputyInitiatives({ detail, limit }: { detail: DeputyDetail; limit?: number }) {
  const items = limit ? detail.initiatives.latest.slice(0, limit) : detail.initiatives.latest;
  if (items.length === 0) return <p className="text-sm text-muted">Ainda não assinou iniciativas nesta legislatura.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="py-2.5">
          <p className="font-mono text-[11px] text-muted">
            {item.type}
            {item.number && ` n.º ${item.number}`} · <span className="font-bold text-ink">{STATUS_LABELS[item.status]}</span>
          </p>
          <p className="text-sm font-bold leading-snug">
            {item.textUrl ? (
              <a href={item.textUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {item.title}
                <span className="sr-only"> (abre num novo separador)</span>
              </a>
            ) : (
              item.title
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DeputyArticles({ detail, limit }: { detail: DeputyDetail; limit?: number }) {
  const items = limit ? detail.articles.slice(0, limit) : detail.articles;
  if (items.length === 0) return <p className="text-sm text-muted">Sem notícias recentes que o mencionem.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((article) => (
        <li key={article.id} className="py-2.5">
          <p className="font-mono text-[11px] text-muted">
            {article.source} · {formatDate(article.publishedAt)}
          </p>
          <Link href={`/article/${article.id}`} className="text-sm font-bold leading-snug hover:underline">
            {article.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Committees, past posts, education and earlier legislatures, with a link to the official biography. */
export function DeputyCareer({ detail }: { detail: DeputyDetail }) {
  const education = detail.education.map((item) => (item.completed ? item.course : `${item.course} (frequência)`));
  return (
    <div className="space-y-4 text-sm">
      {detail.committees.length > 0 && (
        <Block title="Comissões">
          <ul className="space-y-1">
            {detail.committees.map((committee) => (
              <li key={committee.name}>
                {committee.name}
                {(committee.role || committee.membership) && (
                  <span className="text-muted"> · {committee.role ?? committee.membership}</span>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {detail.positions.length > 0 && (
        <Block title="Cargos atuais">
          <ul className="space-y-1">
            {detail.positions.map((position) => (
              <li key={position}>{position}</li>
            ))}
          </ul>
        </Block>
      )}
      {detail.roles.length > 0 && (
        <Block title="Cargos">
          <ul className="space-y-1">
            {detail.roles.map((role) => (
              <li key={role.title}>
                {role.title}
                {role.current && <span className="text-muted"> · atual</span>}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {education.length > 0 && <Block title="Formação">{education.join(" · ")}</Block>}
      <Block title="Legislaturas anteriores">
        {detail.pastLegislatures.length > 0 ? detail.pastLegislatures.join(", ") : "Primeiro mandato"}
      </Block>
      <a
        href={`https://www.parlamento.pt/DeputadoGP/Paginas/Biografia.aspx?BID=${detail.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-mono text-xs text-link underline"
      >
        Biografia no Parlamento ↗<span className="sr-only"> (abre num novo separador)</span>
      </a>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      <div>{children}</div>
    </div>
  );
}
