"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { followPath, sentMessages, type SentMessage } from "@/lib/feedbackFollow";
import { formatDate } from "@/lib/format";

const KIND_LABELS: Record<string, string> = { error: "Erro nos dados", broken: "Algo não funciona", idea: "Ideia", other: "Mensagem" };
const SHOWN = 5;

/** «As tuas mensagens»: the private links of what was sent from this device. Nothing when there are none. */
export function SentMessages() {
  const [sent, setSent] = useState<SentMessage[]>([]);
  // Read after hydration: the server doesn't know this device.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of this device's storage
  useEffect(() => setSent(sentMessages()), []);
  if (sent.length === 0) return null;
  return (
    <section aria-labelledby="as-tuas-mensagens" className="rounded-2xl border border-line p-4">
      <h2 id="as-tuas-mensagens" className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted">
        As tuas mensagens
      </h2>
      <p className="mt-1 text-xs text-muted">Enviadas deste aparelho. Só tu vês esta lista.</p>
      <ul className="mt-2 flex flex-col">
        {sent.slice(0, SHOWN).map((message) => (
          <li key={message.token} className="border-b border-line py-2 last:border-b-0">
            <Link href={followPath(message.token)} className="text-sm font-bold hover:underline">
              {KIND_LABELS[message.kind] ?? "Mensagem"}
              {message.page ? ` · ${message.page}` : ""}
            </Link>
            <span className="block font-mono text-[11px] text-muted">enviada a {formatDate(message.sentAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
