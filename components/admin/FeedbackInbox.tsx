"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  answerMessage,
  type AnswerChannel,
  closeMessage,
  correctMessage,
  CORRECTION_STATUS_LABELS,
  CORRECTION_STATUSES,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUS_LABELS,
  getMessage,
  getMessages,
  noteMessage,
  screenshotUrl,
  type FeedbackMessage,
  type FeedbackStatus,
} from "@/lib/api/admin";
import { formatDateTime } from "@/lib/format";
import { buttonClass, ConfirmButton, Empty, ErrorNote, inputClass, Tabs, useExpiry } from "./ui";

type Filter = FeedbackStatus | "all";

/** Readers' messages: read them (with the screenshot), answer, keep a note, turn an error into a correction, close. */
export function FeedbackInbox() {
  const [filter, setFilter] = useState<Filter>("open");
  const [selected, setSelected] = useState<number | null>(null);
  const expiry = useExpiry();
  const messages = useQuery({ queryKey: ["admin-feedback", filter], queryFn: () => getMessages(filter === "all" ? null : filter) });
  if (messages.isError) expiry(messages.error);

  return (
    <section aria-labelledby="feedback-admin">
      <h1 id="feedback-admin" className="mb-1 text-2xl font-bold">
        Feedback
      </h1>
      <p className="mb-4 text-sm text-muted">
        O que chega pelo formulário de feedback. As ideias vão para o quadro de ideias, por isso aqui ficam sobretudo erros e problemas.
      </p>
      <Tabs
        label="Estado das mensagens"
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setSelected(null);
        }}
        options={[
          { value: "open", label: FEEDBACK_STATUS_LABELS.open },
          { value: "answered", label: FEEDBACK_STATUS_LABELS.answered },
          { value: "closed", label: FEEDBACK_STATUS_LABELS.closed },
          { value: "all", label: "Todas" },
        ]}
      />
      <ErrorNote error={messages.error} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          {messages.isPending ? (
            <p className="text-muted">A carregar…</p>
          ) : messages.data && messages.data.length === 0 ? (
            <Empty>Sem mensagens aqui.</Empty>
          ) : (
            <ul aria-label="Mensagens" className="flex flex-col gap-2">
              {messages.data?.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    aria-pressed={selected === message.id}
                    onClick={() => setSelected(message.id)}
                    className={`w-full rounded-xl border p-3 text-left ${selected === message.id ? "border-ink bg-surface" : "border-line hover:bg-surface"}`}
                  >
                    <span className="mb-1 flex flex-wrap gap-x-2 font-mono text-xs text-muted">
                      <b className="text-ink">{FEEDBACK_KIND_LABELS[message.kind] ?? message.kind}</b>
                      {message.page && <span>{message.page}</span>}
                      <span>{formatDateTime(message.createdAt)}</span>
                    </span>
                    <span className="line-clamp-2 block break-words text-sm">{message.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selected !== null ? (
          <MessageDetail key={selected} id={selected} />
        ) : (
          <p className="hidden rounded-2xl border border-dashed border-line p-6 text-center text-muted lg:block">Escolhe uma mensagem.</p>
        )}
      </div>
    </section>
  );
}

function MessageDetail({ id }: { id: number }) {
  const client = useQueryClient();
  const expiry = useExpiry();
  const message = useQuery({ queryKey: ["admin-message", id], queryFn: () => getMessage(id) });
  const refresh = (updated?: FeedbackMessage) => {
    if (updated) client.setQueryData(["admin-message", id], (old: FeedbackMessage | undefined) => ({ ...old, ...updated }));
    client.invalidateQueries({ queryKey: ["admin-message", id] });
    client.invalidateQueries({ queryKey: ["admin-feedback"] });
  };
  const close = useMutation({ mutationFn: () => closeMessage(id), onSuccess: () => refresh(), onError: expiry });

  if (message.isPending) return <p className="text-muted">A carregar…</p>;
  if (!message.data) return <ErrorNote error={message.error} />;
  const item = message.data;

  return (
    <article aria-label={`Mensagem #${item.id}`} className="flex flex-col gap-5 rounded-2xl border border-line p-4 sm:p-5">
      <header>
        <p className="font-mono text-xs text-muted">
          #{item.id} · {FEEDBACK_KIND_LABELS[item.kind] ?? item.kind} · {formatDateTime(item.createdAt)} ·{" "}
          <b className="text-ink">{FEEDBACK_STATUS_LABELS[item.status]}</b>
        </p>
        {(item.page || item.url) && (
          <p className="mt-1 text-sm">
            {item.page && <b>{item.page}</b>}
            {item.page && item.url && " · "}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-link underline">
                {item.url}
              </a>
            )}
          </p>
        )}
      </header>

      <p className="whitespace-pre-line break-words leading-relaxed">{item.message}</p>

      {(item.correction || item.source) && (
        <dl className="grid gap-2 rounded-xl bg-surface p-3 text-sm">
          {item.correction && (
            <div>
              <dt className="font-mono text-xs font-bold">A informação certa</dt>
              <dd className="whitespace-pre-line break-words">{item.correction}</dd>
            </div>
          )}
          {item.source && (
            <div>
              <dt className="font-mono text-xs font-bold">Onde se confirma</dt>
              <dd className="whitespace-pre-line break-words">{item.source}</dd>
            </div>
          )}
        </dl>
      )}

      {item.screenshot && (
        <a href={screenshotUrl(item.id)} target="_blank" rel="noopener noreferrer" className="block">
          {/* Served by our server with the session; not something the image optimiser can fetch. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl(item.id)}
            alt="Captura de ecrã enviada com a mensagem"
            className="max-h-96 rounded-xl border border-line"
          />
        </a>
      )}

      <p className="text-sm">
        <span className="font-mono text-xs font-bold">Contacto: </span>
        {item.email ? (
          <a href={`mailto:${item.email}`} className="text-link underline">
            {item.email}
          </a>
        ) : (
          <span className="text-muted">{item.status === "closed" ? "apagado ao fechar" : "anónimo, sem email"}</span>
        )}
      </p>

      {item.corrections && item.corrections.length > 0 && (
        <div className="text-sm">
          <p className="font-mono text-xs font-bold">Correções feitas a partir desta mensagem</p>
          <ul className="mt-1 list-disc pl-5">
            {item.corrections.map((correction) => (
              <li key={correction.id}>
                {correction.title} <span className="text-muted">({correction.date})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AnswerForm item={item} onDone={refresh} />
      <NoteForm item={item} onDone={refresh} />
      {item.kind === "error" || item.correction ? <CorrectionForm item={item} onDone={() => refresh()} /> : null}

      {item.status !== "closed" && (
        <div className="border-t border-line pt-4">
          <ErrorNote error={close.error} />
          <p className="mb-2 text-xs text-muted">Fechar apaga o email desta pessoa, como diz a política de privacidade.</p>
          <ConfirmButton
            label="Fechar mensagem"
            confirmLabel="Fechar e apagar o email"
            disabled={close.isPending}
            onConfirm={() => close.mutate()}
          />
        </div>
      )}
    </article>
  );
}

const SENT: Record<AnswerChannel, string> = {
  site: "Resposta publicada no site.",
  email: "Resposta enviada por email.",
  none: "Marcada como respondida.",
};

/** Where an answer on the site reaches the reader, in words. */
function siteReach(item: FeedbackMessage) {
  if (!item.followable) return "Já ninguém a pode ler no site: foi fechada e não veio de uma conta.";
  return item.account
    ? "Enviada com sessão iniciada: a resposta no site chega aos avisos da pessoa e ao link privado dela."
    : "Enviada sem conta: a resposta no site aparece no link privado que a pessoa recebeu ao enviar.";
}

function AnswerForm({ item, onDone }: { item: FeedbackMessage; onDone: (updated: FeedbackMessage) => void }) {
  const expiry = useExpiry();
  const [reply, setReply] = useState(item.reply ?? "");
  const answer = useMutation({
    mutationFn: (channel: AnswerChannel) => answerMessage(item.id, reply.trim() || null, channel),
    onSuccess: onDone,
    onError: expiry,
  });
  const empty = !reply.trim();
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 border-t border-line pt-4">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Resposta</span>
        <textarea rows={4} value={reply} maxLength={5000} onChange={(event) => setReply(event.target.value)} className={inputClass} />
      </label>
      <p className="text-xs text-muted">{siteReach(item)}</p>
      {item.answeredAt && <p className="text-xs text-muted">Respondida em {formatDateTime(item.answeredAt)}.</p>}
      <ErrorNote error={answer.error} />
      {answer.isSuccess && answer.variables && (
        <p role="status" className="text-sm text-[var(--stage-approved)]">
          {SENT[answer.variables]}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {item.followable && (
          <button type="button" disabled={answer.isPending || empty} onClick={() => answer.mutate("site")} className={buttonClass("ink")}>
            Responder no site
          </button>
        )}
        {item.email && (
          <button
            type="button"
            disabled={answer.isPending || empty}
            onClick={() => answer.mutate("email")}
            className={buttonClass(item.followable ? "plain" : "ink")}
          >
            Responder por email
          </button>
        )}
        <button type="button" disabled={answer.isPending} onClick={() => answer.mutate("none")} className={buttonClass()}>
          Marcar como respondida
        </button>
      </div>
      <p className="text-xs text-muted">
        «Marcar como respondida» serve para quando respondeste do teu email, ou quando não há nada a responder. O texto, se houver, também
        aparece no link privado da pessoa.
      </p>
    </form>
  );
}

function NoteForm({ item, onDone }: { item: FeedbackMessage; onDone: (updated: FeedbackMessage) => void }) {
  const expiry = useExpiry();
  const [note, setNote] = useState(item.note ?? "");
  const save = useMutation({ mutationFn: () => noteMessage(item.id, note.trim() || null), onSuccess: onDone, onError: expiry });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-2 border-t border-line pt-4"
    >
      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold">Nota interna</span>
        <textarea rows={2} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} className={inputClass} />
      </label>
      <ErrorNote error={save.error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={save.isPending} className={buttonClass()}>
          Guardar nota
        </button>
        {save.isSuccess && (
          <span role="status" className="text-xs text-muted">
            Guardada.
          </span>
        )}
      </div>
    </form>
  );
}

function CorrectionForm({ item, onDone }: { item: FeedbackMessage; onDone: () => void }) {
  const expiry = useExpiry();
  const [status, setStatus] = useState<(typeof CORRECTION_STATUSES)[number]>("fixed");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState(item.url?.replace(/^https?:\/\/[^/]+/, "") ?? "");
  const [area, setArea] = useState(item.page ?? "");
  const create = useMutation({
    mutationFn: () => correctMessage(item.id, { status, title: title.trim(), url: url.trim() || null, area: area.trim() || undefined }),
    onSuccess: () => {
      setTitle("");
      onDone();
    },
    onError: expiry,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) create.mutate();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line pt-4">
      <p className="font-mono text-xs font-bold">Passar ao registo público de correções</p>
      <p className="text-xs text-muted">O registo nunca diz quem pediu.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs">O que foi corrigido</span>
          <input
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
            placeholder="ex.: Partido de um deputado corrigido"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs">Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputClass}>
            {CORRECTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CORRECTION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs">Secção</span>
          <input
            value={area}
            maxLength={100}
            onChange={(event) => setArea(event.target.value)}
            className={inputClass}
            placeholder="ex.: Percursos"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs">Ligação (opcional)</span>
          <input
            value={url}
            maxLength={1000}
            onChange={(event) => setUrl(event.target.value)}
            className={inputClass}
            placeholder="/percursos"
          />
        </label>
      </div>
      <ErrorNote error={create.error} />
      {create.isSuccess && (
        <p role="status" className="text-sm text-[var(--stage-approved)]">
          Correção registada.
        </p>
      )}
      <div>
        <button type="submit" disabled={create.isPending || !title.trim()} className={buttonClass("ink")}>
          Registar correção
        </button>
      </div>
    </form>
  );
}
