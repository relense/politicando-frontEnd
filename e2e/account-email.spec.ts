import { expect, test } from "@playwright/test";
import { lastEmailToken, noSeriousA11yIssues, signUp } from "./helpers";

const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

test("signing up with an email and the newsletter, then confirming it with the button", async ({ page }) => {
  const name = `e${unique()}`;
  const email = `${name}@exemplo.pt`;
  await page.goto("/criar-conta");
  await page.getByLabel("Nome público").fill(name);
  await page.getByLabel("Palavra-passe", { exact: true }).fill("uma-frase-bem-comprida");
  const emailField = page.getByLabel(/^Email \(opcional\)/);
  const newsletter = page.getByRole("checkbox", { name: "Quero receber a newsletter semanal" });
  await expect(newsletter).not.toBeChecked();
  // The newsletter needs an email.
  await newsletter.check();
  await page.getByRole("checkbox", { name: /Aceito os/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Para receberes a newsletter, junta o teu email.")).toBeVisible();
  await emailField.fill("ana@");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Esse email não parece certo. Confirma-o.").first()).toBeVisible();
  await emailField.fill(email);
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Conta criada" })).toBeVisible();
  await expect(page.getByText(/Enviámos-te um email para confirmares o endereço e a newsletter/)).toBeVisible();
  await noSeriousA11yIssues(page);

  // The link opens a page; nothing happens until the button.
  const token = await lastEmailToken(page, email);
  await page.goto(`/conta/confirmar-email?token=${token}`);
  await expect(page.getByRole("heading", { level: 1, name: "Confirma o teu email" })).toBeVisible();
  await noSeriousA11yIssues(page);
  await page.goto("/conta");
  await expect(page.getByText("por confirmar")).toBeVisible();
  await page.goto(`/conta/confirmar-email?token=${token}`);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Email confirmado e estás inscrito na newsletter");

  await page.goto("/conta/confirmar-email?token=confirm-expirado");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Esta ligação já não é válida");
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .getByRole("link", { name: /pedir outro/ }),
  ).toHaveAttribute("href", "/conta#email");
});

test("the profile asks for an email on every visit, adds, confirms and removes it, and toggles the newsletter", async ({ page }) => {
  await signUp(page);
  const email = `p${unique()}@exemplo.pt`;
  await page.goto("/conta");
  const card = page.getByRole("region", { name: "Protege a tua conta" });
  await expect(card).toContainText("Junta um email para não perderes a conta se te esqueceres da palavra-passe");
  await expect(card.getByRole("button", { name: "Agora não" })).toHaveCount(0);
  await noSeriousA11yIssues(page);
  await page.reload();
  await expect(card).toBeVisible();

  // The newsletter without an email: the API answers no_email, and the card asks for one, the newsletter ticked.
  const section = page.getByRole("region", { name: "Email e newsletter" });
  const toggle = section.getByRole("switch", { name: "Newsletter semanal" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  const field = card.getByLabel("Email", { exact: true });
  await expect(field).toBeFocused();
  await expect(card.getByRole("checkbox", { name: "Quero receber a newsletter semanal" })).toBeChecked();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await field.fill(email);
  await card.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(`Enviámos-te um email para ${email}`);
  await expect(section).toContainText(email);
  await expect(section).toContainText("por confirmar");
  // Asked for with the email: pending until the email is confirmed.
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(section).toContainText("Confirma o teu email para começares a receber");

  await page.goto(`/conta/confirmar-email?token=${await lastEmailToken(page, email)}`);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Email confirmado e estás inscrito na newsletter");
  await page.goto("/conta");
  await expect(card).toHaveCount(0);
  await expect(section).toContainText("confirmado");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(section).not.toContainText("Confirma o teu email para começares a receber");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await section.getByRole("button", { name: "Remover o email" }).click();
  await section.getByRole("button", { name: "Sim, remover" }).click();
  await expect(card).toBeVisible();
});

test("the feed asks once in a while for an email, and «Agora não» puts it off", async ({ page }) => {
  await signUp(page);
  await page.goto("/");
  const prompt = page.getByRole("region", { name: "Protege a tua conta" });
  await prompt.scrollIntoViewIfNeeded();
  await expect(prompt).toContainText("Junta um email para não perderes a conta se te esqueceres da palavra-passe");
  await prompt.getByRole("button", { name: "Agora não" }).click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(page.locator("main article").first()).toBeVisible();
  await expect(prompt).toHaveCount(0);
});

test("forgot password: the link on the login, the email, and a new password that logs in", async ({ page }) => {
  // An account with a confirmed email.
  const name = `r${unique()}`;
  const email = `${name}@exemplo.pt`;
  const answer = await page.request.post("/api/v2/auth/register", {
    data: { username: name, password: "uma-frase-bem-comprida", recaptchaToken: "captcha-disabled", email },
  });
  expect(answer.ok()).toBe(true);
  await page.goto(`/conta/confirmar-email?token=${await lastEmailToken(page, email)}`);
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Email confirmado");
  await page.request.post("/api/v2/auth/logout");

  await page.goto("/entrar");
  await page.getByRole("link", { name: "Esqueci-me da palavra-passe" }).click();
  await expect(page).toHaveURL(/\/conta\/recuperar/);
  await noSeriousA11yIssues(page);
  // The site's footer has its own email field (the newsletter).
  await page.locator("main").getByLabel("Email").fill(email);
  await page.getByRole("checkbox", { name: /Não sou um robô/ }).check();
  await page.getByRole("button", { name: "Enviar a ligação" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Se este email estiver confirmado numa conta, enviámos uma ligação.",
  );

  await page.goto("/conta/nova-palavra-passe?token=reset-expirado");
  await page.getByLabel("Nova palavra-passe").fill("outra-frase-bem-comprida");
  await page.getByRole("button", { name: "Mudar a palavra-passe" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Esta ligação já não é válida");
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .getByRole("link", { name: /pedir outra/ }),
  ).toHaveAttribute("href", "/conta/recuperar");

  await page.goto(`/conta/nova-palavra-passe?token=${await lastEmailToken(page, email)}`);
  await noSeriousA11yIssues(page);
  await page.getByLabel("Nova palavra-passe").fill("outra-frase-bem-comprida");
  await page.getByRole("button", { name: "Mudar a palavra-passe" }).click();
  await expect(page.locator("main").getByRole("status")).toContainText("Palavra-passe mudada. Já entraste");
  await page.goto("/conta");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});
