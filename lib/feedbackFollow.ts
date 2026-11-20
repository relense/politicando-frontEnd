import { z } from "zod";

/*
 * The private follow-up links of the messages sent from this device (backend docs/feedback-api.md › followUpToken).
 * Whoever has a link reads the team's answer, so they stay here, never in a shareable place.
 */

const KEY = "politicando:mensagens-enviadas";
const MAX = 20;

const sentSchema = z.object({ token: z.string(), kind: z.string(), page: z.string().nullable(), sentAt: z.string() });
export type SentMessage = z.infer<typeof sentSchema>;

export const followPath = (token: string) => `/feedback/acompanhar/${encodeURIComponent(token)}`;

/** Newest first. Anything unreadable is left out. */
export function sentMessages(): SentMessage[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const message = sentSchema.safeParse(item);
      return message.success ? [message.data] : [];
    });
  } catch {
    return [];
  }
}

export function rememberSent(message: SentMessage) {
  try {
    const rest = sentMessages().filter((item) => item.token !== message.token);
    window.localStorage.setItem(KEY, JSON.stringify([message, ...rest].slice(0, MAX)));
  } catch {
    // Not kept on this device: the link on the screen is still there to copy.
  }
}
