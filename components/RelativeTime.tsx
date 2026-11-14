"use client";

import { formatDateTime, formatRelative } from "@/lib/format";
import { useNow } from "@/lib/useNow";

/** "há 2 h", with the full date on hover. */
export function RelativeTime({ value, className }: { value: string | null | undefined; className?: string }) {
  const now = useNow();
  const label = formatRelative(value, now);
  if (!value || !label) return null;

  return (
    // The server and the browser can straddle a minute; the browser's value wins right after.
    <time dateTime={value} title={formatDateTime(value) ?? undefined} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}
