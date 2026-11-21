"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { adminErrorMessage } from "@/lib/api/admin";
import { ME_KEY } from "./AdminShell";

/** A session that ended mid-way sends the team back to the sign-in form. */
export function signOutOnExpiry(client: QueryClient, error: unknown) {
  if (error instanceof ApiError && error.code === "unauthenticated") client.setQueryData(ME_KEY, null);
}

export function useExpiry() {
  const client = useQueryClient();
  return (error: unknown) => signOutOnExpiry(client, error);
}

/** A query's error that says the session ended signs out, after rendering (never while rendering another component). */
export function useExpiryOf(error: unknown) {
  const client = useQueryClient();
  useEffect(() => {
    if (error) signOutOnExpiry(client, error);
  }, [client, error]);
}

export const buttonClass = (tone: "plain" | "danger" | "ink" = "plain") =>
  `inline-flex min-h-9 items-center rounded-full border px-3 font-mono text-xs font-bold disabled:opacity-50 ${
    tone === "danger"
      ? "border-danger text-danger hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
      : tone === "ink"
        ? "border-ink bg-ink text-paper hover:opacity-90"
        : "border-line hover:bg-surface"
  }`;

/** Filter tabs that keep their state in the page, not the address. */
export function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`inline-flex min-h-9 items-center rounded-full border px-3 font-mono text-xs font-bold ${
            option.value === value ? "border-ink bg-ink text-paper" : "border-line hover:bg-surface"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {adminErrorMessage(error)}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{children}</p>;
}

/** Two presses for what can't be undone, without a browser dialog. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={buttonClass("danger")}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className={buttonClass("danger")}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={buttonClass()}>
        Cancelar
      </button>
    </span>
  );
}

export const inputClass = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm";
