import { describe, expect, it } from "vitest";
import { pageTitle, TITLE_MAX } from "@/lib/seo";

const length = (title: string | { absolute: string }) => (typeof title === "string" ? `${title} | Politicando` : title.absolute).length;

describe("pageTitle", () => {
  it("keeps a short title, with the site's name after it", () => {
    expect(pageTitle("PS: Partido Socialista")).toBe("PS: Partido Socialista");
  });
  it("takes the first wording that fits, with the site's name if possible", () => {
    const title = pageTitle(
      "Freguesia de Santo António da Charneca (Barreiro): assembleia de freguesia e eleições",
      "Freguesia de Santo António da Charneca (Barreiro): eleições",
      "Freguesia de Santo António da Charneca (Barreiro)",
    );
    expect(title).toBe("Freguesia de Santo António da Charneca (Barreiro)");
    expect(pageTitle("Um título que não cabe de maneira nenhuma com o nome do site depois", "Outro bem mais curto…")).toBe(
      "Outro bem mais curto…",
    );
  });
  it("cuts a long headline at a word, never past the limit", () => {
    const long = "Recomenda ao Governo a adoção de uma estratégia plurianual para o reforço da atratividade das carreiras";
    const title = pageTitle(long);
    expect(length(title)).toBeLessThanOrEqual(TITLE_MAX);
    expect(typeof title === "object" && title.absolute.endsWith("…")).toBe(true);
    expect(typeof title === "object" && title.absolute.startsWith("Recomenda ao Governo a adoção")).toBe(true);
  });
});
