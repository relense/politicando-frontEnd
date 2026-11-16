import { afterEach, describe, expect, it, vi } from "vitest";

const incoming = new Headers();
vi.mock("next/headers", () => ({ headers: async () => incoming }));

const { serverHeaders } = await import("@/lib/api/serverHeaders");

describe("what the site's server tells the API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    incoming.delete("true-client-ip");
  });

  it("sends nothing without a key", async () => {
    incoming.set("true-client-ip", "203.0.113.7");
    expect(await serverHeaders(false)).toEqual({});
  });

  it("sends the key, and the reader's IP only on uncached requests", async () => {
    vi.stubEnv("FRONTEND_API_KEY", "secret");
    incoming.set("true-client-ip", "203.0.113.7");
    expect(await serverHeaders(false)).toEqual({ "X-Frontend-Key": "secret", "X-Reader-IP": "203.0.113.7" });
    // A reader's IP on a cached request would split the shared cache per reader.
    expect(await serverHeaders(true)).toEqual({ "X-Frontend-Key": "secret" });
  });

  it("sends the key alone when there is no reader IP (not behind Cloudflare)", async () => {
    vi.stubEnv("FRONTEND_API_KEY", "secret");
    expect(await serverHeaders(false)).toEqual({ "X-Frontend-Key": "secret" });
  });
});
