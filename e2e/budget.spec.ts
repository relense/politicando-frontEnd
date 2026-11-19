import { expect, test } from "@playwright/test";
import { gotoReady, noSeriousA11yIssues } from "./helpers";

test("State Budget: the current one, today's votes, each party, the filters and a proposal opened in place and on its page", async ({
  page,
  isMobile,
}) => {
  await gotoReady(page, "/orcamento");
  await expect(page.getByRole("heading", { level: 1, name: "Orçamento do Estado 2027" })).toBeVisible();
  // Nothing wider than the screen (20 Nov: a long topic in the menu pushed the page sideways on phones).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // A one-letter acronym says the name.
  await expect(page.getByRole("navigation", { name: "Proposta por" }).getByRole("link", { name: "LIVRE", exact: true })).toBeVisible();
  await expect(page.getByText("Em especialidade", { exact: true })).toBeVisible();
  // The final overall vote's day, ahead of time, once the agenda shows its session.
  await expect(page.getByText(/^Votação final global marcada para \d\d-\d\d-\d{4}, às \d\dh\d\d$/)).toBeVisible();
  // The running tally first: 5 of the 8 fictional proposals voted.
  await expect(page.getByRole("region", { name: /propostas de alteração já votadas/ })).toContainText("de 8");
  // The Budget's own vote on the general principles.
  const general = page.getByRole("region", { name: "Votação na generalidade" });
  await expect(general).toContainText("PSD");
  // Today's votes, and each party's line.
  await expect(page.getByRole("region", { name: /^Votações de hoje/ })).toContainText("Artigo 9.º do Código do IRS");
  await expect(page.getByRole("region", { name: "Como está a votar cada partido" })).toContainText("PCP");

  // «Por votar»: pending and sent to the plenary together.
  const proposals = page.getByRole("list", { name: "Propostas de alteração" });
  await page.getByRole("link", { name: /^Por votar/ }).click();
  await expect(page).toHaveURL(/resultado=por-votar/);
  // The proposals themselves, not the vote chips inside them.
  await expect(proposals.locator(":scope > li")).toHaveCount(3);

  // A search, then a proposal opened in place.
  await page.goto("/orcamento?q=irs#propostas");
  const irs = proposals.locator(":scope > li").filter({ hasText: "Artigo 9.º do Código do IRS" });
  await irs.getByText("Artigo 9.º do Código do IRS").click();
  await expect(irs).toContainText("Rui Valadares: contra");
  // «O que muda», marked as written by a model.
  await expect(irs).toContainText("Muda os escalões do IRS Jovem");
  await expect(irs).toContainText("Resumo automático");
  await expect(irs.getByRole("link", { name: /PDF oficial/ })).toHaveAttribute("href", "https://example.com/oe/28301.pdf");
  await irs.getByRole("link", { name: /Página da proposta/ }).click();
  await expect(page).toHaveURL(/\/orcamento\/2027\/proposta\/28301$/);
  // «O que muda» leads; the official title, when and where it was voted, under it.
  await expect(page.getByRole("heading", { level: 1, name: "Muda os escalões do IRS Jovem para quem tem até 35 anos." })).toBeVisible();
  await expect(page.getByText("Título oficial: Artigo 9.º do Código do IRS")).toBeVisible();
  await expect(page.getByText(/^Votada a \d\d-\d\d-\d{4}, em Comissão$/)).toBeVisible();
  await expect(page.getByText("Partido Social Democrata", { exact: true })).toBeVisible();
  await expect(page.getByText("Aprovada", { exact: true }).first()).toBeVisible();
  await noSeriousA11yIssues(page);

  await page.goto("/orcamento");
  // When a session began, never «a decorrer»: the parliament doesn't say when it ends.
  if (!isMobile) await expect(page.getByRole("region", { name: "Orçamento do Estado 2027" })).toContainText(/Começou às \d\dh\d\d/);
  await noSeriousA11yIssues(page);
});

test("State Budget: a past one has its final vote, a summary per party and every proposal; before 2006, only its votes", async ({
  page,
}) => {
  await page.goto("/orcamento/2026");
  await expect(page.getByRole("heading", { level: 1, name: "Orçamento do Estado 2026" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Votação final global" })).toContainText("CDS-PP");
  await expect(page.getByRole("region", { name: "Resumo por partido" })).toContainText("PSD");
  await expect(page.getByRole("list", { name: "Propostas de alteração" }).locator(":scope > li")).toHaveCount(3);
  await noSeriousA11yIssues(page);

  await page.goto("/orcamento/2005");
  await expect(page.getByRole("region", { name: "Votação final global" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Propostas de alteração" })).toHaveCount(0);

  // The current year lives at /orcamento; an unknown one is not found.
  await page.goto("/orcamento/2027");
  await expect(page).toHaveURL(/\/orcamento$/);
  const missing = await page.goto("/orcamento/1990");
  expect(missing?.status()).toBe(404);
});

test("the Budget's box beside the news, on wide screens", async ({ page, isMobile }) => {
  test.skip(isMobile, "Beside the news only on wide screens.");
  await gotoReady(page, "/");
  const box = page.getByRole("complementary", { name: "Ao lado das notícias" }).getByRole("region", { name: "Orçamento do Estado 2027" });
  await expect(box).toContainText("votadas");
  await expect(box).toContainText("Última votação");
  await box.getByRole("link", { name: /Ver as votações de hoje/ }).click();
  await expect(page).toHaveURL(/\/orcamento\?dia=\d{4}-\d{2}-\d{2}#propostas$/);
});
