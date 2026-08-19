import { defineConfig } from '@playwright/test';
import path from 'path';

/**
 * Test config for consumer-apps that install rimecms.
 * These tests just cover pages/staff creation and sign-in/up on a basic configuration.
 * see: src/scripts/local-pack-test.sh
 */

const PORT = Number(process.env.CONSUMER_SERVER_PORT || '5173');
const PUBLIC_URL = process.env.PUBLIC_RIME_URL || `http://localhost:${PORT}`;

export default defineConfig({
  workers: 1,
  reporter: 'line',
  testDir: path.join(process.cwd(), './tests/consumer'),
  testMatch: /consumer\.test\.ts/,
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
