import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4200' },
  webServer: { command: 'pnpm ng serve demo-dashboard --port 4200', url: 'http://localhost:4200', reuseExistingServer: true, timeout: 120_000 },
});
