"use client";

import { FeedViewToggle } from "./FeedViewToggle";
import type { FeedView } from "@/lib/feedView";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import {
  FEED_COOKIE,
  FEED_COOKIE_MAX_AGE,
  filterQuery,
  isEmpty,
  sameFilter,
  serializeFilter,
  orderKey,
  orderQuery,
  PERIODS,
  timed,
  SORTS,
  toggle,
  type FeedFilter,
  type FeedOrder,
} from "@/lib/feedFilter";
import { useQuery } from "@tanstack/react-query";
import { loadFeed, totalOf } from "@/lib/api/feed";
import { fold, formatNumber } from "@/lib/format";
import type { Party } from "@/lib/types";
import { PartyLogo } from "./PartyLogo";
import { PartyOrderToggle, useOrderedParties } from "./PartyOrder";
import { SourceLogo } from "./SourceLogo";
import { track } from "@/lib/analytics";

type Source = { domain: string; name: string; count: number };

type Props = {
  parties: Party[];
  sources: Source[];
  filter: FeedFilter;
  /** The reader's saved feed, if any; the front page opens with it. */
  saved: FeedFilter | null;
  q: string;
  order: FeedOrder;
  /** Cards or a compact list, when the page offers the choice. */
  view?: FeedView;
};

const pill = (pressed: boolean) =>
  `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border pl-1 pr-2.5 font-mono text-xs font-bold ${
    pressed ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
  }`;

const bubble = (pressed: boolean) =>
  `flex w-14 flex-col items-center gap-1 font-mono text-[11px] font-bold ${pressed ? "text-ink" : "text-muted"}`;
const bubbleRing = (pressed: boolean) =>
  `flex size-12 items-center justify-center overflow-hidden rounded-full border-2 bg-white text-[#1a1a1a] ${
    pressed ? "border-[var(--brand)]" : "border-line"
  }`;

/** A button that opens a panel below it; closes on Escape, on a click outside, or when the choice is applied. */
function Dropdown({
  label,
  count,
  title,
  panelClass = "sm:w-[34rem]",
  buttonClass,
  children,
}: {
  label: ReactNode;
  /** Replaces the bordered pill (e.g. "+14" inside the party strip). */
  buttonClass?: string;
  count: number;
  title: string;
  /** The panel's width from a tablet up; on a phone it takes the row. */
  panelClass?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="sm:relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={
          buttonClass ??
          `flex h-10 items-center gap-2 rounded-full border px-3 font-mono text-xs font-bold sm:px-4 ${
            count > 0 || open ? "border-ink" : "border-line hover:bg-surface"
          }`
        }
      >
        {label}
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--marker)] text-[10px] text-ink">
            {count}
            <span className="sr-only"> escolhidos</span>
          </span>
        )}
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-3.5 fill-none stroke-current stroke-2 ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={title}
          className={`absolute inset-x-0 z-30 mt-2 rounded-2xl border border-line bg-paper p-4 shadow-xl sm:left-auto sm:right-0 ${panelClass}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A choice in a panel: a checkbox row with the icon, the name and a number. */
function CheckRow({
  checked,
  onChange,
  icon,
  label,
  note,
}: {
  checked: boolean;
  onChange: () => void;
  icon: ReactNode;
  label: string;
  note?: string | number | null;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 font-mono text-xs font-bold ${
        checked ? "border-ink bg-surface" : "border-line hover:bg-surface"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="size-3.5 accent-[var(--ink)]" />
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {note !== undefined && note !== null && <span className="font-normal text-muted">{note}</span>}
    </label>
  );
}

/** How many articles a choice would show, asked of the API as the boxes are ticked; null while unknown. */
function useMatchCount(filter: FeedFilter, q: string, order: FeedOrder): number | null {
  const { data } = useQuery({
    queryKey: ["feed-count", filter.parties.join(","), filter.sources.join(","), q, orderKey(order)],
    queryFn: async () => totalOf(await loadFeed({ party: filter.parties, source: filter.sources, q, limit: 1 }, order)),
    staleTime: 60_000,
  });
  return data ?? null;
}

const showLabel = (count: number | null) =>
  count === null ? "Mostrar notícias" : count === 1 ? "Mostrar 1 notícia" : `Mostrar ${formatNumber(count)} notícias`;

function PanelFooter({
  onClear,
  clearLabel,
  onApply,
  count,
}: {
  onClear: () => void;
  clearLabel: string;
  onApply: () => void;
  count: number | null;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
      <button type="button" onClick={onClear} className="font-mono text-xs text-muted underline hover:text-ink">
        {clearLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded-full bg-ink px-4 py-2 font-mono text-xs font-bold text-paper hover:opacity-90"
      >
        {showLabel(count)}
      </button>
    </div>
  );
}

const heading = "mb-2 mt-4 font-mono text-[11px] font-bold uppercase tracking-widest text-muted first:mt-0";

type PanelProps = { chosen: string[]; onApply: (values: string[]) => void; filter: FeedFilter; q: string; order: FeedOrder };

function PartiesPanel({ parties, chosen, onApply, filter, q, order }: PanelProps & { parties: Party[] }) {
  const { ordered, seatsOf } = useOrderedParties(parties);
  const [draft, setDraft] = useState(chosen);
  const count = useMatchCount({ ...filter, parties: draft }, q, order);
  const [query, setQuery] = useState("");
  const words = fold(query.trim());
  const shown = ordered.filter((party) => !words || fold(`${party.acronym} ${party.name}`).includes(words));
  const seated = shown.filter((party) => (seatsOf(party.slug) ?? 1) > 0);
  const others = shown.filter((party) => (seatsOf(party.slug) ?? 1) === 0);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Procurar partido"
          aria-label="Procurar partido"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 font-mono text-xs"
        />
        <PartyOrderToggle />
      </div>
      <div className="mt-4 max-h-[55vh] overflow-y-auto overscroll-contain">
        {seated.length > 0 && (
          <fieldset>
            <legend className={heading}>{others.length > 0 ? `Com deputados · ${seated.length}` : `Partidos · ${seated.length}`}</legend>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {seated.map((party) => (
                <CheckRow
                  key={party.slug}
                  checked={draft.includes(party.slug)}
                  onChange={() => setDraft(toggle(draft, party.slug))}
                  icon={<PartyLogo slug={party.slug} acronym={party.acronym} size={18} />}
                  label={party.acronym}
                  note={seatsOf(party.slug)}
                />
              ))}
            </div>
          </fieldset>
        )}
        {others.length > 0 && (
          <fieldset className="mt-4">
            <legend className={heading}>Sem deputados · {others.length}</legend>
            <div className="flex flex-wrap gap-1.5">
              {others.map((party) => {
                const checked = draft.includes(party.slug);
                return (
                  <label key={party.slug} className={`${pill(checked)} cursor-pointer`}>
                    <input type="checkbox" checked={checked} onChange={() => setDraft(toggle(draft, party.slug))} className="sr-only" />
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={20} />
                    {party.acronym}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {shown.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhum partido com esse nome.</p>}
      </div>
      <PanelFooter onClear={() => setDraft([])} clearLabel="Limpar partidos" onApply={() => onApply(draft)} count={count} />
    </>
  );
}

function SourcesPanel({ sources, chosen, onApply, filter, q, order }: PanelProps & { sources: Source[] }) {
  const [draft, setDraft] = useState(chosen);
  const count = useMatchCount({ ...filter, sources: draft }, q, order);
  const [query, setQuery] = useState("");
  const words = fold(query.trim());
  const shown = sources.filter((source) => !words || fold(`${source.name} ${source.domain}`).includes(words));
  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Procurar jornal"
        aria-label="Procurar jornal"
        className="h-9 w-full rounded-lg border border-line bg-paper px-3 font-mono text-xs"
      />
      <fieldset className="mt-4 max-h-[55vh] overflow-y-auto overscroll-contain">
        <legend className={heading}>Jornais · {sources.length}</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {shown.map((source) => (
            <CheckRow
              key={source.domain}
              checked={draft.includes(source.domain)}
              onChange={() => setDraft(toggle(draft, source.domain))}
              icon={<SourceLogo domain={source.domain} name={source.name} size={18} />}
              label={source.name}
              note={source.count > 0 ? source.count.toLocaleString("pt-PT") : null}
            />
          ))}
        </div>
        {shown.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhum jornal com esse nome.</p>}
      </fieldset>
      <PanelFooter onClear={() => setDraft([])} clearLabel="Limpar jornais" onApply={() => onApply(draft)} count={count} />
    </>
  );
}

/**
 * The news toolbar: words, parties and papers (any number of each), and the order. The parties in Parliament are also
 * one tap away below it. The choice can be saved as the reader's own feed, which the front page then opens with (kept
 * in a cookie, never sent anywhere else).
 */
export function FeedFilters({ parties, sources, filter, saved, q, order, view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const { ordered, seatsOf } = useOrderedParties(parties);
  const isSaved = saved !== null && sameFilter(filter, saved);
  const quick = ordered.filter((party) => (seatsOf(party.slug) ?? 0) > 0);
  // On a phone the search is a button that opens the box, so the filters fit on one row.
  const [searching, setSearching] = useState(Boolean(q));

  const go = (next: FeedFilter, extra: { q?: string; order?: FeedOrder } = {}) => {
    const words = extra.q ?? q;
    // With a saved feed, "everything" needs saying, or the front page would open the saved one again.
    const query = filterQuery(next, {
      q: words,
      ...orderQuery(extra.order ?? order),
      ...(isEmpty(next) && saved ? { tudo: "1" } : {}),
    });
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const save = (value: FeedFilter | null) => {
    document.cookie = value
      ? `${FEED_COOKIE}=${encodeURIComponent(serializeFilter(value))}; Max-Age=${FEED_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`
      : `${FEED_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    startTransition(() => router.refresh());
  };

  const partyOf = (slug: string) => parties.find((party) => party.slug === slug);
  const sourceOf = (domain: string) => sources.find((source) => source.domain === domain);

  return (
    <nav aria-label="Filtrar notícias" className="mb-6" data-nosnippet>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={searching}
          aria-label={searching ? "Fechar a pesquisa" : "Procurar nas notícias"}
          onClick={() => setSearching(!searching)}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border sm:hidden ${searching ? "border-ink" : "border-line"}`}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <form
          role="search"
          action="/"
          method="get"
          className={`relative order-last min-w-0 basis-full sm:order-none sm:block sm:flex-[1_1_18rem] ${searching ? "" : "max-sm:hidden"}`}
          onSubmit={(event) => {
            event.preventDefault();
            const words = String(new FormData(event.currentTarget).get("q") ?? "").trim();
            // Where, never what: the words could say something about the reader.
            if (words) track("search", { where: "news" });
            go(filter, { q: words });
          }}
        >
          {filter.parties.length > 0 && <input type="hidden" name="partido" value={filter.parties.join(",")} />}
          {filter.sources.length > 0 && <input type="hidden" name="fonte" value={filter.sources.join(",")} />}
          <label>
            <span className="sr-only">Procurar nas notícias</span>
            <input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Procurar nas notícias, ex.: «habitação»"
              className="h-10 w-full rounded-full border border-line bg-paper pl-10 pr-4 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>
          <button
            type="submit"
            aria-label="Procurar"
            className="absolute left-1 top-1 flex size-8 items-center justify-center rounded-full text-muted hover:text-ink"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        {parties.length > 0 && (
          <div className="sm:hidden">
            <Dropdown label="Partidos" count={filter.parties.length} title="Escolher partidos">
              {(close) => (
                <PartiesPanel
                  parties={parties}
                  chosen={filter.parties}
                  filter={filter}
                  q={q}
                  order={order}
                  onApply={(next) => {
                    close();
                    go({ ...filter, parties: next });
                  }}
                />
              )}
            </Dropdown>
          </div>
        )}
        {/* From a tablet up: the parties in Parliament as a strip of logos, one tap each; "+N" opens every party. */}
        {parties.length > 0 && (
          <div className="flex h-12 min-w-0 shrink items-center gap-1 rounded-full border border-line pl-1.5 pr-1.5 max-sm:hidden">
            {quick.length > 0 && (
              <ul aria-label="Partidos com deputados" className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto py-1">
                {quick.map((party) => {
                  const pressed = filter.parties.includes(party.slug);
                  return (
                    <li key={party.slug} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={pressed}
                        title={party.acronym}
                        onClick={() => go({ ...filter, parties: toggle(filter.parties, party.slug) })}
                        className={`flex size-9 items-center justify-center overflow-hidden rounded-full bg-white transition-shadow ${
                          pressed
                            ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--paper)]"
                            : "opacity-90 hover:opacity-100 hover:ring-2 hover:ring-[var(--card-line-strong)]"
                        }`}
                      >
                        <PartyLogo slug={party.slug} acronym={party.acronym} size={26} />
                        <span className="sr-only">{party.acronym}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Dropdown
              label={
                <>
                  <span className={quick.length > 0 ? "sr-only" : ""}>Partidos</span>
                  {quick.length > 0 && parties.length - quick.length > 0 && (
                    <span aria-hidden="true">+{parties.length - quick.length}</span>
                  )}
                </>
              }
              count={filter.parties.length}
              title="Escolher partidos"
              buttonClass="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 font-mono text-xs font-bold hover:bg-line"
            >
              {(close) => (
                <PartiesPanel
                  parties={parties}
                  chosen={filter.parties}
                  filter={filter}
                  q={q}
                  order={order}
                  onApply={(next) => {
                    close();
                    go({ ...filter, parties: next });
                  }}
                />
              )}
            </Dropdown>
          </div>
        )}
        {sources.length > 0 && (
          <Dropdown label="Jornais" count={filter.sources.length} title="Escolher jornais">
            {(close) => (
              <SourcesPanel
                sources={sources}
                chosen={filter.sources}
                filter={filter}
                q={q}
                order={order}
                onApply={(next) => {
                  close();
                  go({ ...filter, sources: next });
                }}
              />
            )}
          </Dropdown>
        )}
      </div>

      {quick.length > 0 && (
        <div className="mt-3 flex items-center gap-2 sm:hidden">
          {/* On a phone, round buttons with the logo and the name below, as stories are shown; from a tablet up, pills. */}
          <ul aria-label="Partidos com deputados" className="no-scrollbar flex min-w-0 flex-1 gap-3 overflow-x-auto pb-0.5 sm:gap-1.5">
            <li className="shrink-0 sm:hidden">
              <button
                type="button"
                aria-pressed={filter.parties.length === 0}
                onClick={() => go({ ...filter, parties: [] })}
                className={bubble(filter.parties.length === 0)}
              >
                <span className={bubbleRing(filter.parties.length === 0)}>
                  <span aria-hidden="true" className="text-base">
                    ★
                  </span>
                </span>
                Todos
              </button>
            </li>
            {quick.map((party) => {
              const pressed = filter.parties.includes(party.slug);
              return (
                <li key={party.slug} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => go({ ...filter, parties: toggle(filter.parties, party.slug) })}
                    className={`${bubble(pressed)} sm:hidden`}
                  >
                    <span className={bubbleRing(pressed)}>
                      <PartyLogo slug={party.slug} acronym={party.acronym} size={30} />
                    </span>
                    {party.acronym}
                  </button>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => go({ ...filter, parties: toggle(filter.parties, party.slug) })}
                    className={`${pill(pressed)} max-sm:hidden`}
                  >
                    <PartyLogo slug={party.slug} acronym={party.acronym} size={22} />
                    {party.acronym}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <OrderTabs order={order} onChange={(next) => go(filter, { order: next })} view={view} />

      {(!isEmpty(filter) || saved) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-line py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {isEmpty(filter) ? (
              <span className="text-sm text-muted">A mostrar tudo. O teu feed abre quando voltas à página inicial.</span>
            ) : (
              <>
                {isSaved && <span className="mr-1 font-mono text-xs font-bold">★ O teu feed</span>}
                <ul aria-label="Filtros escolhidos" className="flex flex-wrap gap-1.5">
                  {filter.parties.map((slug) => {
                    const party = partyOf(slug);
                    return (
                      <li key={slug}>
                        <button
                          type="button"
                          onClick={() => go({ ...filter, parties: filter.parties.filter((item) => item !== slug) })}
                          className={pill(false)}
                        >
                          <PartyLogo slug={slug} acronym={party?.acronym ?? slug} size={20} />
                          <span>
                            <span className="sr-only">Tirar </span>
                            {party?.acronym ?? slug}
                          </span>
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    );
                  })}
                  {filter.sources.map((domain) => {
                    const source = sourceOf(domain);
                    return (
                      <li key={domain}>
                        <button
                          type="button"
                          onClick={() => go({ ...filter, sources: filter.sources.filter((item) => item !== domain) })}
                          className={pill(false)}
                        >
                          <SourceLogo domain={domain} name={source?.name ?? domain} size={20} />
                          <span>
                            <span className="sr-only">Tirar </span>
                            {source?.name ?? domain}
                          </span>
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => go({ parties: [], sources: [] })}
                  className="ml-1 font-mono text-xs text-muted underline hover:text-ink"
                >
                  Limpar tudo
                </button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
            {!isEmpty(filter) && !isSaved && (
              <button type="button" onClick={() => save(filter)} className="rounded-full border border-ink px-3 py-1.5 hover:bg-surface">
                ☆ Guardar como o meu feed
              </button>
            )}
            {saved && (isSaved || isEmpty(filter)) && (
              <button type="button" onClick={() => save(null)} className="rounded-full border border-line px-3 py-1.5 hover:bg-surface">
                Esquecer o meu feed
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function OrderTabs({ order, onChange, view }: { order: FeedOrder; onChange: (order: FeedOrder) => void; view?: FeedView }) {
  const ranked = timed(order);
  const period = PERIODS.find((item) => item.value === order.period)!;
  return (
    // Underlined tabs, as in the design: the chosen one says what the feed shows. Sideways scrolling on a phone.
    <div className="mt-4 flex items-center gap-2 border-b border-line">
      <div role="group" aria-label="Ordenar notícias" className="no-scrollbar -mb-px flex min-w-0 flex-1 overflow-x-auto">
        {SORTS.map((item) => {
          const pressed = order.sort === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={pressed}
              title={item.hint}
              onClick={() => onChange({ ...order, sort: item.value })}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-mono text-[13px] font-semibold first:pl-0.5 ${
                pressed ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {ranked && (
        <Dropdown
          label={period.label}
          count={0}
          title="Período"
          panelClass="sm:w-56"
          buttonClass="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 font-mono text-xs font-bold text-muted hover:bg-surface hover:text-ink"
        >
          {(close) => (
            <div role="group" aria-label="Publicadas" className="flex flex-col gap-1 font-mono text-xs font-bold">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={order.period === item.value}
                  onClick={() => {
                    close();
                    onChange({ ...order, period: item.value });
                  }}
                  className={`rounded-xl px-3 py-2 text-left ${order.period === item.value ? "bg-ink text-paper" : "hover:bg-surface"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}
      {view && <FeedViewToggle initial={view} />}
    </div>
  );
}
