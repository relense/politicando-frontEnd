"use client";

import Link from "next/link";
import { useState } from "react";
import { SourceLogo } from "./SourceLogo";
import { Wordmark } from "./Wordmark";

type Props = {
  /** Null: no photo. With `source`, a branded frame with the outlet takes its place; without, nothing shows. */
  src: string | null;
  href?: string;
  caption?: string;
  className?: string;
  imageClassName?: string;
  /** Fills the frame's sides with a blurred copy of the image, instead of grey bands. */
  backdrop?: boolean;
  /** The outlet: when there's no photo, or it fails to load, a branded frame of the same size with its logo, so cards keep their shape. */
  source?: string;
  sourceDomain?: string;
  /** A small thumbnail: the logo alone. */
  compact?: boolean;
  /** What it shows, for search engines; the headline beside it already says it, so screen readers skip the image. */
  alt?: string;
};

/**
 * The outlet sent no photo: a light frame in the site's colours (either theme) with our name and the outlet's, so cards
 * keep their shape without a heavy dark box. A small thumbnail shows the outlet's logo alone.
 */
function NoImage({ source, sourceDomain, compact }: { source: string; sourceDomain: string; compact: boolean }) {
  if (compact)
    return (
      <span data-no-image className="absolute inset-0 flex items-center justify-center bg-surface ring-1 ring-inset ring-line">
        <SourceLogo domain={sourceDomain} name={source} size={24} square />
      </span>
    );
  return (
    <span
      data-no-image
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-surface ring-1 ring-inset ring-line"
      style={{
        backgroundImage: "radial-gradient(color-mix(in srgb, var(--brand) 22%, transparent) 1px, transparent 1px)",
        backgroundSize: "14px 14px",
      }}
    >
      <Wordmark className="rounded-md bg-paper px-2.5 py-1 text-sm text-ink" />
      <span className="flex items-center gap-2 rounded-full bg-paper py-1 pl-1 pr-3 font-mono text-[11px] text-muted">
        <span className="overflow-hidden rounded">
          <SourceLogo domain={sourceDomain} name={source} size={20} square />
        </span>
        {source}
      </span>
    </span>
  );
}

/**
 * Article images come from each outlet's server and may fail. Then, or without one, the branded frame when the
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
      <Link prefetch={false} href={href} tabIndex={-1} aria-hidden="true" className={`relative ${className ?? ""}`}>
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
    <Link prefetch={false} href={href} tabIndex={-1} aria-hidden="true" className={`relative ${className ?? ""}`}>
      {content}
    </Link>
  );
}
