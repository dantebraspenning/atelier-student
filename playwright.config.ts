import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', locale: 'en-GB' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A throwaway embedded database with demo data, simulated payments and logged email.
    command: `rm -rf .data/e2e && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { ...(process.env as Record<string, string>), PGLITE_DIR: '.data/e2e/pglite', UPLOAD_DIR: '.data/e2e/uploads', APP_URL: `http://localhost:${PORT}`, STRIPE_SECRET_KEY: '', SMTP_URL: '', SEED_DEMO: 'true' }
  }
});
