"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  deleteReaderAccount,
  getReader,
  getReaderActivity,
  getReaderAudit,
  readerAction,
  type ReaderAction,
  type ReaderDetail,
} from "@/lib/api/admin";
import { activityHref, activityLabel, activityText, READER_COUNT_LABELS, readerStatusLine, signupHref } from "@/lib/adminReaders";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { buttonClass, Empty, ErrorNote, inputClass, useExpiry, useExpiryOf } from "./ui";

const MODERATION_LABELS: Record<string, string> = {
  comment_removed: "Comentário removido",
  post_removed: "Publicação no fórum removida",
  suspended: "Suspensa",
  unsuspended: "Suspensão levantada",
  banned: "Banida",
  unbanned: "Banimento levantado",
  content_removed: "Todo o conteúdo removido",
};

const AUDIT_LABELS: Record<string, string> = {
  "reader.view": "abriu esta conta",
  "reader.suspend": "suspendeu a conta",
  "reader.unsuspend": "levantou a suspensão",
  "reader.ban": "baniu a conta",
  "reader.unban": "levantou o banimento",
  "reader.remove_content": "removeu todo o conteúdo",
  "reader.delete": "apagou a conta",
};

type Act = ReaderAction | "delete";
const ACTS: { act: Act; label: string; when: (reader: ReaderDetail) => boolean; danger?: boolean }[] = [
  { act: "suspend", label: "Suspender", when: (reader) => reader.status === "active", danger: true },
  { act: "unsuspend", label: "Levantar a suspensão", when: (reader) => reader.status === "suspended" },
  { act: "ban", label: "Banir", when: (reader) => reader.status === "active" || reader.status === "suspended", danger: true },
  { act: "unban", label: "Levantar o banimento", when: (reader) => reader.status === "banned" },
  { act: "remove-content", label: "Remover todo o conteúdo", when: (reader) => reader.status !== "deleted", danger: true },
  { act: "delete", label: "Apagar a conta", when: (reader) => reader.status !== "deleted", danger: true },
];

/** One reader: who, where they stand, what they did on the site (with links), what the team did, and who looked. */
export function ReaderPage({ id }: { id: number }) {
  const reader = useQuery({ queryKey: ["admin-reader", id], queryFn: () => getReader(id) });
  const activity = useInfiniteQuery({
    queryKey: ["admin-reader-activity", id],
    queryFn: ({ pageParam }) => getReaderActivity(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  // After the reader: opening it is what the log records.
  const log = useQuery({ queryKey: ["admin-reader-audit", id], queryFn: () => getReaderAudit(id), enabled: reader.isSuccess });
  useExpiryOf(reader.error ?? activity.error ?? log.error);
  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="utilizador">
      <Link href="/admin/utilizadores" className="mb-3 inline-block font-mono text-xs font-bold underline">
        <span aria-hidden="true">← </span>Utilizadores
      </Link>
      <ErrorNote error={reader.error} />
      {reader.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : reader.data ? (
        <>
          <h1 id="utilizador" className="mb-1 text-2xl font-bold [overflow-wrap:anywhere]">
            {reader.data.username}
          </h1>
          <p className={`mb-4 font-mono text-xs font-bold ${reader.data.status === "active" ? "text-muted" : "text-danger"}`}>
            {readerStatusLine(reader.data)}
          </p>
          <Profile reader={reader.data} />
          <Actions reader={reader.data} />

          <h2 className="mb-2 mt-8 text-lg font-bold">O que fez</h2>
          <ErrorNote error={activity.error} />
          {activity.isPending ? (
            <p className="text-muted">A carregar…</p>
          ) : items.length === 0 ? (
            <Empty>Ainda não fez nada no site.</Empty>
          ) : (
            <ul aria-label="O que fez" className="divide-y divide-line rounded-2xl border border-line">
              {items.map((item, index) => {
                const href = activityHref(item.target);
                const text = activityText(item);
                return (
                  <li key={`${item.at}-${index}`} className="p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-xs text-muted">{formatDateTime(item.at)}</span>
                      <span className="font-bold">{activityLabel(item)}</span>
                      {item.target &&
                        (href ? (
                          <Link href={href} target="_blank" className="text-link underline [overflow-wrap:anywhere]">
                            {item.target.title ?? `#${item.target.id}`}
                          </Link>
                        ) : (
                          <span className="[overflow-wrap:anywhere]">{item.target.title ?? `#${item.target.id}`}</span>
                        ))}
                      {item.removed && <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px]">Removido</span>}
                    </p>
                    {text && <p className="mt-1 whitespace-pre-line text-muted [overflow-wrap:anywhere]">«{text}»</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {activity.hasNextPage && (
            <button
              type="button"
              disabled={activity.isFetchingNextPage}
              onClick={() => activity.fetchNextPage()}
              className={`${buttonClass()} mt-3`}
            >
              {activity.isFetchingNextPage ? "A carregar…" : "Carregar mais"}
            </button>
          )}

          <h2 className="mb-2 mt-8 text-lg font-bold">Moderação</h2>
          {reader.data.moderation.length === 0 ? (
            <Empty>Sem ações da moderação.</Empty>
          ) : (
            <ul aria-label="Moderação" className="divide-y divide-line rounded-2xl border border-line">
              {reader.data.moderation.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="p-3 text-sm">
                  <span className="font-mono text-xs text-muted">{formatDateTime(entry.at)}</span>{" "}
                  <span className="font-bold">{MODERATION_LABELS[entry.action] ?? entry.action}</span>
                  {entry.until && ` até ${formatDate(entry.until)}`}
                  {entry.by && ` · por ${entry.by.name}`}
                  {entry.reason && <span className="block text-muted [overflow-wrap:anywhere]">Motivo: {entry.reason}</span>}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 mt-8 text-lg font-bold">Registo</h2>
          <p className="mb-2 text-sm text-muted">Quem da equipa abriu esta conta e o que fez nela.</p>
          {log.data && log.data.length > 0 ? (
            <ul aria-label="Registo" className="divide-y divide-line rounded-2xl border border-line">
              {log.data.map((entry) => (
                <li key={entry.id} className="p-3 text-sm">
                  <span className="font-mono text-xs text-muted">{formatDateTime(entry.at)}</span> {entry.admin?.name ?? "Alguém da equipa"}{" "}
                  {AUDIT_LABELS[entry.action] ?? entry.action}
                </li>
              ))}
            </ul>
          ) : (
            !log.isPending && <Empty>Sem registos.</Empty>
          )}
        </>
      ) : null}
    </section>
  );
}

function Profile({ reader }: { reader: ReaderDetail }) {
  const rows: [string, ReactNode][] = [
    ["Email", reader.email ? `${reader.email} (${reader.emailConfirmed ? "confirmado" : "por confirmar"})` : "Sem email"],
    ["Newsletter", reader.newsletter ? "Sim" : "Não"],
    ["Conta criada", formatDateTime(reader.createdAt)],
    ["Última visita", reader.lastSeenAt ? formatDateTime(reader.lastSeenAt) : "Nunca"],
    [
      "Registou-se a partir de",
      signupHref(reader.signupFrom) ? (
        <Link href={signupHref(reader.signupFrom)!} target="_blank" className="text-link underline [overflow-wrap:anywhere]">
          {reader.signupFrom}
        </Link>
      ) : (
        (reader.signupFrom ?? "Não sabemos")
      ),
    ],
  ];
  return (
    <>
      <dl className="grid gap-x-6 gap-y-2 rounded-2xl border border-line p-4 text-sm sm:grid-cols-[max-content_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-mono text-xs font-bold text-muted">{label}</dt>
            <dd className="[overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <ul aria-label="Números" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {READER_COUNT_LABELS.map(({ key, label }) => (
          <li key={key} className="rounded-xl border border-line p-3">
            <span className="block font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
            <span className="text-lg font-bold tabular-nums">{formatNumber(reader.counts[key])}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Each action asks for a reason (kept in the log); a suspension also for its last day. */
function Actions({ reader }: { reader: ReaderDetail }) {
  const client = useQueryClient();
  const expiry = useExpiry();
  const [open, setOpen] = useState<Act | null>(null);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async (act: Act) => {
      if (act === "delete") return deleteReaderAccount(reader.id, reason.trim());
      const answer = await readerAction(reader.id, act, {
        reason: reason.trim(),
        ...(act === "suspend" ? { until: new Date(`${until}T23:59:59`).toISOString() } : {}),
      });
      return answer;
    },
    onSuccess: (_answer, act) => {
      setDone(act === "delete" ? "Conta apagada." : act === "remove-content" ? "Conteúdo removido." : "Feito.");
      setOpen(null);
      setReason("");
      setUntil("");
      void client.invalidateQueries({ queryKey: ["admin-reader", reader.id] });
      void client.invalidateQueries({ queryKey: ["admin-reader-activity", reader.id] });
      void client.invalidateQueries({ queryKey: ["admin-reader-audit", reader.id] });
      void client.invalidateQueries({ queryKey: ["admin-readers"] });
      void client.invalidateQueries({ queryKey: ["admin-reader-stats"] });
    },
    onError: expiry,
  });
  const shown = ACTS.filter((entry) => entry.when(reader));
  const current = ACTS.find((entry) => entry.act === open);

  return (
    <div className="mt-4">
      <h2 className="sr-only">Ações</h2>
      <div className="flex flex-wrap gap-2">
        {shown.map((entry) => (
          <button
            key={entry.act}
            type="button"
            aria-expanded={open === entry.act}
            onClick={() => {
              setOpen(open === entry.act ? null : entry.act);
              setDone(null);
            }}
            className={buttonClass(entry.danger ? "danger" : "plain")}
          >
            {entry.label}…
          </button>
        ))}
      </div>
      {current && (
        <form
          className="mt-3 flex flex-col gap-3 rounded-2xl border border-line p-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            run.mutate(current.act);
          }}
        >
          {current.act === "suspend" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-mono text-xs font-bold">Até</span>
              <input type="date" required value={until} onChange={(event) => setUntil(event.target.value)} className={inputClass} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-mono text-xs font-bold">Motivo</span>
            <input
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Fica no registo, ex.: Insultos repetidos"
              className={inputClass}
            />
          </label>
          {current.act === "delete" && <p className="text-sm text-danger">Apagar a conta não se desfaz.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={run.isPending} className={buttonClass(current.danger ? "danger" : "ink")}>
              {current.label}
            </button>
            <button type="button" onClick={() => setOpen(null)} className={buttonClass()}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      <ErrorNote error={run.error} />
      {done && (
        <p role="status" className="mt-2 text-sm">
          {done}
        </p>
      )}
    </div>
  );
}
