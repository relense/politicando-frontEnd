import { describe, expect, it } from "vitest";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

// What share previews and search results show uncut (opengraph.xyz's limits).
describe("the home page's title and description", () => {
  it("fit in 60 and 125 characters", () => {
    expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(125);
  });
});
