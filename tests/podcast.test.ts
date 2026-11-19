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
