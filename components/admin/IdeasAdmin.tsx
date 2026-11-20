"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { replyAsTeam, setIdeaStatus } from "@/lib/api/admin";
import {
  getThread,
  getThreads,
  IDEA_STATUS_LABELS,
  IDEA_STATUSES,
  IDEAS_BOARD,
  posterName,
  type IdeaStatus,
  type ThreadSummary,
} from "@/lib/api/forums";
import { formatDateTime } from "@/lib/format";
import { ideaStatusBody } from "@/lib/ideaAdmin";
import { IdeaStatusBadge } from "@/components/ideas/IdeaBits";
import { buttonClass, Empty, ErrorNote, inputClass, Tabs, useExpiry } from "./ui";

/** «Sem estado»: nobody from the team has looked yet. The API can't filter for it, so it's the newest ideas without one. */
type Filter = "none" | IdeaStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "none", label: "Sem estado" },
  ...IDEA_STATUSES.map((status) => ({ value: status, label: IDEA_STATUS_LABELS[status].label })),
  { value: "all", label: "Todas" },
];
const LIMIT = 50;

/** The ideas board, for the team: a status for each idea, the answer readers see pinned, when it's expected, and replies as «Politicando». */
export function IdeasAdmin() {
  const [filter, setFilter] = useState<Filter>("none");
  // Shown above the list: a saved idea can leave the tab it was in.
  const [done, setDone] = useState<string | null>(null);
  const ideas = useQuery({
    queryKey: ["admin-ideas", filter],
    queryFn: () =>
      getThreads(IDEAS_BOARD, { sort: "new", limit: LIMIT, status: filter === "none" || filter === "all" ? undefined : filter }),
  });
  const items = (ideas.data?.items ?? []).filter((idea) => filter !== "none" || idea.status === null);

  return (
    <section aria-labelledby="ideias-admin">
      <h1 id="ideias-admin" className="mb-1 text-2xl font-bold">
        Ideias
      </h1>
      <p className="mb-4 text-sm text-muted">
        O estado e a resposta aparecem na ideia, fixados por cima dos comentários, e quem a segue recebe uma notificação. Para esconder ou
        fechar uma ideia, usa a secção Fórum.
      </p>
      <Tabs label="Estado" options={FILTERS} value={filter} onChange={setFilter} />
      {filter === "none" && <p className="-mt-2 mb-4 font-mono text-xs text-muted">Das {LIMIT} ideias mais recentes.</p>}
      {done && (
        <p role="status" className="mb-3 rounded-xl bg-surface px-3 py-2 text-sm">
          {done}
        </p>
      )}
      <ErrorNote error={ideas.error} />
      {ideas.isPending ? (
        <p className="text-muted">A carregar…</p>
      ) : items.length === 0 ? (
        <Empty>{filter === "none" ? "Todas as ideias recentes já têm estado." : "Sem ideias aqui."}</Empty>
      ) : (
        <ul aria-label="Ideias" className="flex flex-col gap-3">
          {items.map((idea) => (
            <li key={idea.id}>
              <IdeaCard idea={idea} onDone={setDone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Done = (message: string) => void;

function IdeaCard({ idea, onDone }: { idea: ThreadSummary; onDone: Done }) {
  const [replying, setReplying] = useState(false);
  return (
    <article aria-labelledby={`ideia-${idea.id}`} className="rounded-2xl border border-line p-4">
      <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
        <span className="font-bold text-ink">▲ {idea.score ?? 0}</span>
        <span>#{idea.id}</span>
        <span aria-hidden="true">·</span>
        <span>{posterName(idea.nickname)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDateTime(idea.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{idea.replyCount === 1 ? "1 comentário" : `${idea.replyCount} comentários`}</span>
        {idea.area && (
          <>
            <span aria-hidden="true">·</span>
            <span>{idea.area}</span>
          </>
        )}
        <IdeaStatusBadge status={idea.status} />
      </p>
      <h2 id={`ideia-${idea.id}`} className="break-words text-lg font-bold leading-snug">
        {idea.title}
      </h2>
      {idea.excerpt && <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-muted">{idea.excerpt}</p>}
      <DecisionForm idea={idea} onDone={onDone} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" aria-expanded={replying} onClick={() => setReplying(!replying)} className={buttonClass()}>
          {replying ? "Fechar resposta" : "Responder como Politicando"}
        </button>
        <Link href={`/feedback/ideias/${idea.id}`} target="_blank" className="font-mono text-xs text-link underline">
          Ver no site ↗
        </Link>
      </div>
      {replying && (
        <TeamReply
          id={idea.id}
          onDone={() => {
            setReplying(false);
            onDone(`Comentário publicado em «${idea.title}».`);
          }}
        />
      )}
    </article>
  );
}

/** Status, answer, expected date and, for a duplicate, the original's number. */
function DecisionForm({ idea, onDone }: { idea: ThreadSummary; onDone: Done }) {
  const client = useQueryClient();
  const expiry = useExpiry();
  const [status, setStatus] = useState<IdeaStatus | null>(idea.status);
  const [answer, setAnswer] = useState(idea.answer ?? "");
  const [expectedOn, setExpectedOn] = useState(idea.expectedOn ?? "");
  const [duplicateOf, setDuplicateOf] = useState(idea.duplicateOf ? String(idea.duplicateOf.id) : "");
  const [invalid, setInvalid] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof setIdeaStatus>[1]) => setIdeaStatus(idea.id, body),
    onSuccess: (saved) => {
      onDone(
        `Guardado: «${idea.title}» está ${saved.status ? `«${IDEA_STATUS_LABELS[saved.status as IdeaStatus]?.label ?? saved.status}»` : "sem estado"}.`,
      );
      return client.invalidateQueries({ queryKey: ["admin-ideas"] });
    },
    onError: expiry,
  });
  const field = `ideia-${idea.id}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = ideaStatusBody(idea, { status, answer, expectedOn, duplicateOf });
    setInvalid(result.ok ? null : result.error);
    if (result.ok) save.mutate(result.body);
  }

  return (
    <form
      onSubmit={submit}
      aria-label={`Decisão sobre «${idea.title}»`}
      className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Estado</span>
        <select
          value={status ?? ""}
          onChange={(event) => setStatus((event.target.value || null) as IdeaStatus | null)}
          className={inputClass}
        >
          <option value="">Sem estado</option>
          {IDEA_STATUSES.map((value) => (
            <option key={value} value={value}>
              {IDEA_STATUS_LABELS[value].label}
            </option>
          ))}
        </select>
      </label>
      {status === "duplicate" ? (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Duplicada da ideia n.º</span>
          <input
            inputMode="numeric"
            value={duplicateOf}
            onChange={(event) => setDuplicateOf(event.target.value)}
            placeholder="ex.: 12"
            aria-describedby={`${field}-dup`}
            className={inputClass}
          />
          <span id={`${field}-dup`} className="text-xs text-muted">
            O número está no endereço da ideia original (/feedback/ideias/12). Os votos passam a contar lá.
          </span>
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">
            Previsto para <span className="font-normal text-muted">· opcional</span>
          </span>
          <input type="date" value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} className={inputClass} />
        </label>
      )}
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="font-mono text-xs font-bold">
          Resposta da equipa <span className="font-normal text-muted">· fica fixada na ideia</span>
        </span>
        <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3} maxLength={2000} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={save.isPending} className={buttonClass("ink")}>
          {save.isPending ? "A guardar…" : "Guardar"}
        </button>
        {invalid ? (
          <p role="alert" className="text-sm text-danger">
            {invalid}
          </p>
        ) : (
          <ErrorNote error={save.error} />
        )}
      </div>
    </form>
  );
}

/** A reply signed «Politicando» (EQUIPA on the site), to the idea or under one of its comments. */
function TeamReply({ id, onDone }: { id: number; onDone: () => void }) {
  const client = useQueryClient();
  const expiry = useExpiry();
  const detail = useQuery({ queryKey: ["admin-thread", id], queryFn: () => getThread(id) });
  const [replyTo, setReplyTo] = useState("");
  const [body, setBody] = useState("");
  const [empty, setEmpty] = useState(false);
  const send = useMutation({
    mutationFn: () => replyAsTeam(id, body.trim(), replyTo ? Number(replyTo) : null),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-ideas"] });
      client.invalidateQueries({ queryKey: ["admin-thread", id] });
      setBody("");
      setReplyTo("");
      onDone();
    },
    onError: expiry,
  });
  const comments = (detail.data?.posts ?? []).filter((post) => !post.hidden && post.body);

  function submit(event: FormEvent) {
    event.preventDefault();
    setEmpty(!body.trim());
    if (body.trim()) send.mutate();
  }

  return (
    <form onSubmit={submit} aria-label="Responder como Politicando" className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Responder a</span>
        <select value={replyTo} onChange={(event) => setReplyTo(event.target.value)} className={inputClass}>
          <option value="">À ideia (comentário novo)</option>
          {comments.map((post) => (
            <option key={post.id} value={post.id}>
              No.{post.id} · {posterName(post.nickname)}: {post.body!.slice(0, 60)}
              {post.body!.length > 60 ? "…" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Comentário da equipa</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={5000} className={inputClass} />
      </label>
      <p className="text-xs text-muted">Aparece assinada «Politicando», com a marca EQUIPA, e avisa quem segue a ideia.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={send.isPending} className={buttonClass("ink")}>
          {send.isPending ? "A publicar…" : "Publicar como Politicando"}
        </button>
        {empty ? (
          <p role="alert" className="text-sm text-danger">
            Escreve o comentário antes de o publicar.
          </p>
        ) : (
          <ErrorNote error={send.error ?? detail.error} />
        )}
      </div>
    </form>
  );
}
