import { describe, expect, it, vi } from "vitest";
import { episodeTitle, podcastFromUrl } from "@/lib/podcast";

describe("podcast link", () => {
  it("takes Spotify's share links for a show or an episode", () => {
    expect(podcastFromUrl("https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk?si=abc123")).toEqual({
      kind: "show",
      url: "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk",
      embedUrl: "https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk?utm_source=generator&theme=0",
    });
    expect(podcastFromUrl(" https://open.spotify.com/intl-pt/episode/7makk4oTQel546B0PZlDM5 ")?.kind).toBe("episode");
    expect(podcastFromUrl("https://open.spotify.com/embed/episode/7makk4oTQel546B0PZlDM5")?.url).toBe(
      "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5",
    );
  });

  it("ignores anything else", () => {
    for (const value of [
      undefined,
      "",
      "não é um link",
      "http://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk",
      "https://evil.example/show/4rOoJ6Egrf8K2IrywzwOMk",
      "https://open.spotify.com/artist/4rOoJ6Egrf8K2IrywzwOMk",
      "https://open.spotify.com/show/x",
    ])
      expect(podcastFromUrl(value)).toBeNull();
  });
});

describe("the newest episode", () => {
  it("is cached for 5 minutes, not an hour: the API already reads Spotify hourly", async () => {
    const calls: RequestInit[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      calls.push(init ?? {});
      return new Response(JSON.stringify({ title: "Episódio de teste", spotifyUrl: null }), { status: 200 });
    });
    const { getLatestEpisode } = await import("@/lib/api/podcast");
    await getLatestEpisode();
    spy.mockRestore();
    expect((calls[0] as { next?: { revalidate?: number } }).next?.revalidate).toBe(300);
  });
});

describe("episodeTitle", () => {
  it("drops Spotify's leading date, said on the details line instead", () => {
    expect(episodeTitle("19 nov. · Orçamento: oposição aprova medidas")).toBe("Orçamento: oposição aprova medidas");
    expect(episodeTitle("3 dez · Debate quinzenal")).toBe("Debate quinzenal");
  });
  it("keeps a title without one", () => {
    expect(episodeTitle("Orçamento: 19 nov. · votações")).toBe("Orçamento: 19 nov. · votações");
    expect(episodeTitle("19 nov. · ")).toBe("19 nov. · ");
  });
});

describe("the earlier episodes (blog, Podcasts filter)", () => {
  const item = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: `18 nov. · Episódio ${id}`,
    publishedAt: "2026-11-18T07:00:00.000Z",
    durationSeconds: 400,
    imageUrl: null,
    url: `https://open.spotify.com/episode/${id}`,
    embedUrl: `https://open.spotify.com/embed/episode/${id}`,
    ...extra,
  });
  const answer = (episodes: unknown[]) => ({ show: { url: "https://open.spotify.com/show/x", embedUrl: "" }, latest: null, episodes });

  it("asks for 11, leaves out the newest (the box above shows it) and keeps up to 10, cached for 5 minutes", async () => {
    const calls: [string, RequestInit][] = [];
    const ids = Array.from({ length: 11 }, (_, i) => `Ep${String(i).padStart(2, "0")}aaaaaaaaaaaaaaaa`);
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push([String(url), init ?? {}]);
      return new Response(JSON.stringify(answer(ids.map((id) => item(id)))), { status: 200 });
    });
    const { getEarlierEpisodes } = await import("@/lib/api/podcast");
    const episodes = await getEarlierEpisodes();
    spy.mockRestore();
    expect(calls[0]![0]).toMatch(/\/podcast\?limit=11$/);
    expect((calls[0]![1] as { next?: { revalidate?: number } }).next?.revalidate).toBe(300);
    expect(episodes).toHaveLength(10);
    expect(episodes[0]).toEqual({
      title: `18 nov. · Episódio ${ids[1]}`,
      publishedAt: "2026-11-18T07:00:00.000Z",
      durationSeconds: 400,
      imageUrl: null,
      url: `https://open.spotify.com/episode/${ids[1]}`,
      // Built from the episode's link by podcastFromUrl, as for the newest one.
      embedUrl: `https://open.spotify.com/embed/episode/${ids[1]}?utm_source=generator&theme=0`,
    });
  });

  it("skips an episode that isn't Spotify's or is malformed, and is empty when the API fails", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            answer([
              item("Newestaaaaaaaaaaaaaaaa"),
              item("Otheraaaaaaaaaaaaaaaaa", { url: "https://evil.example/x" }),
              { title: 3 },
              item("Goodaaaaaaaaaaaaaaaaaa"),
            ]),
          ),
          { status: 200 },
        ),
      );
    const { getEarlierEpisodes } = await import("@/lib/api/podcast");
    expect((await getEarlierEpisodes()).map((episode) => episode.title)).toEqual(["18 nov. · Episódio Goodaaaaaaaaaaaaaaaaaa"]);
    spy.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    expect(await getEarlierEpisodes()).toEqual([]);
    spy.mockRestore();
  });
});
