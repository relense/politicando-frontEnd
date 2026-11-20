import { beforeEach, describe, expect, it } from "vitest";
import { followPath, rememberSent, sentMessages } from "@/lib/feedbackFollow";
import { notificationHref, notificationText, tabOf } from "@/lib/notifications";
import type { Notification } from "@/lib/api/engagement";

const reply = (feedback: Notification["feedback"]): Notification => ({
  id: 7,
  kind: "feedback_reply",
  actorName: null,
  count: 1,
  createdAt: "2026-11-20T10:00:00.000Z",
  read: false,
  snippet: null,
  link: {
    commentId: null,
    articleId: null,
    storyId: null,
    postSlug: null,
    threadId: null,
    postId: null,
    initiativeId: null,
    feedbackId: 12,
  },
  threadTitle: null,
  board: null,
  headline: null,
  status: null,
  prediction: null,
  feedback,
});

describe("the team's answer in the inbox", () => {
  it("reads «A equipa respondeu à tua mensagem» with the answer itself, among the replies, leading nowhere", () => {
    const item = reply({ id: 12, reply: "Obrigado, já corrigimos." });
    expect(notificationText(item)).toEqual({ actor: null, lead: "A equipa respondeu à tua mensagem", quote: "Obrigado, já corrigimos." });
    expect(tabOf(item)).toBe("respostas");
    expect(notificationHref(item)).toBeNull();
  });

  it("still makes sense without the text", () => {
    expect(notificationText(reply(null)).quote).toBeNull();
  });
});

describe("the private follow-up links kept on this device", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the newest first, at most 20, with what was sent and when", () => {
    for (let index = 0; index < 22; index++)
      rememberSent({ token: `t${index}`, kind: "error", page: "Percursos", sentAt: `2026-11-${10 + (index % 10)}` });
    const sent = sentMessages();
    expect(sent).toHaveLength(20);
    expect(sent[0]).toEqual({ token: "t21", kind: "error", page: "Percursos", sentAt: "2026-11-11" });
  });

  it("ignores what isn't a list of messages", () => {
    window.localStorage.setItem("politicando:mensagens-enviadas", "{nope");
    expect(sentMessages()).toEqual([]);
    window.localStorage.setItem(
      "politicando:mensagens-enviadas",
      JSON.stringify([{ token: 3 }, { token: "ok", kind: "broken", page: null, sentAt: "x" }]),
    );
    expect(sentMessages()).toEqual([{ token: "ok", kind: "broken", page: null, sentAt: "x" }]);
  });

  it("links to the private page, the token escaped", () => {
    expect(followPath("a/b c")).toBe("/feedback/acompanhar/a%2Fb%20c");
  });
});
