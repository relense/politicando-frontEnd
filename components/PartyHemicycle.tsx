import { arrangeSeats, focusOf, seatSpacing } from "@/lib/hemicycle";
import { SEAT_ORDER } from "@/lib/parliament";
import type { Parliament } from "@/lib/types";

const round = (value: number) => Math.round(value * 100) / 100;

/** A small chamber with one party's seats lit, in the same arrangement as the Parliament page. Decorative: the numbers sit beside it. */
export function PartyHemicycle({ seatMap, slug }: { seatMap: Parliament["seatMap"]; slug: string }) {
  const layout = arrangeSeats(seatMap.seats, focusOf(seatMap), SEAT_ORDER);
  const radius = (seatSpacing(layout.seats) / 2) * 0.82;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${round(layout.width)} ${round(layout.height)}`}
      className="block h-auto w-full"
      data-testid="party-hemicycle"
    >
      {layout.seats.map((seat) => (
        <circle
          key={seat.number}
          cx={round(seat.x)}
          cy={round(seat.y)}
          r={round(radius)}
          className={seat.partySlug === slug ? "fill-ink" : "fill-line"}
        />
      ))}
    </svg>
  );
}
