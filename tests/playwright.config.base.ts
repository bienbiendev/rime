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

export function createPlaywrightConfig({ name, workers = 1 }: Args): PlaywrightTestConfig {
  return defineConfig({
    workers,
    reporter: 'line',
    webServer: {
      command: `echo "==========================================\n# Running rime:use ${name}\n" && bun run rime:use ${name} && bunx vite dev`,
      cwd: process.cwd(),
      // `url`, not `port`: a port check passes the moment vite binds the socket, while the
      // first request still has to pull the whole SSR module graph through vite — tens of
      // seconds on a cold cache or a slow machine. That warm-up then lands inside the first
      // test instead of the startup budget, and setup.test.ts fails on its own 30s timeout
      // with the server perfectly healthy. Waiting on a real response moves it where it
      // belongs, under `timeout` below.
      //
      // The panel sign-in page rather than `/`: playwright polls until it gets a 2xx/3xx, and
      // `/` cannot be relied on for that. Every suite starts on a fresh database, so a fixture
      // whose home page loads a document (basic, versions) 404s until the tests create one.
      // Sign-in is generated for every config, needs no auth, and returns 200 immediately.
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
