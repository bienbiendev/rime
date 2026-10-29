import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Test config for consumer-apps that install rimecms.
 * Sign-in and the creation of a page, a staff member and a media (consumer.test.ts), and a
 * third-party plugin and field in that same config (consumer-plugin.test.ts): both run by
 * default. consumer-custom-panel-route.test.ts runs only in the custom-route pass, which names
 * it in CONSUMER_TEST_MATCH.
 * see: src/scripts/local-pack-test.sh
 */

const PORT = Number(process.env.CONSUMER_SERVER_PORT || '5173');
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
// Lets local-pack-test.sh narrow a given pass to a single test file without a second
// playwright config to keep in sync with this one.
const TEST_MATCH = new RegExp(process.env.CONSUMER_TEST_MATCH || 'consumer(-plugin)?\\.test\\.ts$');

export default defineConfig({
  workers: 1,
  reporter: 'line',
  testDir: path.join(process.cwd(), './tests/consumer'),
  testMatch: TEST_MATCH,
  expect: {
    timeout: 30000
  },
  webServer: {
    command: process.env.CONSUMER_SERVER_COMMAND!,
    cwd: process.env.CONSUMER_SERVER_CWD,
    port: PORT,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe'
  },
  use: {
    baseURL: SITE_URL,
    extraHTTPHeaders: {
      origin: SITE_URL
    }
  }
});
