"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { embedsAllowed, providerName, setEmbedsAllowed, subscribeEmbeds } from "@/lib/consent";

type Props = { provider: string; src: string; url: string; title: string; className: string };

/**
 * A player from another site, loaded only when the reader asks: until then nothing is fetched from that site and it
 * sets no cookies. "Carregar sempre" remembers the choice in this browser; the cookies page can undo it.
 */
export function ConsentEmbed({ provider, src, url, title, className }: Props) {
  const remembered = useSyncExternalStore(subscribeEmbeds, embedsAllowed, () => false);
  const [now, setNow] = useState(false);
  const name = providerName(provider);

  if (remembered || now) {
    return (
      <div className={className}>
        <iframe
          src={src}
          title={title}
          className="size-full"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  return (
    <div className={`${className} flex flex-col items-center justify-center gap-3 border border-dashed border-line p-5 text-center`}>
      <p className="max-w-md text-sm leading-relaxed">
        Este conteúdo está no <b>{name}</b>. Ao carregá-lo, o {name} recebe o teu endereço IP e pode guardar cookies.{" "}
        <Link href="/cookies" className="text-link underline">
          Saber mais
        </Link>
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setNow(true)}
          className="rounded-full bg-ink px-4 py-2 font-mono text-xs font-bold text-paper hover:opacity-90"
        >
          Carregar o {name}
        </button>
        <button
          type="button"
          onClick={() => setEmbedsAllowed(true)}
          className="rounded-full border border-line px-4 py-2 font-mono text-xs font-bold hover:bg-surface"
        >
          Carregar sempre
        </button>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-muted underline hover:text-ink">
        Abrir no {name} ↗<span className="sr-only"> (abre num novo separador)</span>
      </a>
    </div>
  );
}
