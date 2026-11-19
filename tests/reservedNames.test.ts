import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { looksLikeTeam, RESERVED_NAME_MESSAGE, reservedNameMessage } from "@/lib/reservedNames";

describe("names that pass for the team", () => {
  it("refuses team words anywhere, ignoring accents, case and spacing", () => {
    for (const name of ["Politicando", "Redação", "Moderação", "admin", "A Equipa", "Admin1", "moderador_oficial", "Su porte"])
      expect(looksLikeTeam(name), name).toBe(true);
  });

  it("refuses the short ones only on their own", () => {
    for (const name of ["mod", "Mods", "sistema", "ROOT", "system2"]) expect(looksLikeTeam(name), name).toBe(true);
    for (const name of ["Modesto", "Rooteiro", "Zé", "Ana Silva", ""]) expect(looksLikeTeam(name), name).toBe(false);
  });

  it("turns the API's refusal into the reserved-name message, and nothing else", () => {
    const refused = new ApiError("body/nickname That name is the team's", 400, "invalid_request");
    expect(reservedNameMessage(refused)).toBe(RESERVED_NAME_MESSAGE);
    expect(reservedNameMessage(new ApiError("body/body Too long", 400, "invalid_request"))).toBeNull();
    expect(reservedNameMessage(new ApiError("That name is the team's", 500, "internal_error"))).toBeNull();
    expect(reservedNameMessage(new Error("That name is the team's"))).toBeNull();
  });
});
