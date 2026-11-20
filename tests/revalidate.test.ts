import { describe, expect, it, vi } from "vitest";
import { answerRevalidate } from "@/lib/revalidate";

const SECRET = "a".repeat(64);
const ping = (body: unknown, auth: string | null = `Bearer ${SECRET}`) =>
  new Request("https://www.politicando.pt/api/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/revalidate (the backend, after each job)", () => {
  it("drops what changed at once, so the next visit fetches fresh: never an old copy", async () => {
    const drop = vi.fn();
    const answer = await answerRevalidate(ping({ tags: ["news", "podcast"] }), { secret: SECRET, drop });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ revalidated: ["news", "podcast"] });
    expect(drop.mock.calls).toEqual([["news"], ["podcast"]]);
  });
  it("401 without the secret or with a wrong one, and drops nothing", async () => {
    const drop = vi.fn();
    expect((await answerRevalidate(ping({ tags: ["news"] }, null), { secret: SECRET, drop })).status).toBe(401);
    expect((await answerRevalidate(ping({ tags: ["news"] }, `Bearer ${"b".repeat(64)}`), { secret: SECRET, drop })).status).toBe(401);
    expect((await answerRevalidate(ping({ tags: ["news"] }, "Bearer short"), { secret: SECRET, drop })).status).toBe(401);
    expect(drop).not.toHaveBeenCalled();
  });
  it("ignores the tags it doesn't know, so the backend can add more", async () => {
    const drop = vi.fn();
    const answer = await answerRevalidate(ping({ tags: ["news", "budget", "qualquer-coisa"] }), { secret: SECRET, drop });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ revalidated: ["news", "budget"] });
    expect(drop.mock.calls).toEqual([["news"], ["budget"]]);
  });
  it("200 with nothing dropped when every tag is unknown", async () => {
    const drop = vi.fn();
    const answer = await answerRevalidate(ping({ tags: ["weather"] }), { secret: SECRET, drop });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ revalidated: [] });
    expect(drop).not.toHaveBeenCalled();
  });
  it("still reads the older { changed } body", async () => {
    const drop = vi.fn();
    expect((await answerRevalidate(ping({ changed: ["government", "predictions"] }), { secret: SECRET, drop })).status).toBe(200);
    expect(drop.mock.calls).toEqual([["government"], ["predictions"]]);
  });
  it("400 only without a list: missing, empty, not a list, or a body that isn't JSON", async () => {
    const drop = vi.fn();
    for (const body of [{}, { tags: [] }, { tags: "news" }, { changed: [] }, "not json"])
      expect((await answerRevalidate(ping(body), { secret: SECRET, drop })).status).toBe(400);
    expect(drop).not.toHaveBeenCalled();
  });
  it("503 while the site has no secret set", async () => {
    expect((await answerRevalidate(ping({ tags: ["news"] }), { secret: undefined, drop: vi.fn() })).status).toBe(503);
  });
  it("names each change once", async () => {
    const drop = vi.fn();
    await answerRevalidate(ping({ tags: ["news", "news"] }), { secret: SECRET, drop });
    expect(drop.mock.calls).toEqual([["news"]]);
  });
});
