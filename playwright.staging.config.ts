import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/staging', outputDir: 'staging-test-results', fullyParallel: true, retries: 0, reporter: 'list',
  use: { baseURL: process.env.STAGING_URL || 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [
    { name: 'staging-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'staging-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: process.env.STAGING_URL ? undefined : {
    command: 'pnpm exec wrangler dev --config dist-staging/worker/wrangler.json --local --port 4175 --inspector-port 0',
    env: { X_LOCAL_EXPLORER: 'false' },
    url: 'http://127.0.0.1:4175', reuseExistingServer: false, timeout: 30000,
  },
});
