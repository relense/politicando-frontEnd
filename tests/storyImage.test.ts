import { describe, expect, it } from "vitest";
import { isOutletPhoto, storyImage } from "@/lib/api/stories";

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

describe("storyImage", () => {
  const title = "O Orçamento na reta final";
  it("uses the lead outlet's own photo when the API gives one per outlet, even null", () => {
    const versions = [
      version("publico.pt", "Outro título", { imageUrl: "https://x.pt/a.jpg" }),
      version("dn.pt", title, { imageUrl: null }),
    ];
    expect(storyImage({ title, versions, imageUrl: "https://x.pt/a.jpg" })).toBeNull();
    versions[1]!.imageUrl = "https://media.assettype.com/dn/b.jpg";
    expect(storyImage({ title, versions, imageUrl: "https://x.pt/a.jpg" })).toBe("https://media.assettype.com/dn/b.jpg");
  });
  it("keeps the story's photo only when it is recognisably the lead's", () => {
    const versions = [version("observador.pt", "Outro título"), version("cmjornal.pt", title)];
    expect(storyImage({ title, versions, imageUrl: "https://wm.observador.pt/a.jpg" })).toBeNull();
    expect(storyImage({ title, versions, imageUrl: "https://cdn.cmjornal.pt/a.jpg" })).toBe("https://cdn.cmjornal.pt/a.jpg");
  });
  it("trusts the photo of a story told by one outlet", () => {
    expect(storyImage({ title, versions: [version("dn.pt", title)], imageUrl: "https://elsewhere.com/a.jpg" })).toBe(
      "https://elsewhere.com/a.jpg",
    );
  });
});
