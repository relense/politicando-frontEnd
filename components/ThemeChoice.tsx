"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "system", label: "Sistema", icon: "M12 3a9 9 0 1 0 0 18V3Z" },
  { value: "dark", label: "Escuro", icon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" },
  {
    value: "light",
    label: "Claro",
    icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  },
] as const;

const noop = () => () => {};

/**
 * Sistema · Escuro · Claro. "Sistema" follows the phone or computer (the default). In the account menu, and for
 * readers without an account at the bottom of the sections menu.
 */
export function ThemeChoice({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The choice is only known in the browser: nothing is pressed in the server's HTML.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const current = mounted ? (theme ?? "system") : null;
  return (
    <div role="group" aria-label="Tema" className={`grid grid-cols-3 gap-1 rounded-xl border border-line p-1 ${className}`}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          onClick={() => setTheme(option.value)}
          className={`flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 font-mono text-[11px] font-bold ${
            current === option.value ? "bg-ink text-paper" : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0 fill-none stroke-current stroke-2">
            <path d={option.icon} />
          </svg>
          {option.label}
        </button>
      ))}
    </div>
  );
}
