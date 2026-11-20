import type { IdeaStatus } from "@/lib/api/forums";

/* The team's idea editor (/admin/ideias): what goes to PUT /admin/forum/threads/:id/status (backend docs/forums-api.md). */

export type IdeaStatusBody = {
  status: IdeaStatus | null;
  answer: string | null;
  /** Left out: kept as it is. null: cleared. */
  expectedOn?: string | null;
  duplicateOf?: number;
};

export type IdeaForm = { status: IdeaStatus | null; answer: string; expectedOn: string; duplicateOf: string };

/** The request body from the form, or why it can't be sent. */
export function ideaStatusBody(
  idea: { id: number; expectedOn: string | null },
  form: IdeaForm,
): { ok: true; body: IdeaStatusBody } | { ok: false; error: string } {
  const body: IdeaStatusBody = { status: form.status, answer: form.answer.trim() || null };
  const expectedOn = form.expectedOn || null;
  if (expectedOn !== idea.expectedOn) body.expectedOn = expectedOn;
  if (form.status === "duplicate") {
    const digits = form.duplicateOf.trim().replace(/^#/, "");
    if (!/^[1-9]\d{0,9}$/.test(digits)) return { ok: false, error: "Escreve o número da ideia original." };
    const original = Number(digits);
    if (original === idea.id) return { ok: false, error: "Uma ideia não pode ser duplicada de si própria." };
    body.duplicateOf = original;
  }
  return { ok: true, body };
}
