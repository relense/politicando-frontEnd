"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  src: string;
  href?: string;
  caption?: string;
  className?: string;
  imageClassName?: string;
  /** Fills the frame's sides with a blurred copy of the image, instead of grey bands. */
  backdrop?: boolean;
};

/** Article images come from each outlet's server and may fail; then the image and its link disappear. */
export function ArticleImage({ src, href, caption, className, imageClassName, backdrop = false }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const image = (
    // next/image cannot allow-list arbitrary outlet hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={imageClassName} />
  );

  const content = (
    <>
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
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
