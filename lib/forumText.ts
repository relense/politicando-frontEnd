import { safeHttpUrl } from "./api/mappers";

/** A piece of a forum post: plain text, a web address, or a ">>123" quote of another post. */
export type ForumPart = { kind: "text"; text: string } | { kind: "url"; url: string; text: string } | { kind: "quote"; id: number };

const TOKEN = /(https?:\/\/[^\s<>"']+)|>>(\d{1,10})\b/g;
/** Punctuation that usually ends the sentence rather than the address: "veja https://x.pt." */
const TRAILING = /[.,;:!?)\]}»"']+$/;

/**
 * Splits a post's plain text into text, links and quotes, in order. Nothing here is HTML: the parts are rendered as
 * React text, so anything typed stays text. Only http(s) addresses become links.
 */
export function splitForumText(body: string): ForumPart[] {
  const parts: ForumPart[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = parts.at(-1);
    if (last?.kind === "text") last.text += text;
    else parts.push({ kind: "text", text });
  };
  let at = 0;
  for (const match of body.matchAll(TOKEN)) {
    pushText(body.slice(at, match.index));
    at = match.index + match[0].length;
    if (match[2]) {
      parts.push({ kind: "quote", id: Number(match[2]) });
      continue;
    }
    const raw = match[1]!;
    const trailing = raw.match(TRAILING)?.[0] ?? "";
    const address = raw.slice(0, raw.length - trailing.length);
    const url = safeHttpUrl(address);
    if (url && address.length > "https://".length) parts.push({ kind: "url", url, text: address });
    else pushText(address);
    pushText(trailing);
  }
  pushText(body.slice(at));
  return parts;
}

/** The posts a post quotes, without repeats. */
export function quotesOf(body: string | null): number[] {
  if (!body) return [];
  return [...new Set(splitForumText(body).flatMap((part) => (part.kind === "quote" ? [part.id] : [])))];
}
