"use client";

import dynamic from "next/dynamic";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import type ReCAPTCHAType from "react-google-recaptcha";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), { ssr: false });
// next/dynamic does not forward the widget's ref type.
const ReCAPTCHAWithRef = ReCAPTCHA as unknown as typeof ReCAPTCHAType;

export type CaptchaHandle = { reset: () => void };

type Props = { onToken: (token: string | null) => void; ref: Ref<CaptchaHandle> };

export const isCaptchaConfigured = () =>
  process.env.NEXT_PUBLIC_CAPTCHA_MODE === "mock" || Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

/** The only component that knows the captcha provider. Each instance resets only its own widget. */
export function Captcha({ onToken, ref }: Props) {
  const widget = useRef<ReCAPTCHAType>(null);
  const [mockChecked, setMockChecked] = useState(false);

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

  return (
    <ReCAPTCHAWithRef
      ref={widget}
      sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
      hl="pt-PT"
      onChange={onToken}
      onExpired={() => onToken(null)}
    />
  );
}
