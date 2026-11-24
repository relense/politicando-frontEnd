import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { activitySchema, getReaders, readerAction, readerSchema } from "@/lib/api/admin";
import { activityHref, activityLabel, readerStatusLine, signupHref } from "@/lib/adminReaders";
import { register } from "@/lib/api/account";

// The team's view of readers' accounts (asked of the backend: admin «readers», see docs/api-handoff.md).
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const full = {
  id: 812,
  username: "leitor_exemplo",
  email: "leitor@exemplo.pt",
  emailConfirmed: true,
  newsletter: false,
  createdAt: "2026-11-02T10:14:00.000Z",
  lastSeenAt: "2026-11-23T21:40:00.000Z",
  status: "active",
  suspendedUntil: null,
  signupFrom: "/orcamento/2027/proposta/25391",
  counts: { comments: 14, forumPosts: 3, importa: 22, follows: 5, saved: 9, predictions: 4, reportsMade: 1, reportsAgainst: 0 },
};

describe("a reader, as the team sees it", () => {
  it("reads every field; an older or partial API still reads, with nothing invented", () => {
    expect(readerSchema.parse(full)).toEqual(full);
    const bare = readerSchema.parse({ id: 1, username: "a", createdAt: "2026-11-02T10:14:00.000Z", status: "frozen" });
    expect(bare).toMatchObject({ email: null, emailConfirmed: false, lastSeenAt: null, status: "active", signupFrom: null });
    expect(bare.counts).toEqual({
      comments: 0,
      forumPosts: 0,
      importa: 0,
      follows: 0,
      saved: 0,
      predictions: 0,
      reportsMade: 0,
      reportsAgainst: 0,
    });
  });

  it("says where they stand: suspended until a day, banned, deleted", () => {
    const at = (more: object) => readerSchema.parse({ ...full, ...more });
    expect(readerStatusLine(at({}))).toBe("Ativa");
    expect(readerStatusLine(at({ status: "suspended", suspendedUntil: "2026-12-01T00:00:00.000Z" }))).toBe("Suspensa até 01-12-2026");
    expect(readerStatusLine(at({ status: "suspended" }))).toBe("Suspensa");
    expect(readerStatusLine(at({ status: "banned" }))).toBe("Banida");
    expect(readerStatusLine(at({ status: "deleted" }))).toBe("Apagada");
  });
});

describe("what a reader did", () => {
  const item = (kind: string, text: string | null, target: object | null) =>
    activitySchema.parse({ at: "2026-11-23T21:40:00.000Z", kind, text, target });

  it("in words, one line each; a vote says which way; a kind the site doesn't know still reads", () => {
    expect(activityLabel(item("comment", "Concordo.", null))).toBe("Comentou");
    expect(activityLabel(item("forum_thread", null, null))).toBe("Abriu uma conversa no fórum");
    expect(activityLabel(item("vote", "up", null))).toBe("Votou a favor (▲)");
    expect(activityLabel(item("vote", "down", null))).toBe("Votou contra (▼)");
    expect(activityLabel(item("follow", null, null))).toBe("Passou a seguir");
    expect(activityLabel(item("read", null, null))).toBe("Marcou como lida no «Hoje em 5»");
    expect(activityLabel(item("teleport", null, null))).toBe("Atividade");
  });

  it("links to where it happened: an article, a story, a thread on its board, a Budget proposal, a blog post, an initiative", () => {
    expect(activityHref(item("comment", "x", { type: "article", id: 51234, title: "T" }).target)).toBe("/article/51234");
    expect(activityHref(item("importa", null, { type: "story", id: 77, title: "T" }).target)).toBe("/historias/77");
    expect(activityHref(item("forum_post", "x", { type: "thread", id: 17, title: "T", board: "geral" }).target)).toBe("/forum/geral/17");
    expect(activityHref(item("follow", null, { type: "budget_proposal", id: 25391, title: "T", year: 2027 }).target)).toBe(
      "/orcamento/2027/proposta/25391",
    );
    expect(activityHref(item("comment", "x", { type: "editorial", id: 3, title: "T", slug: "o-que-muda" }).target)).toBe(
      "/editorial/o-que-muda",
    );
    expect(activityHref(item("prediction", null, { type: "initiative", id: 9, title: "T" }).target)).toBe("/iniciativas/9");
    // Missing what the link needs, or nothing to link: no link, not a broken one.
    expect(activityHref(item("follow", null, { type: "budget_proposal", id: 1, title: "T" }).target)).toBeNull();
    expect(activityHref(item("feedback", "x", null).target)).toBeNull();
  });
});

describe("the readers' API", () => {
  it("asks the list with only the filters set", async () => {
    let url = "";
    server.use(
      http.get("*/api/v2/admin/readers", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ items: [full], nextCursor: "c50", total: 1342 });
      }),
    );
    const page = await getReaders({ q: "leitor", email: "confirmed", status: null, active: 7, sort: "last_seen" }, "c50");
    expect(new URL(url).search).toBe("?q=leitor&email=confirmed&active=7&sort=last_seen&cursor=c50");
    expect(page).toMatchObject({ nextCursor: "c50", total: 1342 });
    expect(page.items[0]!.username).toBe("leitor_exemplo");
  });

  it("every action carries its reason; a suspension its end", async () => {
    const sent: { path: string; body: unknown }[] = [];
    server.use(
      http.post("*/api/v2/admin/readers/:id/:action", async ({ request, params }) => {
        sent.push({ path: `${params.id}/${params.action}`, body: await request.json() });
        return HttpResponse.json({ ...full, status: "suspended", suspendedUntil: "2026-12-01T00:00:00.000Z", moderation: [] });
      }),
    );
    const reader = await readerAction(812, "suspend", { reason: "Insultos repetidos", until: "2026-12-01T00:00:00.000Z" });
    expect(sent).toEqual([{ path: "812/suspend", body: { reason: "Insultos repetidos", until: "2026-12-01T00:00:00.000Z" } }]);
    expect(reader.status).toBe("suspended");
  });
});

describe("where a reader signed up from", () => {
  it("the sign-up sends the site's page they came from; anything else isn't sent", async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post("*/api/v2/auth/register", async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ user: { id: 9, username: "novo", createdAt: "2026-11-24T10:00:00.000Z" } }, { status: 201 });
      }),
    );
    const base = { username: "novo", password: "uma-palavra-passe", captchaToken: "t" };
    await register({ ...base, signupFrom: "/orcamento/2027/proposta/25391" });
    await register({ ...base, signupFrom: "//outro.site/x" });
    await register({ ...base, signupFrom: `/${"a".repeat(400)}` });
    await register(base);
    expect(bodies.map((body) => body.signupFrom)).toEqual(["/orcamento/2027/proposta/25391", undefined, undefined, undefined]);
  });
});

describe("the page a reader signed up from, as a link", () => {
  it("links only a path on this site; anything else, sent straight to the API, stays text", () => {
    expect(signupHref("/orcamento/2027/proposta/25391")).toBe("/orcamento/2027/proposta/25391");
    expect(signupHref("//evil.example/x")).toBeNull();
    expect(signupHref("https://evil.example")).toBeNull();
    expect(signupHref("javascript:alert(1)")).toBeNull();
    expect(signupHref("/\\evil.example")).toBeNull();
    expect(signupHref(null)).toBeNull();
  });
});
