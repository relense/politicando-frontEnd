import { describe, expect, it } from "vitest";
import { isOutletPhoto, storyPhoto } from "@/lib/api/stories";

const version = (sourceDomain: string, title: string, extra: { imageUrl?: string | null } = {}) => ({
  source: sourceDomain,
  sourceDomain,
  articleId: title.length,
  title,
  url: null,
  publishedAt: "2026-11-18T10:00:00Z",
  ...extra,
});

describe("isOutletPhoto", () => {
  it("knows an outlet's own photo hosts", () => {
    expect(isOutletPhoto("https://media-manager.noticiasaominuto.com/960/a.jpg", "noticiasaominuto.com")).toBe(true);
    expect(isOutletPhoto("https://img.iol.pt/preset/x/og", "cnnportugal.iol.pt")).toBe(true);
    expect(isOutletPhoto("https://media.assettype.com/dn/x.jpg", "dn.pt")).toBe(true);
    expect(isOutletPhoto("https://static-storage.dnoticias.pt/a.jpg", "www.dnoticias.pt")).toBe(true);
  });
  it("rejects another outlet's, a shared site's and a broken address", () => {
    expect(isOutletPhoto("https://wm.observador.pt/a.jpg", "cmjornal.pt")).toBe(false);
    expect(isOutletPhoto("https://media-manager.noticiasaominuto.com/a.jpg", "jornaleconomico.sapo.pt")).toBe(false);
    expect(isOutletPhoto("https://cdn.sapo.pt/a.jpg", "jornaleconomico.sapo.pt")).toBe(false);
    expect(isOutletPhoto("not a url", "dn.pt")).toBe(false);
  });
});

describe("storyPhoto", () => {
  const title = "O Orçamento na reta final";
  it("uses the lead outlet's own photo, credited to it", () => {
    const versions = [version("observador.pt", "Outro título"), version("cmjornal.pt", title)];
    expect(storyPhoto({ title, versions, imageUrl: "https://cdn.cmjornal.pt/a.jpg" })).toEqual({
      url: "https://cdn.cmjornal.pt/a.jpg",
      credit: "cmjornal.pt",
    });
  });
  it("uses another outlet's photo rather than none, credited to that outlet (19 Nov: CM's photo on a DNOTICIAS card)", () => {
    const versions = [version("cmjornal.pt", "Outro título"), version("dnoticias.pt", title)];
    expect(storyPhoto({ title, versions, imageUrl: "https://cdn.cmjornal.pt/b.jpg" })).toEqual({
      url: "https://cdn.cmjornal.pt/b.jpg",
      credit: "cmjornal.pt",
    });
  });
  it("credits no one when the photo's outlet can't be told", () => {
    const versions = [version("observador.pt", "Outro título"), version("dn.pt", title)];
    expect(storyPhoto({ title, versions, imageUrl: "https://elsewhere.com/a.jpg" })).toEqual({
      url: "https://elsewhere.com/a.jpg",
      credit: null,
    });
  });
  it("trusts the photo of a story told by one outlet", () => {
    expect(storyPhoto({ title, versions: [version("dn.pt", title)], imageUrl: "https://elsewhere.com/a.jpg" })).toEqual({
      url: "https://elsewhere.com/a.jpg",
      credit: "dn.pt",
    });
  });
  it("with a photo per outlet: the lead's, else the first outlet that has one; none when no outlet has one", () => {
    const versions = [
      version("publico.pt", "Outro título", { imageUrl: "https://x.pt/a.jpg" }),
      version("dn.pt", title, { imageUrl: null }),
    ];
    expect(storyPhoto({ title, versions, imageUrl: "https://x.pt/a.jpg" })).toEqual({ url: "https://x.pt/a.jpg", credit: "publico.pt" });
    versions[1]!.imageUrl = "https://media.assettype.com/dn/b.jpg";
    expect(storyPhoto({ title, versions, imageUrl: "https://x.pt/a.jpg" })).toEqual({
      url: "https://media.assettype.com/dn/b.jpg",
      credit: "dn.pt",
    });
    versions[0]!.imageUrl = null;
    versions[1]!.imageUrl = null;
    expect(storyPhoto({ title, versions, imageUrl: null })).toBeNull();
  });
});
