"use client";

import { useId, useState, type FormEvent } from "react";
import { ARTICLE_REPORT_REASONS, createReport, REPORT_REASONS, type ReportKind, type ReportReason } from "@/lib/api/forums";

type Props = {
  kind: ReportKind;
  id: number;
  className?: string;
  /** Opened from elsewhere (the article menu): the form shows at once, without its own button. */
  startOpen?: boolean;
  onClose?: () => void;
};

/** "Denunciar": opens a short form with the reasons the moderators use. No captcha; the API limits it per IP. */
export function ReportButton({ kind, id, className = "", startOpen = false, onClose }: Props) {
  const fieldId = useId();
  const [open, setOpenState] = useState(startOpen);
  const setOpen = (value: boolean | ((current: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(open) : value;
    setOpenState(next);
    if (!next) onClose?.();
  };
  const reasons = kind === "article" ? ARTICLE_REPORT_REASONS : REPORT_REASONS;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setState("sending");
    try {
      await createReport({ kind, id, reason, details });
      setState("sent");
      setOpenState(false);
      // Opened from a menu: the thanks shows a moment, then it goes away.
      if (startOpen) setTimeout(() => onClose?.(), 2500);
    } catch {
      setState("failed");
    }
  }

  return (
    // Takes the whole row while the form is open, so it never squeezes beside the other actions.
    <div className={`${className} ${open ? "basis-full" : ""}`}>
      {state === "sent" ? (
        <p role="status" className={`font-mono text-xs text-muted ${startOpen ? "rounded-2xl border border-line p-3" : ""}`}>
          Obrigado. A moderação vai rever a denúncia.
        </p>
      ) : startOpen ? null : (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${fieldId}-form`}
          onClick={() => setOpen((value) => !value)}
          className="rounded-full px-2.5 py-1.5 font-mono text-xs font-bold text-muted hover:bg-surface hover:text-ink"
        >
          Denunciar
        </button>
      )}
      {open && (
        <form id={`${fieldId}-form`} onSubmit={submit} className="mt-2 rounded-2xl border border-line bg-paper p-3 text-sm">
          <fieldset>
            <legend className="mb-2 font-mono text-xs font-bold">Porque estás a denunciar?</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {reasons.map((item) => (
                <label key={item.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${fieldId}-reason`}
                    value={item.value}
                    checked={reason === item.value}
                    onChange={() => setReason(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`${fieldId}-details`} className="mt-3 block font-mono text-xs text-muted">
            Detalhes (opcional)
          </label>
          <textarea
            id={`${fieldId}-details`}
            value={details}
            maxLength={500}
            rows={2}
            onChange={(event) => setDetails(event.target.value)}
            className="mt-1 w-full resize-y rounded-lg border border-line bg-paper px-2 py-1 text-ink"
          />
          {state === "failed" && (
            <p role="alert" className="mt-2 text-danger">
              Não foi possível enviar a denúncia. Tenta novamente daqui a pouco.
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2 font-mono text-sm">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 font-bold text-muted hover:bg-surface hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!reason || state === "sending"}
              className="rounded-full bg-ink px-3 py-1 font-bold text-paper hover:opacity-90 disabled:opacity-50"
            >
              {state === "sending" ? "A enviar…" : "Enviar denúncia"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
