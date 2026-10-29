import { type PlaywrightTestConfig, defineConfig } from '@playwright/test';
import path from 'path';
import { env } from './util.js';

/** Variable -> why the run cannot proceed without it. The suite refuses to start without them. */
const REQUIRED_ENV: Record<string, string> = {
  SITE_URL: 'the origin every request is built from; tests/util.ts reads it with no fallback',
  RIME_CONFIG_DIR:
    'where the config lives. Must be `src/lib/+rime` in this repo — `rime:use` copies each fixture there, while rime itself defaults to `src/+rime`'
};

const missing = Object.entries(REQUIRED_ENV).filter(([key]) => !env[key]);

if (missing.length) {
  throw new Error(
    `Missing environment for the e2e suite:\n\n` +
      missing.map(([key, why]) => `  ${key}\n      ${why}`).join('\n\n') +
      `\n\nAdd them to .env at the repo root (see CONTRIBUTING.md), or export them.\n`
  );
}

type Args = {
  name: string;
  /**
   * Test files run at once, against the one server and database. Only a suite whose files read
   * nothing another file writes may raise it: a file's tests always run in order, in one worker.
   */
  workers?: number;
};

/**
 * One suite's Playwright config: `rime:use <name>` copies tests/<name> into place, `vite dev`
 * serves it, then tests/setup.test.ts creates the admin before every tests/<name>/*.test.ts.
 *
 * @example
 * export default createPlaywrightConfig({ name: 'basic' });
 */
export function createPlaywrightConfig({ name, workers = 1 }: Args): PlaywrightTestConfig {
  return defineConfig({
    workers,
    reporter: 'line',
    webServer: {
      command: `echo "==========================================\n# Running rime:use ${name}\n" && bun run rime:use ${name} && bunx vite dev`,
      cwd: process.cwd(),
      // Waits for the sign-in page to answer: it exists in every config, needs no session and no
      // document, and answers once vite has loaded the server modules.
      url: `${env.SITE_URL}/${env.RIME_PANEL_ROUTE || 'panel'}/sign-in`,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    expect: {
      timeout: 30000
    },
    use: {
      baseURL: env.SITE_URL,
      extraHTTPHeaders: {
        origin: env.SITE_URL
      }
    },
    projects: [
      {
        name: 'setup',
        testDir: path.join(process.cwd(), './tests'),
        testMatch: /setup\.test\.ts/
      },
      {
        name: 'tests',
        dependencies: ['setup'],
        testDir: path.join(process.cwd(), `./tests/${name}`),
        testMatch: /^.*\.test\.ts$/
      }
    ]
  });
}
