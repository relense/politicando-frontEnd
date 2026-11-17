"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cookieConsent, setCookieConsent, subscribeConsent } from "@/lib/consent";
import { FEATURES } from "@/lib/features";

// On the server and before hydration: "answered", so the banner never flashes in.
const answeredOnServer = () => "essential" as const;

/** The cookie choice, at the bottom of the screen until answered. Built but off: see FEATURES.cookieBanner. */
export function CookieBanner() {
  const consent = useSyncExternalStore(subscribeConsent, cookieConsent, answeredOnServer);
  if (!FEATURES.cookieBanner || consent !== null) return null;
  return (
    <section
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-paper px-4 py-4 shadow-[0_-8px_24px_rgb(0_0_0/0.08)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed">
          Não usamos cookies de publicidade nem de seguimento. Para publicar, carregamos o reCAPTCHA da Google, e os podcasts e vídeos vêm
          de outros sites: ambos podem guardar cookies próprios.{" "}
          <Link href="/cookies" className="text-link underline">
            Saber mais
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setCookieConsent("essential")}
            className="min-h-10 rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
          >
            Só o essencial
          </button>
          <button
            type="button"
            onClick={() => setCookieConsent("all")}
            className="min-h-10 rounded-full bg-ink px-4 font-mono text-xs font-bold text-paper hover:opacity-90"
          >
            Aceitar tudo
          </button>
        </div>
      </div>
    </section>
  );
}
