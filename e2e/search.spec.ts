import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

// One search across the site: the box beside the news on wide screens, the icon in the top bar elsewhere, and /procurar.
test("search the site: from the box or the icon to /procurar, results grouped by section, each a link", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("link", { name: "Procurar no Politicando" }).click();
    await expect(page).toHaveURL(/\/procurar$/);
    await expect(page.getByRole("heading", { level: 1, name: "Procurar" })).toBeVisible();
  } else {
    const box = page.getByRole("complementary", { name: "Ao lado das notícias" }).getByRole("search", { name: "Procurar no Politicando" });
    await box.getByRole("searchbox").fill("Águeda");
    await box.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/procurar\?q=%C3%81gueda/);
  }
  await page.goto("/procurar?q=agueda");
  await expect(page.getByRole("searchbox", { name: "Procurar no Politicando" })).toHaveValue("agueda");
  const places = page.getByRole("region", { name: "Sítios" });
  await expect(places.getByRole("link", { name: /^Águeda/ }).first()).toHaveAttribute("href", "/sitios/LOCAL-010100");
  await expect(places).toContainText("Município · distrito de Aveiro");
  await noSeriousA11yIssues(page);

  // A mayor by name, under Pessoas.
  await page.goto("/procurar?q=marta%20quintela");
  await expect(page.getByRole("region", { name: "Pessoas" }).getByRole("link", { name: /Marta Quintela/ })).toHaveAttribute(
    "href",
    "/autarcas/marta-quintela",
  );

  // Too short, and nothing found.
  await page.goto("/procurar?q=ab");
  await expect(page.getByText("Escreve pelo menos 3 letras.")).toBeVisible();
  await page.goto("/procurar?q=zzzqqqxx");
  await expect(page.getByText("Nada encontrado para «zzzqqqxx».")).toBeVisible();
});
