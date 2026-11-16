import type { Board } from "@/lib/api/forums";
import { PartyLogo } from "../PartyLogo";

/** The party's logo, or a speech bubble for the general board. */
export function BoardBadge({ board, size }: { board: Pick<Board, "board" | "acronym">; size: number }) {
  if (board.acronym) return <PartyLogo slug={board.board} acronym={board.acronym} size={size} />;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink"
    >
      <svg viewBox="0 0 20 20" className="size-1/2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d={FORUM_ICON} />
      </svg>
    </span>
  );
}

/** Two speech bubbles, also used for the site menu. */
export const FORUM_ICON = "M3 4h10v7H8l-3 3v-3H3V4Zm10 3h4v7h-2v3l-3-3H9v-1";
