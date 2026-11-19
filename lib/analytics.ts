/**
 * Named events for Umami (lib/umami.ts): totals of what readers do, never who. Details are labels and ids (which story,
 * which board, which outlet), never personal data. Writes (a comment, a sign-up) are tracked with `track` once the API
 * has said yes; plain presses (▶, a link out) carry `umamiEvent` attributes, which Umami's script counts on click.
 * Without Umami (not set up, blocked, Do Not Track) both do nothing.
 */

type Detail = string | number | boolean | null | undefined;
type Details = Record<string, Detail>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, string | number | boolean>) => void };
  }
}

const filled = (details: Details) =>
  Object.fromEntries(Object.entries(details).filter((entry): entry is [string, string | number | boolean] => entry[1] != null));

/** An event that happened: send after the API's answer, not on the press. */
export function track(name: string, details?: Details) {
  try {
    window.umami?.track(name, details ? filled(details) : undefined);
  } catch {
    // Statistics never get in the reader's way.
  }
}

/** Attributes for a button or link, counted by Umami when pressed: `<a {...umamiEvent("outlet-click", { domain })}>`. */
export function umamiEvent(name: string, details: Details = {}): Record<string, string> {
  const attributes: Record<string, string> = { "data-umami-event": name };
  for (const [key, value] of Object.entries(filled(details))) attributes[`data-umami-event-${key}`] = String(value);
  return attributes;
}
