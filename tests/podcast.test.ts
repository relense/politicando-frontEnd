import { describe, expect, it } from "vitest";
import { podcastFromUrl } from "@/lib/podcast";

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
