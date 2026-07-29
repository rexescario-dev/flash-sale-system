import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  globalSetup: './global-setup.ts',
  projects: [
    {
      name: 'smoke',
      testMatch: /smoke\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression',
      testMatch: /regression\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  retries: process.env.CI ? 1 : 0,
  testDir: './tests',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  workers: 1,
});
