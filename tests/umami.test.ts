import { afterEach, describe, expect, it, vi } from "vitest";
import { forwardToUmami, readerIp } from "@/lib/umami";

const send = (headers: Record<string, string>) =>
  new Request("https://www.politicando.pt/stats/api/send", { method: "POST", headers, body: '{"type":"event"}' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("the reader's IP, for Umami's country (Umami doesn't store it)", () => {
  it("prefers Cloudflare's, which readers can't forge, then the forwarded chain's first address", () => {
    expect(readerIp(new Headers({ "true-client-ip": "193.136.0.1", "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe(
      "193.136.0.1",
    );
    expect(readerIp(new Headers({ "cf-connecting-ip": "193.136.0.2", "x-forwarded-for": "2.2.2.2" }))).toBe("193.136.0.2");
    expect(readerIp(new Headers({ "x-forwarded-for": "193.136.0.3, 10.0.0.1" }))).toBe("193.136.0.3");
    expect(readerIp(new Headers())).toBeNull();
  });
});

describe("events sent through our server", () => {
  it("reach Umami's /api/send with the reader's IP, browser and Umami's cache header, and no cookies", async () => {
    const calls: [string, RequestInit][] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push([String(url), init ?? {}]);
      return new Response('{"cache":"abc"}', { status: 200, headers: { "content-type": "application/json" } });
    });
    const answer = await forwardToUmami(
      send({
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (iPhone)",
        "true-client-ip": "193.136.0.1",
        "x-umami-cache": "token",
        cookie: "politicando_session=secret",
      }),
    );
    expect(calls[0]![0]).toBe("https://cloud.umami.is/api/send");
    const headers = new Headers(calls[0]![1].headers);
    expect(headers.get("x-forwarded-for")).toBe("193.136.0.1");
    expect(headers.get("user-agent")).toBe("Mozilla/5.0 (iPhone)");
    expect(headers.get("x-umami-cache")).toBe("token");
    expect(headers.get("cookie")).toBeNull();
    expect(calls[0]![1].method).toBe("POST");
    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe('{"cache":"abc"}');
  });

  it("go to the host set in UMAMI_HOST (an EU address, say)", async () => {
    vi.stubEnv("UMAMI_HOST", "https://eu.example.com/");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await forwardToUmami(send({}));
    expect(String(spy.mock.calls[0]![0])).toBe("https://eu.example.com/api/send");
  });

  it("fail quietly when Umami can't be reached: the page never notices", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
    expect((await forwardToUmami(send({}))).status).toBe(204);
  });
});
