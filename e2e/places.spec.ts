import { expect, test } from "@playwright/test";
import { noSeriousA11yIssues } from "./helpers";

test("the map of mayors leads to a municipality, its parishes and back up to the district", async ({ page }) => {
  await page.goto("/sitios");
  await expect(page.getByRole("heading", { level: 1, name: "Quem governa a tua terra" })).toBeVisible();
  // The legend counts câmaras per party; the independents' group counts as one.
  await expect(page.getByText("Toca num partido para o destacar no mapa")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sintra: Helena Seixas/ })).toBeAttached();

  // The search narrows the list.
  await page.getByRole("searchbox", { name: "Procurar concelho" }).fill("agueda");
  await expect(page.getByText("1 concelho encontrado")).toBeVisible();
  const list = page.getByRole("region", { name: "Todos os concelhos" });
  await expect(list.getByRole("link", { name: /Lisboa/ })).toHaveCount(0);
  await list.getByRole("link", { name: /Águeda/ }).click();

  await expect(page).toHaveURL(/\/sitios\/LOCAL-010100$/);
  await expect(page).toHaveTitle(/Quem governa Águeda\?/);
  await expect(page.getByRole("heading", { level: 1, name: "Águeda" })).toBeVisible();
  await expect(page.getByText("Marta Quintela").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Câmara Municipal · 9 mandatos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Deputados eleitos por Aveiro/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver os contratos da câmara →" })).toHaveAttribute("href", "/contratos/entidade/500000101");
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(ld!)[0]).toMatchObject({ "@type": "AdministrativeArea", name: "Águeda" });

  await page.getByRole("link", { name: "Fermentelos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fermentelos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Assembleia de Freguesia · 9 mandatos/ })).toBeVisible();
  const trail = page.getByRole("navigation", { name: "Caminho" });
  await expect(trail.getByRole("link")).toHaveText(["Quem governa", "Aveiro", "Águeda", "Fermentelos"]);
  await trail.getByRole("link", { name: "Aveiro" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Aveiro" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Presidentes de câmara do distrito de Aveiro" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ovar: Luísa Barreto, PSD" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Ovar Luísa Barreto PSD" })).toBeVisible();
});

test("the map: find a place, it is framed and its card opens beside the map; zoom and the islands", async ({ page }) => {
  await page.goto("/sitios");
  const map = page.getByRole("group", { name: /Mapa dos concelhos/ });
  const before = await map.getAttribute("viewBox");

  // The search finds a municipality without accents, and opens it on the map.
  await page.getByRole("combobox", { name: "Procurar concelho, distrito ou presidente" }).fill("agueda");
  await page.getByRole("option", { name: /Águeda/ }).click();
  await expect(page).toHaveURL(/local=LOCAL-010100/);
  const card = page.getByRole("region", { name: "Águeda" });
  await expect(card.getByText("Marta Quintela")).toBeVisible();
  await expect(card.getByRole("list", { name: "Vereadores por lista" })).toBeVisible();
  await expect(card.getByRole("link", { name: /Câmara e assembleia municipal/ })).toHaveAttribute("href", "/sitios/LOCAL-010100#orgaos");
  await expect(map).not.toHaveAttribute("viewBox", before!);

  // Back to the whole mainland, then the buttons and a party lit in the legend.
  await page.getByRole("button", { name: "Ver o continente inteiro" }).click();
  await expect(map).toHaveAttribute("viewBox", before!);
  await page.getByRole("button", { name: "Aproximar" }).click();
  await expect(map).not.toHaveAttribute("viewBox", before!);
  await page.getByRole("button", { name: /^PSD/ }).click();
  await expect(page.getByRole("button", { name: /^PSD/ })).toHaveAttribute("aria-pressed", "true");

  // Pressing a place opens it too, and the card closes.
  await page.getByRole("button", { name: /^Sintra: Helena Seixas/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Sintra" })).toBeVisible();
  await page.getByRole("region", { name: "Sintra" }).getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByText("Carrega num concelho", { exact: true })).toBeVisible();

  // An address with a place opens on it.
  await page.goto("/sitios?local=LOCAL-010100");
  await expect(page.getByRole("region", { name: "Águeda" })).toBeVisible();
});

test("the district map, the election link and unknown places", async ({ page }) => {
  await page.goto("/sitios");
  await page.getByRole("link", { name: "Distritos" }).click();
  await expect(page).toHaveURL(/mapa=distritos/);
  await expect(page.getByRole("button", { name: "Aveiro: PSD lidera 2 de 3 câmaras" })).toBeAttached();

  await page.goto("/eleicoes/legislativas-2025/LOCAL-010100");
  await page.getByRole("link", { name: "Quem governa Águeda →" }).click();
  await expect(page).toHaveURL(/\/sitios\/LOCAL-010100$/);

  expect((await page.goto("/sitios/LOCAL-999999"))?.status()).toBe(404);
  expect((await page.goto("/sitios/GLOBAL-990000"))?.status()).toBe(404);
});

test("places pages have no serious accessibility issues", async ({ page }) => {
  for (const path of ["/sitios", "/sitios?mapa=distritos", "/sitios/LOCAL-010100", "/sitios/LOCAL-010000", "/sitios/LOCAL-010109"]) {
    await page.goto(path);
    await noSeriousA11yIssues(page);
  }
});
