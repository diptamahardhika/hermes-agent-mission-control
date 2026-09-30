import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-test config.
 *
 * `webServer` is configured with `reuseExistingServer: true` so a local run
 * uses the dev server you already have on :8888 instead of starting a second
 * one. In CI (where nothing is listening) it boots the server itself and
 * waits for it.
 *
 * Only chromium is configured: the a11y audit already pins chromium, so this
 * adds no new browser download.
 */
const PORT = Number(process.env.PORT ?? 8888);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  // Keep output readable in a terminal; a real reporter is added in CI.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // One retry locally is noise; in CI it absorbs genuine flake.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Readiness probe. Deliberately NOT /api/hermes/health: that route queries
  // Postgres, and CI has no database, so waiting on it would always time out.
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: `${BASE_URL}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
