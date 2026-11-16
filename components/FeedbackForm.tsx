"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { sendFeedback, type FeedbackKind } from "@/lib/api/feedback";
import { IDEAS_BOARD } from "@/lib/api/forums";
import { CONTACT_EMAIL } from "@/lib/site";
import { Captcha, isCaptchaConfigured, isCaptchaOff, type CaptchaHandle } from "./Captcha";
import { NewThreadForm } from "./forum/NewThreadForm";

const CAPTCHA_OFF_TOKEN = "captcha-disabled";
const MAX_LENGTH = 1000;
const MAX_FILE = 5 * 1024 * 1024;

const KINDS: { key: FeedbackKind; icon: string; title: string; text: string; color: string }[] = [
  { key: "error", icon: "!", title: "Encontrei um erro", text: "Um número, uma data ou um nome errado", color: "var(--stage-stopped)" },
  { key: "idea", icon: "✦", title: "Tenho uma ideia", text: "Algo que gostavas de ver no site", color: "var(--stage-debate)" },
  {
    key: "broken",
    icon: "⚙",
    title: "Algo não funciona",
    text: "Uma página que não abre ou um botão parado",
    color: "var(--stage-submitted)",
  },
  { key: "other", icon: "…", title: "Outra coisa", text: "Elogios, críticas, parcerias", color: "var(--muted)" },
];

const MESSAGE: Record<FeedbackKind, { label: string; placeholder: string }> = {
  error: {
    label: "O que está errado?",
    placeholder: "ex.: Na página de Percursos, uma pessoa aparece só como deputada, mas é Presidente da Assembleia.",
  },
  idea: { label: "Qual é a ideia?", placeholder: "ex.: Receber um alerta quando o partido que sigo é notícia." },
  broken: { label: "O que acontece?", placeholder: "ex.: Ao carregar em «Votações», a página fica em branco. Uso o Safari no iPhone." },
  other: { label: "A tua mensagem", placeholder: "Escreve à vontade." },
};

const ERRORS: Record<string, string> = {
  rate_limited: "Enviaste várias mensagens seguidas. Espera uns minutos e tenta de novo.",
  captcha_failed: "A verificação anti-robô falhou. Tenta outra vez.",
  captcha_unavailable: "A verificação anti-robô não está a responder. Tenta daqui a pouco.",
  file_too_large: "A captura de ecrã tem mais de 5 MB.",
  unsupported_file: "A captura de ecrã tem de ser PNG ou JPG.",
};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm placeholder:text-muted focus:border-muted focus:outline-none";
const small = "font-mono text-[11px] font-bold";
const step = "mb-3 border-b-2 border-ink pb-2 font-mono text-xs font-bold uppercase tracking-widest";

/** The feedback form: what about, the details, and whether the reader wants an answer. */
export function FeedbackForm({
  pages,
  ideasOpen = false,
  initialPage,
  initialUrl,
}: {
  pages: string[];
  /** When the ideas board is open, an idea is posted there, in public, instead of sent to us. */
  ideasOpen?: boolean;
  initialPage: string | null;
  initialUrl: string | null;
}) {
  const id = useId();
  const captcha = useRef<CaptchaHandle>(null);
  const [kind, setKind] = useState<FeedbackKind>("error");
  const [page, setPage] = useState(initialPage ?? pages[0]!);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [message, setMessage] = useState("");
  const [correction, setCorrection] = useState("");
  const [source, setSource] = useState("");
  const [answer, setAnswer] = useState(false);
  const [email, setEmail] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const captchaOff = isCaptchaOff();
  const withPage = kind === "error" || kind === "broken";

  const mutation = useMutation({
    mutationFn: sendFeedback,
    onError: (failure) =>
      setError(
        (failure instanceof ApiError && failure.code && ERRORS[failure.code]) ||
          `Não conseguimos enviar agora. Tenta mais tarde, ou escreve para ${CONTACT_EMAIL}.`,
      ),
    onSettled: () => captcha.current?.reset(),
  });

  function choose(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return setError(ERRORS.unsupported_file!);
    if (file.size > MAX_FILE) return setError(ERRORS.file_too_large!);
    setError(null);
    setScreenshot(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return setError(`Preenche «${MESSAGE[kind].label}» antes de enviar.`);
    if (answer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Escreve um email válido para te avisarmos.");
    const captchaToken = captchaOff ? CAPTCHA_OFF_TOKEN : token;
    if (!captchaToken) return setError("Confirma que não és um robô antes de enviar.");
    setError(null);
    mutation.mutate({
      kind,
      page: withPage ? page : null,
      url: withPage && url.trim() ? url.trim() : null,
      message: message.trim(),
      correction: kind === "error" && correction.trim() ? correction.trim() : null,
      source: kind === "error" && source.trim() ? source.trim() : null,
      email: answer ? email.trim() : null,
      screenshot: withPage ? screenshot : null,
      captchaToken,
    });
  }

  if (mutation.isSuccess) {
    return (
      <div role="status" className="rounded-2xl border border-line p-6">
        <p className="text-2xl font-bold">Obrigado. Recebemos a tua mensagem.</p>
        <p className="mt-2 leading-relaxed text-muted">
          {answer ? "Avisamos-te por email quando houver novidades. " : ""}
          {kind === "error" ? "Quando a correção for confirmada, aparece no registo público, com a data." : "Lemos tudo o que chega."}
        </p>
        <p className="mt-4 flex flex-wrap gap-4 font-mono text-xs font-bold">
          <button type="button" onClick={() => window.location.reload()} className="underline">
            Enviar outra mensagem
          </button>
          <Link href="/feedback/correcoes" className="text-link underline">
            Ver o registo de correções →
          </Link>
        </p>
      </div>
    );
  }

  const kindChoice = (
    <fieldset className="mb-8">
      <legend className={`${step} w-full`}>1 · Sobre o quê?</legend>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {KINDS.map((item) => {
          const chosen = kind === item.key;
          return (
            <label
              key={item.key}
              className={`flex cursor-pointer flex-col rounded-xl border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${
                chosen ? "" : "border-line hover:bg-surface"
              }`}
              style={
                chosen ? { borderColor: item.color, backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)` } : undefined
              }
            >
              <input type="radio" name="kind" value={item.key} checked={chosen} onChange={() => setKind(item.key)} className="sr-only" />
              <span
                aria-hidden="true"
                className="mb-2 flex size-7 items-center sm:mb-3 justify-center rounded-lg text-sm font-bold"
                style={{ color: item.color, backgroundColor: `color-mix(in srgb, ${item.color} 18%, transparent)` }}
              >
                {item.icon}
              </span>
              <span className="text-[15px] font-bold leading-snug sm:text-base">{item.title}</span>
              <span className="mt-1 text-xs leading-snug text-muted">{item.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  // An idea goes on the public board, where others vote on it and discuss it.
  if (kind === "idea" && ideasOpen) {
    return (
      <div>
        {kindChoice}
        <p className={`${step} w-full`}>2 · A tua ideia</p>
        <p className="mb-4 leading-relaxed text-muted">
          As ideias são públicas: aparecem no{" "}
          <Link href="/feedback/ideias" className="text-link underline">
            quadro de ideias
          </Link>
          , onde qualquer pessoa as pode votar e comentar. As mais votadas vão à frente, e respondemos lá a cada uma.
        </p>
        <NewThreadForm
          board={IDEAS_BOARD}
          boardName="Ideias"
          link={null}
          heading="Nova ideia"
          bodyLabel="Explica a ideia"
          titlePlaceholder="ex.: Alertas quando o meu deputado vota"
          bodyPlaceholder="O que gostavas de ver, e para quê?"
          submitLabel="Publicar ideia"
          threadBase="/feedback/ideias"
        />
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {kindChoice}

      <fieldset className="mb-8">
        <legend className={`${step} w-full`}>2 · Os detalhes</legend>
        <div className="space-y-4 rounded-2xl border border-line p-4">
          {withPage && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={small}>Em que página?</span>
                <select value={page} onChange={(event) => setPage(event.target.value)} className={`${field} mt-1.5`}>
                  {pages.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={small}>
                  Ligação <span className="font-normal text-muted">· opcional</span>
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://politicando.pt/…"
                  className={`${field} mt-1.5`}
                />
              </label>
            </div>
          )}
          <div>
            <label htmlFor={`${id}-message`} className={small}>
              {MESSAGE[kind].label}
            </label>
            <textarea
              id={`${id}-message`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_LENGTH}
              rows={5}
              placeholder={MESSAGE[kind].placeholder}
              aria-describedby={`${id}-count`}
              className={`${field} mt-1.5 resize-y`}
            />
            <p id={`${id}-count`} className="mt-1 flex justify-between font-mono text-[11px] text-muted">
              <span>{kind === "error" ? "Diz-nos o que viste e onde." : kind === "broken" ? "O que fizeste, e em que aparelho." : ""}</span>
              <span>
                {message.length} / {MAX_LENGTH}
              </span>
            </p>
          </div>
          {kind === "error" && (
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={small}>Qual é a informação certa?</span>
                  <input
                    value={correction}
                    onChange={(event) => setCorrection(event.target.value)}
                    placeholder="ex.: Presidente da Assembleia desde 2024"
                    className={`${field} mt-1.5`}
                  />
                </label>
                <label className="block">
                  <span className={small}>
                    Onde se confirma? <span className="font-normal text-muted">· fonte</span>
                  </span>
                  <input
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                    placeholder="Diário da República, parlamento.pt…"
                    className={`${field} mt-1.5`}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted">
                Com uma fonte oficial corrigimos muito mais depressa. Só publicamos correções que conseguimos confirmar.
              </p>
            </div>
          )}
          {withPage && (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                choose(event.dataTransfer.files[0]);
              }}
              className={`rounded-xl border border-dashed p-3 text-sm ${dragging ? "border-ink bg-surface" : "border-line"}`}
            >
              {screenshot ? (
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span aria-hidden="true">🖼 </span>
                    <b>{screenshot.name}</b> <span className="text-muted">· {Math.ceil(screenshot.size / 1024)} KB</span>
                  </span>
                  <button type="button" onClick={() => setScreenshot(null)} className="font-mono text-xs underline">
                    Tirar captura
                  </button>
                </p>
              ) : (
                <label className="flex cursor-pointer items-center gap-2">
                  <span aria-hidden="true">🖼</span>
                  <span>
                    <b>Junta uma captura de ecrã</b>{" "}
                    <span className="text-muted">· arrasta para aqui ou escolhe um ficheiro (PNG ou JPG, até 5 MB)</span>
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) => choose(event.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="mb-6">
        <legend className={`${step} w-full`}>3 · Queres resposta?</legend>
        <div className="rounded-2xl border border-line p-4">
          <div
            role="radiogroup"
            aria-label="Queres resposta?"
            className="grid grid-cols-2 overflow-hidden rounded-xl border border-line text-sm"
          >
            {[
              { value: false, label: "Enviar anónimo" },
              { value: true, label: "Quero ser avisado" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={answer === option.value}
                onClick={() => setAnswer(option.value)}
                className={`px-3 py-2.5 font-bold ${answer === option.value ? "bg-ink text-paper" : "hover:bg-surface"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {answer ? (
            <label className="mt-3 block">
              <span className={small}>O teu email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${field} mt-1.5`}
              />
              <span className="mt-1 block text-xs text-muted">
                Só para te respondermos sobre esta mensagem. Apagamo-lo quando o assunto fecha.
              </span>
            </label>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Como nos comentários, não pedimos nome nem conta. Podes seguir a correção no registo público, ao lado.
            </p>
          )}
        </div>
      </fieldset>

      {message.trim() && !captchaOff && isCaptchaConfigured() && (
        <div className="mb-4">
          <Captcha ref={captcha} onToken={setToken} />
        </div>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-xl bg-[#f3d27a] px-5 py-3 font-mono text-sm font-bold text-[#1f1b10] hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? "A enviar…" : "Enviar feedback →"}
        </button>
        <span className="font-mono text-[11px] text-muted">Correções confirmadas aparecem no registo público.</span>
      </div>
    </form>
  );
}
