"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { changePassword } from "@/lib/api/admin";
import { useMe } from "./AdminShell";
import { buttonClass, ErrorNote, inputClass, useExpiry } from "./ui";

const MIN_PASSWORD = 12;

/** Change one's own password; the API signs out every other session. */
export function Account() {
  const me = useMe();
  const expiry = useExpiry();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setAgain("");
    },
    onError: expiry,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    if (next.length < MIN_PASSWORD) return setProblem(`A nova palavra-passe precisa de pelo menos ${MIN_PASSWORD} caracteres.`);
    if (next !== again) return setProblem("As duas novas palavras-passe não são iguais.");
    save.mutate();
  }

  return (
    <section aria-labelledby="conta" className="max-w-md">
      <h1 id="conta" className="mb-1 text-2xl font-bold">
        A minha conta
      </h1>
      <p className="mb-6 text-sm text-muted">{me.email}</p>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
        <h2 className="font-bold">Mudar a palavra-passe</h2>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Palavra-passe atual</span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Nova palavra-passe</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className={inputClass}
            required
          />
          <span className="text-xs text-muted">Pelo menos {MIN_PASSWORD} caracteres. As outras sessões terminam.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs font-bold">Repete a nova</span>
          <input
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
            className={inputClass}
            required
          />
        </label>
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <ErrorNote error={save.error} />
        {save.isSuccess && (
          <p role="status" className="text-sm text-[var(--stage-approved)]">
            Palavra-passe mudada.
          </p>
        )}
        <div>
          <button type="submit" disabled={save.isPending} className={buttonClass("ink")}>
            Mudar palavra-passe
          </button>
        </div>
      </form>
    </section>
  );
}
