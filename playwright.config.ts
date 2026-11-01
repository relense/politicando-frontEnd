import { defineConfig, devices } from "@playwright/test";

const env = {
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v2",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_CAPTCHA_MODE: "mock",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    { command: "npm run mock:api", url: "http://localhost:4000/api/v2/parties", reuseExistingServer: !process.env.CI },
    { command: "npm run build && npm run start", url: "http://localhost:3000", env, timeout: 240_000, reuseExistingServer: !process.env.CI },
  ],
});
