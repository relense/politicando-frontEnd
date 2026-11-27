import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

// Beside the news on wide screens: how many articles each outlet published today, and about each party.
test("today's counts: the day's total, a bar per outlet, and the parties tab", async ({ page, isMobile }) => {
  test.skip(isMobile, "The column beside the news is for wide screens only.");
  await page.goto("/");
  const box = page.getByRole("complementary", { name: "Ao lado das notícias" }).getByRole("region", { name: /^Hoje: \d+ notícias$/ });
  await expect(box).toBeVisible();
  await expect(box).toContainText("desde as 05:00");
  // The mock's 4 outlets, most first, and no links: the bars are only to compare.
  await expect(box.getByRole("listitem")).toHaveCount(4);
  // Outlets by name, not by domain.
  await expect(box.getByRole("listitem").filter({ hasText: "Público" })).toHaveCount(1);
  await expect(box).not.toContainText(".pt");
  await expect(box.getByRole("link")).toHaveCount(0);
  await box.getByRole("button", { name: "Partidos" }).click();
  await expect(box.getByRole("button", { name: "Partidos" })).toHaveAttribute("aria-pressed", "true");
  await expect(box.getByRole("listitem").first()).toContainText("PS");
  await expect(box).toContainText("Uma notícia pode falar de vários partidos");
  await noSeriousA11yIssues(page);
});
