"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useAccountGate, useReader } from "@/lib/account";
import { markFollowed } from "@/lib/accountExtras";
import { ApiError } from "@/lib/api/client";
import {
  getInitiativePrediction,
  getMyPredictions,
  getOpenPredictions,
  pickPrediction,
  type MyPredictions,
  type Pick,
  type Prediction,
  type Split,
  type Tally,
} from "@/lib/api/engagement";
import { posterName, type ThreadSummary } from "@/lib/api/forums";
import { formatLongDate, formatNumber, formatTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useVoteThread, VoteNews, VotesBoardBox, VoteThreadPreview } from "./VoteDiscussion";
import { track } from "@/lib/analytics";

/*
 * "Passa ou chumba?" (backend docs/engagement-api.md): before a vote in Parliament, each reader says whether they think
 * the proposal passes, and defends it in the vote's conversation. How everyone picked shows only once the reader has
 * picked (and only with enough picks), so the crowd can't steer them. About proposals, never people; no rankings or
 * public points: each reader's record is theirs alone.
 */

/** Below this many picks, percentages mislead ("100% passa · 1 previsão"): the count only. */
export const MIN_FOR_PERCENT = 20;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const pickWord = (pick: Pick) => (pick === "pass" ? "Passa" : "Chumba");
export const dayAndTime = (value: string) =>
  `${new Intl.DateTimeFormat("pt-PT", { weekday: "short", timeZone: "Europe/Lisbon" }).format(new Date(value)).replace(".", "")} ${formatTime(value)}`;

/** "10 h 55 min", "2 dias", "15 min"; null once it's passed. */
export function timeLeft(until: string | null, now: number): string | null {
  if (!until) return null;
  const left = Date.parse(until) - now;
  if (Number.isNaN(left) || left <= 0) return null;
  const minutes = Math.ceil(left / 60_000);
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
  const days = Math.round(minutes / (24 * 60));
  return days === 1 ? "1 dia" : `${days} dias`;
}

/** The state as the reader sees it: open turns closed the moment the session starts, without waiting for the API. */
function stateNow(item: Prediction, now: number): Prediction["state"] {
  if (item.state === "open" && item.closesAt && Date.parse(item.closesAt) <= now) return "closed";
  if (item.state === "upcoming" && item.opensAt && Date.parse(item.opensAt) <= now) return "open";
  return item.state;
}

const list = (names: string[]) => (names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`);
const groups = (entries: Tally["favor"]) => list(entries.map((entry) => (entry.count ? `${entry.party} (${entry.count})` : entry.party)));

/** "Aprovado com os votos a favor de PSD e CDS-PP, contra de PS e a abstenção de Chega": by group, never deputy totals. */
export function tallyText(result: string, tally: Tally | null): string {
  if (!tally) return result;
  if (tally.unanimous) return `${result} por unanimidade`;
  const parts = [
    tally.favor.length > 0 && `a favor de ${groups(tally.favor)}`,
    tally.against.length > 0 && `contra de ${groups(tally.against)}`,
    tally.abstention.length > 0 && `a abstenção de ${groups(tally.abstention)}`,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? `${result} com os votos ${list(parts)}` : result;
}

/** The subline: who proposed it and its official name ("Governo · Proposta de Lei n.º 110"). Never the phase. */
const byline = (item: Prediction) =>
  [item.author, item.type && item.number ? `${item.type} n.º ${item.number}` : item.type].filter(Boolean).join(" · ");

const countOf = (item: Prediction) => item.count ?? (item.split ? item.split.pass + item.split.fail : 0);

/** The week's list: the page's, the same for everyone; with an account, with the reader's own picks and the split. */
function useOpen(initial: Prediction[], limit: number, upcoming = false) {
  const reader = useReader();
  const mine = useQuery({
    queryKey: ["predictions", "open", limit, upcoming],
    queryFn: () => getOpenPredictions(limit, undefined, { upcoming }),
    enabled: Boolean(reader),
    staleTime: 60_000,
  });
  return (reader && mine.data) || initial;
}

function useChoose(item: Prediction) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (pick: Pick) => pickPrediction(item.id, pick),
    onSuccess: (answer) => {
      track("prediction-pick", { pick: answer.pick, prediction: item.id });
      const before = item.myPick;
      const update = (entry: Prediction) =>
        entry.id === item.id ? { ...entry, myPick: answer.pick, split: answer.split, count: (entry.count ?? 0) + (before ? 0 : 1) } : entry;
      client.setQueriesData<Prediction[]>({ queryKey: ["predictions", "open"] }, (list) => list?.map(update));
      client.setQueriesData<Prediction>({ queryKey: ["prediction", item.id] }, (entry) => (entry ? update(entry) : entry));
      void client.invalidateQueries({ queryKey: ["predictions", "mine"] });
      // Picking follows the vote's thread: its new replies reach the inbox.
      if (item.threadId) markFollowed("thread", item.threadId);
    },
  });
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="-mt-0.5 inline size-3 fill-none stroke-current stroke-2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold normal-case tracking-normal";
const GOLD_TEXT = "text-[#8a6500] dark:text-[#f2c94c]";

export const resultTone = (result: string | null) =>
  !result ? "var(--muted)" : /aprovad/i.test(result) ? "var(--favor)" : /rejeitad|chumbad/i.test(result) ? "var(--contra)" : "var(--ink)";

/**
 * The card, the same in every state (design "Cartão Passa ou chumba?"): before and after picking, few picks, session
 * started, result; and upcoming. The clock weighs more, it's clear what is voted and by whom, percentages show only after
 * picking (and with enough picks), and the conversation is always in sight.
 */
export function PollCard({ item, large = false, showThread = true }: { item: Prediction; large?: boolean; showThread?: boolean }) {
  const gate = useAccountGate();
  const choose = useChoose(item);
  const now = useNow();
  const refusedClosed = choose.error instanceof ApiError && choose.error.code === "closed";
  const state = refusedClosed && item.state === "open" ? "closed" : stateNow(item, now);
  const pick = choose.isPending ? (choose.variables ?? null) : item.myPick;
  const askedToLogIn = choose.error instanceof ApiError && choose.error.code === "login_required";
  const count = countOf(item);
  const enough = count >= MIN_FOR_PERCENT;
  const left = timeLeft(item.closesAt, now);
  const canPick = state === "open";
  const title = item.plain?.title ?? item.title;
  const what = item.voteLabel;

  const tone =
    state === "closed"
      ? "border-[color-mix(in_srgb,#f2c94c_35%,var(--line))] bg-[color-mix(in_srgb,#f2c94c_4%,var(--card))]"
      : state === "decided"
        ? "border-line bg-[var(--card)]"
        : "border-[color-mix(in_srgb,var(--favor)_30%,var(--line))] bg-[color-mix(in_srgb,var(--favor)_4%,var(--card))]";

  const eyebrow =
    state === "closed" ? (
      <span className={GOLD_TEXT}>Previsões fechadas</span>
    ) : state === "decided" ? (
      <span style={{ color: resultTone(item.voteResult) }}>
        {item.voteResult ? `Resultado · ${item.voteResult}` : "Decidida sem votação"}
      </span>
    ) : state === "upcoming" ? (
      <span className="text-muted">Passa ou chumba? · em breve</span>
    ) : (
      <span className="text-[var(--favor)]">Passa ou chumba?</span>
    );

  const corner =
    state === "open" && left ? (
      <span className={`${pill} bg-[color-mix(in_srgb,var(--contra)_16%,transparent)] text-[var(--contra)]`}>
        <span aria-hidden="true">●</span>
        <span className="sr-only">Fecha em </span>
        {left}
      </span>
    ) : state === "closed" ? (
      <span className={`${pill} bg-[color-mix(in_srgb,#f2c94c_18%,transparent)] ${GOLD_TEXT}`}>sessão a decorrer</span>
    ) : state === "decided" && pick && item.outcome && item.outcome !== "void" ? (
      <span
        className={pill}
        style={{
          color: item.outcome === "hit" ? "var(--favor)" : "var(--contra)",
          background: `color-mix(in srgb, ${item.outcome === "hit" ? "var(--favor)" : "var(--contra)"} 16%, transparent)`,
        }}
      >
        {item.outcome === "hit" ? "✓ acertaste" : "✕ falhaste"}
      </span>
    ) : state === "upcoming" && item.opensAt ? (
      <span className={`${pill} bg-surface text-muted`}>abre {dayAndTime(item.opensAt)}</span>
    ) : null;

  const button = (value: Pick, mark: string) => {
    const on = pick === value;
    const color = value === "pass" ? "var(--favor)" : "var(--contra)";
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={choose.isPending || !canPick}
        onClick={(event) => {
          if (gate("predict", event.currentTarget)) return;
          if (!on) choose.mutate(value);
        }}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border font-serif font-bold disabled:cursor-default ${
          large ? "min-h-14 text-lg" : "min-h-11 text-base"
        } ${!canPick ? "opacity-50" : ""}`}
        style={
          on
            ? { color, borderColor: color, background: `color-mix(in srgb, ${color} 14%, transparent)` }
            : { borderColor: "var(--line)", background: "transparent" }
        }
      >
        <span aria-hidden="true">{mark}</span>
        {pickWord(value)}
        <span className="sr-only"> «{title}»</span>
      </button>
    );
  };

  const showSplit = item.split && enough && (pick || state === "closed" || state === "decided");

  return (
    <div className={`rounded-2xl border ${tone} ${large ? "p-4 sm:p-5" : "p-3.5"}`}>
      <p className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
        {eyebrow}
        {corner}
      </p>
      {large && state !== "upcoming" && item.opensAt && item.closesAt && <AgendaBar item={item} now={now} count={count} />}
      {what && <p className={`${large ? "mt-3" : "mt-2"} text-[12px] text-muted`}>O que se vota: a {what.toLowerCase()} de</p>}
      <h3 className={`font-serif font-bold leading-snug ${large ? "text-xl sm:text-2xl" : "text-[17px]"}`}>
        <Link href={`/iniciativas/${item.id}`} className="hover:underline">
          {title}
        </Link>
      </h3>
      <p className="mt-0.5 text-[12px] text-muted">{byline(item)}</p>
      {large && (
        <>
          <Link href={`/iniciativas/${item.id}`} className="mt-1 inline-block font-mono text-[11px] text-ink underline underline-offset-2">
            Ler a proposta em linguagem simples →
          </Link>
        </>
      )}

      {state !== "upcoming" && (
        <div role="group" aria-label={`A tua previsão para «${title}»`} className="mt-3 flex gap-2">
          {button("pass", "✓")}
          {button("fail", "✕")}
        </div>
      )}

      {showSplit && <SplitBar split={item.split!} count={count} />}
      {pick && canPick && !enough && (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 font-mono text-[11px] text-muted">
          Ainda há poucas previsões ({formatNumber(count)}). Mostramos as percentagens a partir de {MIN_FOR_PERCENT}.
        </p>
      )}
      <p className="mt-2 text-[12px] leading-snug">
        {state === "upcoming"
          ? `As previsões abrem ${item.opensAt ? `${formatLongDate(item.opensAt)?.replace(/ de \d{4}$/, "")}, às ${formatTime(item.opensAt)}` : "quando a votação entrar na agenda"}. Entretanto, lê a proposta.`
          : state === "open"
            ? pick
              ? enough
                ? `A tua previsão: ${pickWord(pick)}. Podes mudar até começar a sessão. Passaste a seguir a discussão.`
                : `A tua previsão: ${pickWord(pick)}. És dos primeiros: chama mais gente para a discussão.`
              : "Escolhe e vê o que os outros leitores acham."
            : state === "closed"
              ? pick
                ? `A tua previsão ficou registada: ${pickWord(pick)}. Avisamos-te do resultado.`
                : "A sessão começou: as previsões fecharam. O resultado chega amanhã de manhã."
              : item.voteResult
                ? `${tallyText(item.voteResult, item.tally)}${item.voteDate ? `, a ${formatLongDate(item.voteDate)}` : ""}.${pick ? ` Tinhas dito ${pickWord(pick)}.` : ""}`
                : `Decidida sem votação${pick ? `: a tua previsão (${pickWord(pick)}) não conta` : ""}.`}
      </p>
      {choose.isError && !refusedClosed && !askedToLogIn && (
        <p role="alert" className="mt-2 font-mono text-[11px] text-danger">
          Não contou. Tenta outra vez.
        </p>
      )}

      {showThread && item.threadId && <ThreadTeaser threadId={item.threadId} state={state} picked={Boolean(pick)} />}
      <Link href="/previsoes#como-funciona" className="mt-2 inline-block font-mono text-[10px] text-muted underline underline-offset-2">
        <span aria-hidden="true">ⓘ</span> Como funciona
      </Link>
    </div>
  );
}

/** "entrou na agenda segunda ──●── fecha quando a sessão começa", with how many picked so far. */
function AgendaBar({ item, now, count }: { item: Prediction; now: number; count: number }) {
  const start = Date.parse(item.opensAt!);
  const end = Date.parse(item.closesAt!);
  const done = Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
  const weekday = new Intl.DateTimeFormat("pt-PT", { weekday: "long", timeZone: "Europe/Lisbon" }).format(new Date(start));
  return (
    <div className="mt-2">
      <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-[var(--contra)]" style={{ width: `${done}%` }} />
      </div>
      <p className="mt-1 flex justify-between gap-2 font-mono text-[10px] text-muted">
        <span>abriu {weekday}</span>
        <span>
          {formatNumber(count)} {count === 1 ? "previsão" : "previsões"} até agora
        </span>
        <span className="max-sm:hidden">fecha quando a sessão começa</span>
      </p>
    </div>
  );
}

function SplitBar({ split, count }: { split: Split; count?: number }) {
  const total = split.pass + split.fail;
  const pass = percent(split.pass, total);
  return (
    <div className="mt-3">
      <div aria-hidden="true" className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <span className="rounded-full" style={{ width: `${pass}%`, background: "var(--favor)" }} />
        <span className="rounded-full" style={{ width: `${100 - pass}%`, background: "var(--contra)" }} />
      </div>
      <p className="mt-1 flex justify-between font-mono text-[11px]">
        <b className="text-[var(--favor)]">{pass}% passa</b>
        <span className="text-muted">
          {formatNumber(count ?? total)} {(count ?? total) === 1 ? "previsão" : "previsões"}
        </span>
        <b className="text-[var(--contra)]">{100 - pass}% chumba</b>
      </p>
      <p className="sr-only">
        Os leitores: {pass}% passa, {100 - pass}% chumba.
      </p>
    </div>
  );
}

/** Inside the card: who's discussing, the latest message, and the way in. */
function ThreadTeaser({ threadId, state, picked }: { threadId: number; state: Prediction["state"]; picked: boolean }) {
  const thread = useVoteThread(threadId);
  const posts = (thread.data?.posts ?? []).filter((post) => !post.hidden && post.body);
  const last = posts.at(-1);
  const people = [...new Set(posts.map((post) => posterName(post.nickname)))].slice(-3);
  const replies = thread.data?.thread.replyCount ?? 0;
  const cta =
    state === "decided"
      ? "Ver como acabou a discussão"
      : state === "closed"
        ? "Acompanhar ao vivo"
        : picked
          ? "Defende a tua escolha"
          : "Ver a discussão";
  const highlighted = picked && state === "open";
  return (
    <div
      className={`mt-3 rounded-xl border p-2.5 ${highlighted ? "border-[color-mix(in_srgb,#f2c94c_45%,var(--line))]" : "border-line bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"}`}
    >
      <p className="flex items-center gap-2 font-mono text-[11px]">
        <span aria-hidden="true" className="flex -space-x-1.5">
          {people.map((name) => (
            <span
              key={name}
              className="flex size-5 items-center justify-center rounded-full border border-line bg-surface text-[9px] font-bold uppercase"
            >
              {name.charAt(0)}
            </span>
          ))}
        </span>
        <span>
          <b>{formatNumber(replies)}</b> a discutir
        </span>
        <span
          className={`ml-auto text-[10px] font-bold uppercase tracking-wider ${state === "decided" ? "text-[var(--favor)]" : "text-[var(--contra)]"}`}
        >
          {state === "decided" ? "Terminada" : "● Ao vivo"}
        </span>
      </p>
      {last && (
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px]">
          <b className="shrink-0 font-mono text-[11px]">{posterName(last.nickname)}</b>
          {last.pick && <PickBadge pick={last.pick} />}
          <span className="truncate">{last.body}</span>
        </p>
      )}
      <Link
        href={`/forum/votacoes/${threadId}`}
        className={`mt-2 flex items-center justify-between border-t border-line pt-2 font-mono text-[11px] font-bold ${highlighted ? GOLD_TEXT : ""}`}
      >
        {cta}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function PickBadge({ pick }: { pick: Pick | null }) {
  if (!pick) return <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">sem previsão</span>;
  const color = pick === "pass" ? "var(--favor)" : "var(--contra)";
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <span className="sr-only">Previu: </span>
      {pickWord(pick)}
    </span>
  );
}

/** The week's other votes: open ones come up to the card; upcoming ones say when they open. */
function WeekVotes({ items, onChoose, chosen }: { items: Prediction[]; onChoose: (id: number) => void; chosen: number }) {
  const now = useNow();
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="votacoes-semana" className="mt-6">
      <h2 id="votacoes-semana" className="border-b-2 border-ink pb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        Votações desta semana
      </h2>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const state = stateNow(item, now);
          return (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 font-mono text-[11px] capitalize text-muted">
                {item.closesAt ? dayAndTime(item.closesAt) : "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold leading-snug">{item.plain?.title ?? item.title}</span>
                <span className="font-mono text-[11px] text-muted">{[item.voteLabel, item.author].filter(Boolean).join(" · ")}</span>
              </span>
              {item.id === chosen ? (
                <span className="shrink-0 font-mono text-[11px] text-muted">Em cima</span>
              ) : state === "open" ? (
                <button
                  type="button"
                  onClick={() => onChoose(item.id)}
                  className="shrink-0 font-mono text-[11px] font-bold text-[var(--contra)] hover:underline"
                >
                  ● Aberta · {item.myPick ? "mudar" : "prever"} →<span className="sr-only"> «{item.title}»</span>
                </button>
              ) : (
                <span className="shrink-0 font-mono text-[11px] capitalize text-muted">
                  {item.opensAt ? `Abre ${dayAndTime(item.opensAt)}` : "Em breve"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** On the front page: the next vote to guess, and a way to the rest. */
export function PredictionsCard({ initial, headingId = "passa-ou-chumba" }: { initial: Prediction[]; headingId?: string }) {
  const items = useOpen(initial, 3);
  const first = items.find((item) => item.state === "open") ?? items[0];
  if (!first) return null;
  const more = items.filter((item) => item.state === "open").length - 1;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        Passa ou chumba?
      </h2>
      <PollCard item={first} />
      <Link href="/previsoes" className="mt-2 inline-block font-mono text-[11px] font-bold underline underline-offset-2">
        {more > 0 ? `Mais ${more} ${more === 1 ? "votação" : "votações"} para prever →` : "Todas as votações →"}
      </Link>
    </section>
  );
}

/** The whole page: the chosen vote with its conversation, the board, the week; the record, the news and the rules. */
export function PredictionsPage({ initial, threads = [] }: { initial: Prediction[]; threads?: ThreadSummary[] }) {
  const items = useOpen(initial, 10, true);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const open = items.filter((item) => item.state === "open");
  const chosen = items.find((item) => item.id === chosenId) ?? open[0];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0">
        {chosen ? (
          <>
            <h2 className="sr-only">A votação escolhida</h2>
            <PollCard key={chosen.id} item={chosen} large showThread={false} />
            {chosen.threadId && (
              <VoteThreadPreview key={chosen.threadId} threadId={chosen.threadId} closesAt={chosen.closesAt} title={chosen.title} />
            )}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">
            Sem votações abertas esta semana. Abrimos as previsões quando uma votação entra na agenda do plenário, até uma semana antes.
          </p>
        )}
        <VotesBoardBox threads={threads} open={open} />
        <WeekVotes items={items} chosen={chosen?.id ?? -1} onChoose={setChosenId} />
      </div>
      <aside className="flex flex-col gap-4">
        <RecordBox />
        {chosen && <VoteNews key={chosen.id} initiativeId={chosen.id} />}
        <section id="como-funciona" aria-labelledby="regras" className="scroll-mt-24 rounded-2xl border border-line p-4">
          <h2 id="regras" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Regras
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
            <li>É sobre propostas, nunca sobre pessoas.</li>
            <li>
              Abre uma semana antes da votação no plenário (ou quando entra na agenda, se for mais tarde) e fecha quando a sessão começa.
            </li>
            <li>Ao prever, passas a seguir a discussão da votação.</li>
            <li>Podes mudar a previsão enquanto está aberta.</li>
            <li>Conta a votação que vem, muitas vezes a da generalidade, não a final.</li>
            <li>Sem rankings nem pontos públicos.</li>
            <li>O que os outros previram só aparece depois de escolheres, e só a partir de {MIN_FOR_PERCENT} previsões.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** "O teu registo": right out of decided, a square per prediction (green right, red wrong). Seen only by the reader. */
export function RecordBox() {
  const reader = useReader();
  const mine = useQuery({ queryKey: ["predictions", "mine"], queryFn: getMyPredictions, enabled: Boolean(reader) });
  return (
    <section aria-labelledby="o-teu-registo" className="rounded-2xl border border-line p-4">
      <h2 id="o-teu-registo" className="flex justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        O teu registo
        <span className="font-normal normal-case tracking-normal">
          <LockIcon /> só tu vês
        </span>
      </h2>
      {!reader ? (
        <p className="mt-2 text-sm text-muted">
          <Link href="/entrar?depois=%2Fprevisoes" className="font-bold text-ink underline">
            Entra
          </Link>{" "}
          para guardar as tuas previsões e ver quantas acertas.
        </p>
      ) : mine.data ? (
        <Record data={mine.data} />
      ) : (
        <p className="mt-2 text-sm text-muted">{mine.isError ? "Não foi possível carregar." : "A carregar…"}</p>
      )}
    </section>
  );
}

/** "Acertas mais em habitação (4 de 4) do que em economia (1 de 3)": the best and worst topics, when they differ. */
export function topicInsight(items: MyPredictions["items"]): string | null {
  const byTopic = new Map<string, { label: string; hits: number; total: number }>();
  for (const item of items) {
    if (item.outcome !== "hit" && item.outcome !== "miss") continue;
    for (const topic of item.topics) {
      const entry = byTopic.get(topic.slug) ?? { label: topic.label, hits: 0, total: 0 };
      entry.total += 1;
      if (item.outcome === "hit") entry.hits += 1;
      byTopic.set(topic.slug, entry);
    }
  }
  const ranked = [...byTopic.values()]
    .filter((entry) => entry.total >= 2)
    .sort((a, b) => b.hits / b.total - a.hits / a.total || b.total - a.total);
  const best = ranked[0];
  const worst = ranked.at(-1);
  if (!best || !worst || best === worst || best.hits / best.total === worst.hits / worst.total) return null;
  return `Acertas mais em ${best.label.toLowerCase()} (${best.hits} de ${best.total}) do que em ${worst.label.toLowerCase()} (${worst.hits} de ${worst.total}).`;
}

function Record({ data }: { data: MyPredictions }) {
  const { hits, misses, pending, streak } = data.record;
  const decided = data.items.filter((item) => item.outcome === "hit" || item.outcome === "miss").reverse();
  const insight = topicInsight(data.items);
  if (hits + misses === 0)
    return (
      <p className="mt-2 text-sm text-muted">
        {pending > 0
          ? `${pending === 1 ? "1 previsão à espera" : `${pending} previsões à espera`} da votação.`
          : "Ainda sem previsões. Escolhe «Passa» ou «Chumba» numa votação."}
      </p>
    );
  return (
    <>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-4xl font-bold">
          {hits}
          <span className="text-muted">/{hits + misses}</span>
        </span>
        <span className="font-mono text-[11px] text-muted">previsões certas</span>
      </p>
      <ol aria-label="As tuas previsões decididas, da mais antiga à mais recente" className="mt-3 flex flex-wrap gap-1">
        {decided.slice(-20).map((item) => (
          <li
            key={item.initiativeId}
            title={item.title}
            className="size-5 rounded"
            style={{ background: item.outcome === "hit" ? "var(--favor)" : "var(--contra)" }}
          >
            <span className="sr-only">
              {item.title}: {item.outcome === "hit" ? "certa" : "errada"}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex gap-3 font-mono text-[11px] text-muted">
        <span>
          <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-[var(--favor)]" />
          certa
        </span>
        <span>
          <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-[var(--contra)]" />
          errada
        </span>
        {pending > 0 && <span>{pending} à espera</span>}
      </p>
      {insight && <p className="mt-2 text-sm">{insight}</p>}
      {streak >= 2 && <p className="mt-2 text-sm font-bold">{streak} seguidas!</p>}
      <Link href="/conta/previsoes" className="mt-2 inline-block font-mono text-[11px] font-bold underline">
        Ver todas →
      </Link>
    </>
  );
}

const OUTCOME: Record<"hit" | "miss" | "void", string> = { hit: "Acertaste", miss: "Falhaste", void: "Sem resultado (não conta)" };

/** The reader's whole history. */
export function MyPredictionsList() {
  const reader = useReader();
  const mine = useQuery({ queryKey: ["predictions", "mine"], queryFn: getMyPredictions, enabled: Boolean(reader) });
  if (reader === undefined) return <p className="text-muted">A verificar a sessão…</p>;
  if (!reader)
    return (
      <div className="max-w-xl rounded-2xl border border-dashed border-line p-6">
        <h1 className="text-2xl font-bold">As minhas previsões</h1>
        <p className="mt-2 text-muted">Entra para veres as tuas previsões e quantas acertaste.</p>
        <Link href="/entrar?depois=%2Fconta%2Fprevisoes" className="mt-4 inline-flex font-mono text-sm font-bold underline">
          Entrar
        </Link>
      </div>
    );
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-3xl font-bold">As minhas previsões</h1>
        <p className="mt-2 font-mono text-sm text-muted">Só tu vês isto. Sem rankings: é só para saberes como estás a ler o Parlamento.</p>
        {mine.isPending ? (
          <p className="mt-6 text-muted">A carregar…</p>
        ) : mine.isError ? (
          <p className="mt-6 text-danger">Não foi possível carregar. Tenta recarregar a página.</p>
        ) : mine.data.items.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-muted">
            Ainda não fizeste previsões.{" "}
            <Link href="/previsoes" className="font-bold text-ink underline">
              Passa ou chumba?
            </Link>
          </p>
        ) : (
          <ul aria-label="As minhas previsões" className="mt-6 divide-y divide-line rounded-2xl border border-line">
            {mine.data.items.map((item) => (
              <li key={item.initiativeId} className="p-3">
                <Link href={`/iniciativas/${item.initiativeId}`} className="font-semibold hover:underline">
                  {item.title}
                </Link>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  Disseste {item.pick === "pass" ? "«Passa»" : "«Chumba»"}
                  {item.outcome
                    ? ` · ${OUTCOME[item.outcome]}${item.voteResult ? `: ${item.voteResult.toLowerCase()}` : ""}${item.voteDate ? ` a ${formatLongDate(item.voteDate)}` : ""}`
                    : " · à espera da votação"}
                </p>
                {item.split && item.split.pass + item.split.fail >= MIN_FOR_PERCENT && <SplitBar split={item.split} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside>
        <RecordBox />
      </aside>
    </div>
  );
}

/**
 * On an initiative's page, beside it: its "Passa ou chumba?" in whatever state, kept as history once decided. Nothing
 * when the initiative never had one (404).
 */
export function InitiativePredictionBox({ id }: { id: number }) {
  const reader = useReader();
  const query = useQuery({
    queryKey: ["prediction", id, reader?.id ?? null],
    queryFn: () => getInitiativePrediction(id),
    enabled: reader !== undefined,
    retry: false,
    staleTime: 60_000,
  });
  if (!query.data) return null;
  return (
    <section aria-labelledby="previsao-iniciativa">
      <h2 id="previsao-iniciativa" className="sr-only">
        Passa ou chumba?
      </h2>
      <PollCard item={query.data} />
    </section>
  );
}

/** The vote's prediction for a thread page: its state, kept fresh. */
export function useInitiativePrediction(id: number | null) {
  const reader = useReader();
  return useQuery({
    queryKey: ["prediction", id ?? 0, reader?.id ?? null],
    queryFn: () => getInitiativePrediction(id!),
    enabled: id !== null && reader !== undefined,
    retry: false,
    staleTime: 60_000,
  });
}

/** In the vote's thread, under its opening post: the reader's pick, to make or change while open. */
export function VotePickBar({ item }: { item: Prediction }) {
  const gate = useAccountGate();
  const choose = useChoose(item);
  const now = useNow();
  const state = stateNow(item, now);
  const pick = choose.isPending ? (choose.variables ?? null) : item.myPick;
  const until = item.closesAt
    ? `${formatTime(item.closesAt)} de ${new Intl.DateTimeFormat("pt-PT", { weekday: "long", timeZone: "Europe/Lisbon" }).format(new Date(item.closesAt)).replace("-feira", "")}`
    : null;
  const text =
    state === "open"
      ? pick
        ? `A tua previsão: ${pickWord(pick)}.${until ? ` Podes mudar até às ${until}.` : ""}`
        : "Ainda não escolheste. Passa ou chumba?"
      : pick
        ? `A tua previsão: ${pickWord(pick)}. As previsões fecharam.`
        : "As previsões fecharam.";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5 pl-3">
      <p className="min-w-0 flex-1 basis-48 font-mono text-[12px]">{text}</p>
      <div role="group" aria-label={`A tua previsão para «${item.plain?.title ?? item.title}»`} className="flex gap-1.5">
        {(["pass", "fail"] as const).map((value) => {
          const on = pick === value;
          const color = value === "pass" ? "var(--favor)" : "var(--contra)";
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              disabled={state !== "open" || choose.isPending}
              onClick={(event) => {
                if (gate("predict", event.currentTarget)) return;
                if (!on) choose.mutate(value);
              }}
              className="rounded-full border px-3 py-1 font-mono text-[11px] font-bold disabled:opacity-60"
              style={
                on
                  ? { color, borderColor: color, background: `color-mix(in srgb, ${color} 14%, transparent)` }
                  : { borderColor: "var(--line)" }
              }
            >
              {value === "pass" ? "✓ Passa" : "✕ Chumba"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
