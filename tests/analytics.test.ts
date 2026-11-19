import { afterEach, describe, expect, it, vi } from "vitest";
import { track, umamiEvent } from "@/lib/analytics";

type WithUmami = { umami?: { track: (name: string, data?: Record<string, unknown>) => void } };

afterEach(() => {
  delete (window as WithUmami).umami;
});

describe("track: an event that happened (after the API said yes)", () => {
  it("goes to Umami with its details", () => {
    const spy = vi.fn();
    (window as WithUmami).umami = { track: spy };
    track("comment-sent", { where: "story", story: 472 });
    expect(spy).toHaveBeenCalledWith("comment-sent", { where: "story", story: 472 });
  });
  it("does nothing without Umami (not set up, blocked, Do Not Track) and never throws", () => {
    expect(() => track("register")).not.toThrow();
    (window as WithUmami).umami = {
      track: () => {
        throw new Error("blocked");
      },
    };
    expect(() => track("register")).not.toThrow();
  });
  it("leaves out empty details", () => {
    const spy = vi.fn();
    (window as WithUmami).umami = { track: spy };
    track("search", { where: "news", filter: undefined, party: null });
    expect(spy).toHaveBeenCalledWith("search", { where: "news" });
    track("login");
    expect(spy).toHaveBeenLastCalledWith("login", undefined);
  });
});

describe("umamiEvent: the attributes Umami counts a press by", () => {
  it("names the event and each detail", () => {
    expect(umamiEvent("outlet-click", { domain: "publico.pt", position: 2 })).toEqual({
      "data-umami-event": "outlet-click",
      "data-umami-event-domain": "publico.pt",
      "data-umami-event-position": "2",
    });
  });
  it("leaves out empty details", () => {
    expect(umamiEvent("podcast-play", { episode: null })).toEqual({ "data-umami-event": "podcast-play" });
  });
});
