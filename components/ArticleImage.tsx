"use client";

import Link from "next/link";
import { useState } from "react";

type Props = { src: string; href?: string; className?: string; imageClassName?: string };

/** Article images come from each outlet's server and may fail; then the image and its link disappear. */
export function ArticleImage({ src, href, className, imageClassName }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const image = (
    // next/image cannot allow-list arbitrary outlet hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={imageClassName}
    />
  );

  if (!href) return <div className={className}>{image}</div>;
  // The title already links here, so this duplicate stays out of the tab order and screen readers.
  return (
    <Link href={href} tabIndex={-1} aria-hidden="true" className={className}>
      {image}
    </Link>
  );
}
