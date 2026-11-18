"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useAccountGate, useReader } from "@/lib/account";
import { ApiError } from "@/lib/api/client";
import {
  getMyPredictions,
  getOpenPredictions,
  pickPrediction,
  type MyPredictions,
  type Pick,
  type Prediction,
  type Split,
} from "@/lib/api/engagement";
import { formatLongDate, formatNumber } from "@/lib/format";

/*
 * "Passa ou chumba?" (backend docs/engagement-api.md): before a vote in Parliament, each reader says whether they think
 * the proposal passes. How everyone picked shows only once the reader has picked, so the crowd can't steer them. About
 * proposals, never people; no rankings or public points: each reader's record is theirs alone.
 */

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const label = (item: Prediction) => [item.type, item.number && `n.º ${item.number}`].filter(Boolean).join(" ");
const when = (item: Prediction) => (item.onAgenda ? "Na agenda do plenário" : (item.phase ?? "À espera de votação"));

/** The open list: the page's, the same for everyone; with an account, with the reader's own picks and the split. */
function useOpen(initial: Prediction[], limit: number) {
  const reader = useReader();
  const mine = useQuery({
    queryKey: ["predictions", "open", limit],
    queryFn: () => getOpenPredictions(limit),
    enabled: Boolean(reader),
    staleTime: 60_000,
  });
  return (reader && mine.data) || initial;
}

function useChoose(item: Prediction, limit: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (pick: Pick) => pickPrediction(item.id, pick),
    onSuccess: (answer) => {
      for (const key of [limit, 10])
        client.setQueryData<Prediction[]>(["predictions", "open", key], (list) =>
          list?.map((entry) => (entry.id === item.id ? { ...entry, myPick: answer.pick, split: answer.split } : entry)),
        );
      void client.invalidateQueries({ queryKey: ["predictions", "mine"] });
    },
  });
}

/** One proposal, with the two big buttons; the split once the reader has picked. */
function PredictionCard({ item, limit, compact = false }: { item: Prediction; limit: number; compact?: boolean }) {
  const gate = useAccountGate();
  const choose = useChoose(item, limit);
  const pick = choose.isPending ? choose.variables : item.myPick;
  const closed = choose.error instanceof ApiError && choose.error.code === "closed";

  const button = (value: Pick, text: string, mark: string) => {
    const on = pick === value;
    const tone = value === "pass" ? "var(--favor)" : "var(--contra)";
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={choose.isPending}
        onClick={(event) => {
          if (gate("predict", event.currentTarget)) return;
          if (!on) choose.mutate(value);
        }}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border font-serif font-bold ${compact ? "min-h-10 text-base" : "min-h-14 text-lg"}`}
        style={
          on
            ? { color: tone, borderColor: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }
            : { borderColor: "var(--line)", background: "var(--card)" }
        }
      >
        <span aria-hidden="true">{mark}</span>
        {text}
        <span className="sr-only"> «{item.title}»</span>
      </button>
    );
  };

  return (
    <div
      className={`rounded-2xl border border-[color-mix(in_srgb,var(--favor)_30%,var(--line))] bg-[color-mix(in_srgb,var(--favor)_4%,transparent)] ${compact ? "p-3" : "p-4 sm:p-5"}`}
    >
      <p className="flex flex-wrap justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--favor)]">
        <span>Passa ou chumba? · {when(item)}</span>
        {!compact && item.phaseDate && (
          <span className="font-normal normal-case tracking-normal text-muted">{formatLongDate(item.phaseDate)}</span>
        )}
      </p>
      {compact ? (
        <h3 className="mt-1.5 font-serif text-base font-bold leading-snug">
          <Link href={`/iniciativas/${item.id}`} className="hover:underline">
            {item.title}
          </Link>
        </h3>
      ) : (
        <>
          <h3 className="mt-2 font-serif text-xl font-bold leading-snug sm:text-2xl">{item.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {label(item)}
            {item.phase && item.onAgenda && ` · ${item.phase}`}
          </p>
          <Link href={`/iniciativas/${item.id}`} className="mt-1 inline-block font-mono text-[11px] text-ink underline underline-offset-2">
            Ler a proposta →
          </Link>
        </>
      )}
      <div role="group" aria-label={`A tua previsão para «${item.title}»`} className={`${compact ? "mt-2" : "mt-3"} flex gap-2`}>
        {button("pass", "Passa", "✓")}
        {button("fail", "Chumba", "✕")}
      </div>
      {item.split ? (
        <SplitBar split={item.split} compact={compact} />
      ) : compact ? (
        <p className="mt-2 font-mono text-[11px] text-muted">
          <LockIcon /> Os outros leitores só aparecem depois de escolheres.
        </p>
      ) : (
        <>
          <p className="mt-2 font-mono text-[11px] text-muted">Escolhe uma opção. Não há resposta certa antes da votação.</p>
          <p className="mt-1 font-mono text-[11px] text-muted">
            <LockIcon /> O que os outros leitores previram só aparece depois de escolheres.
          </p>
        </>
      )}
      {closed && <p className="mt-2 font-mono text-[11px] text-muted">Já foi votada: já não dá para prever.</p>}
      {choose.isError && !closed && (
        <p role="alert" className="mt-2 font-mono text-[11px] text-muted">
          Não contou. Tenta outra vez.
        </p>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="-mt-0.5 inline size-3 fill-none stroke-current stroke-2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function SplitBar({ split, compact = false }: { split: Split; compact?: boolean }) {
  const total = split.pass + split.fail;
  const pass = percent(split.pass, total);
  return (
    <div className="mt-3">
      <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-surface">
        <span style={{ width: `${pass}%`, background: "var(--favor)" }} />
        <span style={{ width: `${100 - pass}%`, background: "var(--contra)" }} />
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted">
        Os leitores: {pass}% passa · {100 - pass}% chumba · {formatNumber(total)} {total === 1 ? "previsão" : "previsões"}
        {compact ? "" : ". Podes mudar até à votação."}
      </p>
    </div>
  );
}

/** The other open votes: pressing "Prever" brings one up to the card. */
function OtherVotes({ items, onChoose, chosen }: { items: Prediction[]; onChoose: (id: number) => void; chosen: number }) {
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="outras-votacoes" className="mt-5">
      <h3 id="outras-votacoes" className="border-b-2 border-ink pb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        Próximas votações
      </h3>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span className="w-20 shrink-0 font-mono text-[11px] text-muted">
              {item.phaseDate ? formatLongDate(item.phaseDate)?.replace(/ de \d{4}$/, "") : "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</span>
              <span className="font-mono text-[11px] text-muted">{when(item)}</span>
            </span>
            {item.id === chosen ? (
              <span className="shrink-0 font-mono text-[11px] text-muted">Em cima</span>
            ) : (
              <button
                type="button"
                onClick={() => onChoose(item.id)}
                className="shrink-0 font-mono text-[11px] font-bold text-[var(--favor)] hover:underline"
              >
                {item.myPick ? "Mudar →" : "Prever →"}
                <span className="sr-only"> «{item.title}»</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** On the front page: the next vote to guess, and a way to the rest. */
export function PredictionsCard({ initial, headingId = "passa-ou-chumba" }: { initial: Prediction[]; headingId?: string }) {
  const items = useOpen(initial, 3);
  const first = items[0];
  if (!first) return null;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        Passa ou chumba?
      </h2>
      <PredictionCard item={first} limit={3} compact />
      <Link href="/previsoes" className="mt-2 inline-block font-mono text-[11px] font-bold underline underline-offset-2">
        {items.length > 1 ? `Mais ${items.length - 1} votações para prever →` : "Como funciona →"}
      </Link>
    </section>
  );
}

/** The whole page: the chosen vote, the others, the reader's record and the rules. */
export function PredictionsPage({ initial }: { initial: Prediction[] }) {
  const items = useOpen(initial, 10);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const chosen = items.find((item) => item.id === chosenId) ?? items[0];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0">
        {chosen ? (
          <>
            <h2 className="sr-only">A votação escolhida</h2>
            <PredictionCard key={chosen.id} item={chosen} limit={10} />
            <OtherVotes items={items} chosen={chosen.id} onChoose={setChosenId} />
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">
            Não há votações à espera agora. Volta quando houver propostas agendadas no Parlamento.
          </p>
        )}
      </div>
      <aside className="flex flex-col gap-4">
        <RecordBox />
        <section aria-labelledby="regras" className="rounded-2xl border border-line p-4">
          <h2 id="regras" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Regras
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
            <li>É sobre propostas, nunca sobre pessoas.</li>
            <li>Podes mudar a previsão até à votação. Conta a partir do dia seguinte à última mudança.</li>
            <li>Conta a próxima votação decisiva, muitas vezes a da generalidade, não a final.</li>
            <li>Sem rankings nem pontos públicos.</li>
            <li>O que os outros previram só aparece depois de escolheres.</li>
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

function Record({ data }: { data: MyPredictions }) {
  const { hits, misses, pending, streak } = data.record;
  const decided = data.items.filter((item) => item.outcome === "hit" || item.outcome === "miss").reverse();
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
                {item.split && <SplitBar split={item.split} />}
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
