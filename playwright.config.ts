import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4180);
const remoteURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/browser',
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: remoteURL ?? `http://127.0.0.1:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } },
  ],
  webServer: remoteURL ? undefined : {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
    timeout: 120000,
  },
});