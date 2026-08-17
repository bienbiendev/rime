import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// process.cwd() isn't reliable here: .auto/@test-local-pack.sh invokes this
// config while cwd is the scaffolded consumer app, not the repo root.
const testDir = path.dirname(fileURLToPath(import.meta.url));

// No `webServer` here: .auto/@test-local-pack.sh starts/stops the target
// server itself (dev on :5173, then the production build on :3000) and
// points us at it via PUBLIC_RIME_URL for each pass.
export default defineConfig({
  workers: 1,
  reporter: 'line',
  testDir,
  testMatch: /consumer\.test\.ts/,
  expect: {
    timeout: 30000
  },
  use: {
    baseURL: process.env.PUBLIC_RIME_URL || 'http://localhost:5173',
    extraHTTPHeaders: {
      origin: process.env.PUBLIC_RIME_URL || 'http://localhost:5173'
    }
  }
});
