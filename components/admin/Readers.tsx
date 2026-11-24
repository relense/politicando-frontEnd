"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getReaders, getReaderStats, type Reader, type ReaderFilters, type ReaderStats } from "@/lib/api/admin";
import { READER_COUNT_LABELS, readerStatusLine } from "@/lib/adminReaders";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { buttonClass, Empty, ErrorNote, inputClass, Tabs, useExpiryOf } from "./ui";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "suspended", label: "Suspensas" },
  { value: "banned", label: "Banidas" },
];

/** Every reader's account (administrators only): the totals, then a list to search, filter and sort, each opening its page. */
export function Readers() {
  const [filters, setFilters] = useState<ReaderFilters>({ q: null, email: null, status: null, active: null, sort: "newest" });
  const [typed, setTyped] = useState("");
  const stats = useQuery({ queryKey: ["admin-reader-stats"], queryFn: getReaderStats });
  const readers = useInfiniteQuery({
    queryKey: ["admin-readers", filters],
    queryFn: ({ pageParam }) => getReaders(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  useExpiryOf(readers.error ?? stats.error);
  const items = readers.data?.pages.flatMap((page) => page.items) ?? [];
  const found = readers.data?.pages[0]?.total ?? null;
  const set = (next: Partial<ReaderFilters>) => setFilters((current) => ({ ...current, ...next }));

  return (
    <section aria-labelledby="utilizadores">
      <h1 id="utilizadores" className="mb-1 text-2xl font-bold">
        Utilizadores
      </h1>
      <p className="mb-4 text-sm text-muted">
        As contas dos leitores. Só os administradores veem esta secção, e abrir uma conta fica no registo. Nunca mostramos palavras-passe
        nem endereços IP.
      </p>
      {stats.data && <Totals stats={stats.data} />}

      <form
        role="search"
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          set({ q: typed.trim() || null });
        }}
      >
        <label className="min-w-0 flex-1 basis-56">
          <span className="mb-1 block font-mono text-xs font-bold">Procurar</span>
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Nome de utilizador ou email"
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass("ink")}>
          Procurar
        </button>
      </form>
      <Tabs
        label="Estado da conta"
        value={filters.status ?? ""}
        onChange={(value) => set({ status: (value || null) as ReaderFilters["status"] })}
        options={STATUS_TABS}
      />
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Email
          <select
            value={filters.email ?? ""}
            onChange={(event) => set({ email: (event.target.value || null) as ReaderFilters["email"] })}
            className="rounded-lg border border-line bg-paper px-2 py-1"
          >
            <option value="">Todos</option>
            <option value="confirmed">Confirmado</option>
            <option value="unconfirmed">Por confirmar</option>
            <option value="none">Sem email</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Visto
          <select
            value={filters.active ?? ""}
            onChange={(event) => set({ active: event.target.value ? (Number(event.target.value) as 7 | 30) : null })}
            className="rounded-lg border border-line bg-paper px-2 py-1"
          >
            <option value="">Sempre</option>
            <option value="7">Nos últimos 7 dias</option>
            <option value="30">Nos últimos 30 dias</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Ordem
          <select
            value={filters.sort}
            onChange={(event) => set({ sort: event.target.value as ReaderFilters["sort"] })}
            className="rounded-lg border border-line bg-paper px-2 py-1"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="last_seen">Vistas há menos tempo</option>
            <option value="most_active">Mais ativas</option>
          </select>
        </label>
      </div>

      <ErrorNote error={readers.error} />
      {found !== null && (
        <p className="mb-2 font-mono text-xs text-muted" role="status">
          {formatNumber(found)} {found === 1 ? "conta" : "contas"}
        </p>
      )}
      {readers.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : items.length === 0 ? (
        <Empty>Nenhuma conta com estes filtros.</Empty>
      ) : (
        <ul aria-label="Contas" className="divide-y divide-line rounded-2xl border border-line">
          {items.map((reader) => (
            <ReaderRow key={reader.id} reader={reader} />
          ))}
        </ul>
      )}
      {readers.hasNextPage && (
        <button
          type="button"
          disabled={readers.isFetchingNextPage}
          onClick={() => readers.fetchNextPage()}
          className={`${buttonClass()} mt-4`}
        >
          {readers.isFetchingNextPage ? "A carregar…" : "Carregar mais"}
        </button>
      )}
    </section>
  );
}

function Totals({ stats }: { stats: ReaderStats }) {
  const entries: [string, number][] = [
    ["Contas", stats.total],
    ["Novas hoje", stats.newToday],
    ["Novas esta semana", stats.newThisWeek],
    ["Ativas (7 dias)", stats.active7d],
    ["Ativas (30 dias)", stats.active30d],
    ["Com email confirmado", stats.emailConfirmed],
    ["Suspensas", stats.suspended],
    ["Banidas", stats.banned],
  ];
  const most = Math.max(1, ...stats.signupsByDay.map((day) => day.count));
  return (
    <div className="mb-6">
      <ul aria-label="Totais" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {entries.map(([label, value]) => (
          <li key={label} className="rounded-xl border border-line p-3">
            <span className="block font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
            <span className="text-xl font-bold tabular-nums">{formatNumber(value)}</span>
          </li>
        ))}
      </ul>
      {stats.signupsByDay.length > 0 && (
        <figure className="mt-3">
          <figcaption className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">
            Novas contas por dia, últimos 30 dias
          </figcaption>
          <ol className="flex h-16 items-end gap-px">
            {stats.signupsByDay.map((day) => (
              <li
                key={day.date}
                title={`${formatDate(day.date)}: ${day.count}`}
                aria-label={`${formatDate(day.date)}: ${day.count} ${day.count === 1 ? "conta nova" : "contas novas"}`}
                className="min-w-0 flex-1 rounded-t-sm bg-ink/70"
                style={{ height: `${Math.max(2, (day.count / most) * 100)}%` }}
              />
            ))}
          </ol>
        </figure>
      )}
    </div>
  );
}

function ReaderRow({ reader }: { reader: Reader }) {
  const busy = READER_COUNT_LABELS.filter(({ key }) => reader.counts[key] > 0).slice(0, 4);
  return (
    <li className="flex flex-col gap-1 p-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link href={`/admin/utilizadores/${reader.id}`} className="font-bold underline-offset-4 hover:underline">
          {reader.username}
        </Link>
        {reader.status !== "active" && (
          <span className="rounded-full border border-danger px-2 py-0.5 font-mono text-[11px] text-danger">
            {readerStatusLine(reader)}
          </span>
        )}
      </p>
      <p className="font-mono text-xs text-muted [overflow-wrap:anywhere]">
        {reader.email ? `${reader.email} · ${reader.emailConfirmed ? "confirmado" : "por confirmar"}` : "sem email"}
        {" · "}criada {formatDate(reader.createdAt)}
        {" · "}
        {reader.lastSeenAt ? `vista ${formatDateTime(reader.lastSeenAt)}` : "nunca vista"}
      </p>
      {busy.length > 0 && (
        <p className="font-mono text-xs text-muted">
          {busy.map(({ key, label }) => `${label}: ${formatNumber(reader.counts[key])}`).join(" · ")}
        </p>
      )}
    </li>
  );
}
