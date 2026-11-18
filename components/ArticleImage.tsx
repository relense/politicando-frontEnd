"use client";

import Link from "next/link";
import { useState } from "react";
import { SourceLogo } from "./SourceLogo";

type Props = {
  /** Null: no photo. With `source`, a dark frame says so; without, nothing shows. */
  src: string | null;
  href?: string;
  caption?: string;
  className?: string;
  imageClassName?: string;
  /** Fills the frame's sides with a blurred copy of the image, instead of grey bands. */
  backdrop?: boolean;
  /** The outlet: when there's no photo, or it fails to load, a dark frame of the same size with its logo, so cards keep their shape. */
  source?: string;
  sourceDomain?: string;
  /** A small thumbnail: the logo alone. */
  compact?: boolean;
  /** What it shows, for search engines; the headline beside it already says it, so screen readers skip the image. */
  alt?: string;
};

/** Always dark, in either theme: a frame that plainly says this outlet sent no photo. */
function NoImage({ source, sourceDomain, compact }: { source: string; sourceDomain: string; compact: boolean }) {
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1b1d22] text-[#a9adb6] ring-1 ring-inset ring-white/10">
      <span className="opacity-80 grayscale">
        <SourceLogo domain={sourceDomain} name={source} size={compact ? 24 : 36} square />
      </span>
      {!compact && <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Sem imagem · {source}</span>}
    </span>
  );
}

/**
 * Article images come from each outlet's server and may fail. Then, or without one, the outlet's dark frame when the
 * outlet is given; otherwise the image and its link disappear.
 */
export function ArticleImage({
  src,
  href,
  caption,
  className,
  imageClassName,
  backdrop = false,
  source,
  sourceDomain,
  compact = false,
  alt = "",
}: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    if (!source || !sourceDomain) return null;
    const frame = <NoImage source={source} sourceDomain={sourceDomain} compact={compact} />;
    if (!href) return <div className={`relative ${className ?? ""}`}>{frame}</div>;
    return (
      <Link href={href} tabIndex={-1} aria-hidden="true" className={`relative ${className ?? ""}`}>
        {frame}
      </Link>
    );
  }

  const image = (
    // next/image cannot allow-list arbitrary outlet hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? true : undefined}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
      className={imageClassName}
    />
  );

  const content = (
    <>
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
        />
      )}
      {image}
      {caption && (
        <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-paper/85 px-1.5 py-0.5 font-mono text-[10px] text-muted">
          {caption}
        </span>
      )}
    </>
  );

  if (!href) return <div className={`relative ${className ?? ""}`}>{content}</div>;
  // The title already links here, so this duplicate stays out of the tab order and screen readers.
  return (
    <Link href={href} tabIndex={-1} aria-hidden="true" className={`relative ${className ?? ""}`}>
      {content}
    </Link>
  );
}
