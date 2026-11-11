import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: [['list'], ['json',{outputFile:'test-results/browser-results.json'}]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    headless: true,
    launchOptions: existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] } : {},
    screenshot: 'only-on-failure',
  },
  webServer: { command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000 },
});
