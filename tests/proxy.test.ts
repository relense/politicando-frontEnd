import { describe, expect, it } from "vitest";
import { unsafePath } from "@/lib/api/proxy";

describe("the account proxy's path", () => {
  it("refuses dot segments and empty parts, which would climb out of the API's path past the route's checks", () => {
    expect(unsafePath(["me", "notifications"])).toBe(false);
    expect(unsafePath(["comments", "12", "like"])).toBe(false);
    expect(unsafePath(["me", "..", "..", "admin"])).toBe(true);
    expect(unsafePath(["comments", "."])).toBe(true);
    expect(unsafePath(["me", ""])).toBe(true);
  });
});
