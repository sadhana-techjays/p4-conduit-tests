import { defineConfig, devices } from '@playwright/test';

// Week 4 test project for the Conduit practice app, which runs on your own laptop.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  // One test at a time: light on your laptop, and the same on GitHub.
  workers: 1,
  // The HTML report is saved in playwright-report. To open it, type: npx playwright show-report
  // last-run/results.json keeps the result of the last run, so your coach can read it.
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'last-run/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    // When a test fails, keep a trace of it in test-results, to open with: npx playwright show-trace
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Playwright starts the app before the tests and stops it after them.
  // On your laptop, if the app is already running (npm start), Playwright uses that one.
  webServer: {
    command: 'node app/server.mjs',
    url: 'http://127.0.0.1:3000/api/tags',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
