import Image from "next/image";
import { hasSourceLogo } from "@/lib/sources";

/**
 * The outlet's own icon, kept in our files (public/fontes) so a reader's browser never asks the outlet's site for it.
 * An outlet we have no icon for shows its first letter.
 */
export function SourceLogo({ domain, name, size, square = false }: { domain: string; name: string; size: number; square?: boolean }) {
  const shape = square ? "rounded-md" : "rounded-full";
  if (!hasSourceLogo(domain)) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center ${shape} bg-surface font-mono text-[10px] font-bold`}
        style={{ width: size, height: size }}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <Image
      src={`/fontes/${domain}.png`}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 ${shape} border border-line bg-white object-contain`}
      style={{ width: size, height: size }}
    />
  );
}
