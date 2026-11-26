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
  // Deputies are elected per círculo, not per municipality: said so, and the list starts folded.
  await expect(page.getByRole("heading", { name: "Deputados à Assembleia da República · círculo eleitoral: Aveiro" })).toBeVisible();
  await expect(page.getByText("Águeda não elege deputados próprios")).toBeVisible();
  const deputies = page.getByRole("region", { name: /Deputados à Assembleia da República/ });
  await expect(deputies.getByRole("link").first()).toBeHidden();
  await deputies.getByText(/^Ver os \d+ deputados do círculo$/).click();
  await expect(deputies.getByRole("link").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver os contratos da câmara →" })).toHaveAttribute("href", "/contratos/entidade/500000101");
  const ld = await page.locator('main script[type="application/ld+json"]').textContent();
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
  // The card lists its câmaras, and stops lighting it.
  const lit = page.getByRole("region", { name: "PSD" });
  await expect(lit.getByText(/\d+ concelhos?/)).toBeVisible();
  await lit.getByRole("button", { name: "Deixar de destacar" }).click();
  await expect(page.getByRole("button", { name: /^PSD/ })).toHaveAttribute("aria-pressed", "false");

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

test("who was elected: the câmara's names open, the assemblies folded, the source cited; a parish's junta president", async ({ page }) => {
  await page.goto("/sitios/LOCAL-010100");
  const organs = page.getByRole("region", { name: /Vereadores e assembleia municipal/ });
  const camara = organs.getByRole("list", { name: "Eleitos para a Câmara Municipal" });
  // Each list's names are a list inside the list of lists.
  await expect(camara.getByRole("list").getByRole("listitem").filter({ hasText: "Marta Quintela" })).toContainText("Presidente da câmara");
  await expect(camara.getByRole("link", { name: "Marta Quintela" })).toHaveAttribute("href", "/autarcas/marta-quintela");
  // The assembly's 27 start folded.
  const assembleia = organs.getByRole("list", { name: "Eleitos para a Assembleia Municipal" });
  await expect(assembleia).toBeHidden();
  await organs.getByText("Ver os 27 eleitos").click();
  await expect(assembleia.getByRole("list").getByRole("listitem")).toHaveCount(27);
  // A list whose names on the official map don't add up to its seats: its seats, no names.
  await expect(camara.getByRole("listitem").filter({ hasText: "Coligação PSD/CDS" })).toContainText("Nomes incompletos no mapa oficial.");
  // The source line, its link carrying a hidden "(abre num novo separador)"; the date is the map's latest rectification.
  await expect(
    organs.getByText(/^Eleitos nas Autárquicas 2021\. Fonte: CNE, Mapa Oficial dos resultados \(exemplo\)/).first(),
  ).toContainText("retificações até 01-03-2022). Substituições posteriores não estão refletidas.");
  await expect(organs.getByRole("link", { name: /CNE, Mapa Oficial/ }).first()).toHaveAttribute("href", "https://www.cne.pt/");
  await expect(organs.getByText(/não vêm nos resultados oficiais/)).toHaveCount(0);

  // A district's own page keeps its deputies open.
  await page.goto("/sitios/LOCAL-010000");
  await expect(
    page
      .getByRole("region", { name: /Deputados à Assembleia da República/ })
      .getByRole("link")
      .first(),
  ).toBeVisible();

  // A parish: who presides over the junta, up top.
  await page.goto("/sitios/LOCAL-010109");
  const junta = page.getByRole("region", { name: "Quem preside à Junta de Freguesia de Fermentelos" });
  await expect(junta.getByText("Presidente da junta")).toBeVisible();
  await expect(page.getByText(/Os presidentes de junta não são publicados/)).toHaveCount(0);

  // An API without the names yet: the seats only, and the note says why.
  await page.goto("/sitios/LOCAL-111100");
  await expect(page.getByText(/não vêm nos resultados oficiais/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Eleitos para a Câmara Municipal" })).toHaveCount(0);
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

test("the map: 'Usar a minha localização' opens the concelho you are in", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 40.57, longitude: -8.44 });
  await page.goto("/sitios");
  await page.getByRole("button", { name: "Usar a minha localização" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Águeda" })).toBeVisible();
  await expect(page).toHaveURL(/local=LOCAL-010100/);
  // Outside Portugal: said in words, nothing opens.
  await context.setGeolocation({ latitude: 48.85, longitude: 2.35 });
  await page.getByRole("button", { name: "Usar a minha localização" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "não estás em Portugal" })).toBeVisible();
});

test("a mayor's own page: who they are, their câmara and the news that name them", async ({ page }) => {
  await page.goto("/sitios/LOCAL-010100");
  await page.getByRole("link", { name: "Marta Quintela" }).first().click();
  await expect(page).toHaveURL(/\/autarcas\/marta-quintela$/);
  await expect(page).toHaveTitle(/^Marta Quintela, presidente da Câmara Municipal de Águeda/);
  await expect(page.getByRole("heading", { level: 1, name: "Marta Quintela" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Quem é Marta Quintela" })).toContainText(
    "Marta Quintela preside à Câmara Municipal de Águeda desde outubro de 2025, pela lista PARTIDO SOCIALISTA (PS).",
  );
  await expect(page.getByRole("link", { name: "Candidatura às Legislativas 2024" })).toHaveAttribute("href", "/eleicoes/legislativas-2024");
  const ld = JSON.parse((await page.locator('main script[type="application/ld+json"]').textContent())!);
  expect(ld[0]).toMatchObject({ "@type": "Person", name: "Marta Quintela", jobTitle: "Presidente da Câmara Municipal de Águeda" });
  await noSeriousA11yIssues(page);
  await page.getByRole("complementary", { name: "Ficha" }).getByRole("link", { name: "Águeda" }).click();
  await expect(page).toHaveURL(/\/sitios\/LOCAL-010100$/);
});
