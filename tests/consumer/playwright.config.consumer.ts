import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Test config for consumer-apps that install rimecms.
 * These tests cover pages/staff/media creation and sign-in/up on a basic configuration
 * (consumer.test.ts) plus a third-party plugin+field mounted into that same config
 * (consumer-plugin.test.ts) - both run by default.
 * see: src/scripts/local-pack-test.sh
 */

const PORT = Number(process.env.CONSUMER_SERVER_PORT || '5173');
const PUBLIC_URL = process.env.PUBLIC_RIME_URL || `http://localhost:${PORT}`;
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
    baseURL: PUBLIC_URL,
    extraHTTPHeaders: {
      origin: PUBLIC_URL
    }
  }
});
