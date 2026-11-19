import { describe, expect, it } from "vitest";
import { parseLoginRequired } from "@/lib/participation";

describe("parseLoginRequired", () => {
  it("reads the backend's list, ignoring case, spaces and unknown words", () => {
    expect([...parseLoginRequired(" Comments, votes ,nonsense")]).toEqual(["comments", "votes"]);
    expect([...parseLoginRequired("comments,forum,votes,reports")]).toEqual(["comments", "forum", "votes", "reports"]);
  });

  it("asks for nothing when unset or empty, as the backend does by default", () => {
    expect(parseLoginRequired(undefined).size).toBe(0);
    expect(parseLoginRequired("").size).toBe(0);
  });
});
