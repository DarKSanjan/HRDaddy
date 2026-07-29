import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Capped rather than left at Playwright's default (one worker per CPU
  // core): every spec here drives a real login and real dbAs() transactions
  // against one local Postgres instance via one connection pool, and 5+
  // parallel browser sessions signing in at once intermittently drops the
  // post-login redirect (auth session read contending under load) — the
  // same class of concurrent-connection fragility already hardened
  // elsewhere in this app, just now visible under real parallel E2E load.
  workers: process.env.CI ? 1 : 3,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
