/**
 * When «hoje» starts for the news counts box: 05:00 in Lisbon, the start of the news day. Before 05:00 it's still the
 * day before, so the box is never empty at night.
 */

const lisbonParts = (time: number) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const get = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
};

export const START_HOUR = 5;

/** The ISO instant of the latest 05:00 in Lisbon at or before `now`. */
export function dayStart(now: number): string {
  const local = lisbonParts(now);
  const back = local.hour < START_HOUR ? 1 : 0;
  // 05:00 UTC on that calendar day, then back by Lisbon's offset then (0 in winter, 1 h in summer; it changes at 01:00 UTC).
  const utc = Date.UTC(local.year, local.month - 1, local.day - back, START_HOUR);
  const offset = lisbonParts(utc).hour - START_HOUR;
  return new Date(utc - offset * 3_600_000).toISOString();
}
