import { defineConfig, devices } from "@playwright/test";

const env = {
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v2",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_CAPTCHA_MODE: "mock",
  // Pinned (a .env.local doesn't decide it), and the same for the server and the tests: stories off unless asked,
  // e.g. NEXT_PUBLIC_FEATURE_STORIES=1 npx playwright test.
  NEXT_PUBLIC_FEATURE_STORIES: process.env.NEXT_PUBLIC_FEATURE_STORIES ?? "0",
  // What needs an account: none unless asked (e2e/login-required.spec.ts).
};

process.env.NEXT_PUBLIC_FEATURE_STORIES = env.NEXT_PUBLIC_FEATURE_STORIES;
// The tests talk to the mock API too (e2e/accounts.spec.ts switches its login gate).
process.env.NEXT_PUBLIC_API_URL = env.NEXT_PUBLIC_API_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // CI's machines are slow: a server render after a click (a tab, a filter) can take longer than the default 5 s there.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "npm run mock:api", url: "http://localhost:4000/api/v2/parties", reuseExistingServer: !process.env.CI },
    {
      command: "npm run build && npm run start",
      url: "http://localhost:3000",
      env,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
