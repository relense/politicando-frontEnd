"use client";

import dynamic from "next/dynamic";
import { useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { cookieConsent, subscribeConsent } from "@/lib/consent";
import { FEATURES } from "@/lib/features";
import type ReCAPTCHAType from "react-google-recaptcha";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), { ssr: false });
// next/dynamic does not forward the widget's ref type.
const ReCAPTCHAWithRef = ReCAPTCHA as unknown as typeof ReCAPTCHAType;

export type CaptchaHandle = { reset: () => void };

type Props = { onToken: (token: string | null) => void; ref: Ref<CaptchaHandle> };

/**
 * "off" hides the captcha completely, for testing on develop; the API must then accept any token,
 * as it does with Google's test secret. Never set it in production.
 */
export const isCaptchaOff = () => process.env.NEXT_PUBLIC_CAPTCHA_MODE === "off";

export const isCaptchaConfigured = () =>
  isCaptchaOff() || process.env.NEXT_PUBLIC_CAPTCHA_MODE === "mock" || Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

/** The only component that knows the captcha provider. Each instance resets only its own widget. */
export function Captcha({ onToken, ref }: Props) {
  const widget = useRef<ReCAPTCHAType>(null);
  const [mockChecked, setMockChecked] = useState(false);
  const consent = useSyncExternalStore(subscribeConsent, cookieConsent, () => null);
  const [allowedHere, setAllowedHere] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      widget.current?.reset();
      setMockChecked(false);
      onToken(null);
    },
  }));

  // Local development and e2e only: the API is what actually verifies the token.
  if (process.env.NEXT_PUBLIC_CAPTCHA_MODE === "mock") {
    return (
      <label className="flex items-center gap-2 font-mono text-sm">
        <input
          type="checkbox"
          checked={mockChecked}
          onChange={(event) => {
            setMockChecked(event.target.checked);
            onToken(event.target.checked ? "mock-token" : null);
          }}
        />
        Não sou um robô (teste)
      </label>
    );
  }

  // With the cookie banner on, Google's widget waits for a yes: the banner's, or this button's.
  if (FEATURES.cookieBanner && consent !== "all" && !allowedHere) {
    return (
      <div className="rounded-xl border border-dashed border-line p-3 text-sm">
        <p className="mb-2">Para publicar, confirmamos que não és um robô com o reCAPTCHA da Google, que pode usar cookies.</p>
        <button
          type="button"
          onClick={() => setAllowedHere(true)}
          className="min-h-9 rounded-full border border-line px-4 font-mono text-xs font-bold hover:bg-surface"
        >
          Carregar a verificação
        </button>{" "}
        <a href="/cookies" className="text-xs underline">
          Saber mais
        </a>
      </div>
    );
  }

  return (
    <div>
      <ReCAPTCHAWithRef
        ref={widget}
        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
        hl="pt-PT"
        onChange={onToken}
        onExpired={() => onToken(null)}
      />
      {/* Said where it loads: it is Google's, and only loads because the reader is about to post. */}
      <p className="mt-1 text-xs text-muted">
        Verificação da Google (reCAPTCHA), carregada só para publicar; pode usar cookies.{" "}
        <a href="/cookies" className="underline hover:text-ink">
          Saber mais
        </a>
      </p>
    </div>
  );
}
