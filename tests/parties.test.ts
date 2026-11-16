import { describe, expect, it } from "vitest";
import { ofParty } from "@/lib/parties";

describe("ofParty", () => {
  it("takes 'da' before feminine names and 'do' otherwise", () => {
    expect(ofParty("Iniciativa Liberal")).toBe("da");
    expect(ofParty("Alternativa Democrática Nacional")).toBe("da");
    expect(ofParty("Nova Direita")).toBe("da");
    expect(ofParty("Partido Social Democrata")).toBe("do");
    expect(ofParty("Livre")).toBe("do");
    expect(ofParty("Bloco de Esquerda")).toBe("do");
  });
});
