import type { ReactNode } from "react";
import { chamberSeats } from "@/lib/hemicycle";

const round = (value: number) => Math.round(value * 10) / 10;

export type ChamberGroup = { key: string; color: string; seats: number; dimmed?: boolean };

/** A chamber of `total` seats filled left to right by `groups`; seats nobody won stay empty. Decorative: the numbers are always beside it. */
export function Chamber({
  groups,
  total,
  children,
  className = "",
}: {
  groups: ChamberGroup[];
  total: number;
  children?: ReactNode;
  className?: string;
}) {
  const { seats, width, height, seatRadius } = chamberSeats(total);
  const owners: (ChamberGroup | null)[] = groups.flatMap((group) => Array.from({ length: group.seats }, () => group));
  return (
    <div className={`relative ${className}`}>
      <svg aria-hidden="true" viewBox={`0 0 ${round(width)} ${round(height)}`} className="block h-auto w-full">
        {seats.map((seat, index) => {
          const owner = owners[index] ?? null;
          return (
            <circle
              key={index}
              cx={round(seat.x)}
              cy={round(seat.y)}
              r={round(seatRadius)}
              fill={owner ? owner.color : "var(--line)"}
              opacity={owner?.dimmed ? 0.18 : 1}
              className="transition-opacity"
            />
          );
        })}
      </svg>
      {children && <div className="absolute inset-x-0 bottom-0 text-center">{children}</div>}
    </div>
  );
}
