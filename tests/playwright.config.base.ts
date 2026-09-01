import { type PlaywrightTestConfig, defineConfig } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';
import path from 'path';

/**
 * Load `.env`, then refuse to start without what the suite cannot run without.
 *
 * Vite loads `.env` for the dev server, but Playwright's own process never goes through vite —
 * so a repo set up exactly as CONTRIBUTING describes still had no `PUBLIC_RIME_URL` in the
 * process running the tests. `setup.test.ts` reads it unguarded, so every suite died on its
 * first test with `POST /undefined/api/init` → 404, which says nothing about the cause and
 * takes a while to trace. Loading it here is what makes the check below meaningful: the
 * variables are supposed to live in `.env`, so that is where we have to look for them.
 *
 * dotenv does not overwrite anything already in the environment, so an exported value or a CI
 * secret still wins, and a missing `.env` file is a silent no-op.
 */
loadDotenv();

/** Variable -> why the run cannot proceed without it. */
const REQUIRED_ENV: Record<string, string> = {
  PUBLIC_RIME_URL:
    'the origin every request is built from; tests/util.ts and setup.test.ts read it with no fallback',
  RIME_CONFIG_DIR:
    'where the config lives. Must be `src/lib/+rime` in this repo — `rime:use` copies each fixture there, while rime itself defaults to `src/+rime`'
};

const missing = Object.entries(REQUIRED_ENV).filter(([key]) => !process.env[key]);

if (missing.length) {
  throw new Error(
    `Missing environment for the e2e suite:\n\n` +
      missing.map(([key, why]) => `  ${key}\n      ${why}`).join('\n\n') +
      `\n\nAdd them to .env at the repo root (see CONTRIBUTING.md), or export them.\n`
  );
}

// Not required — five of the six suites never send mail — but `basic` creates an API key, which
// really sends one, so warn rather than let those five tests fail later with `mail_error`.
if (!process.env.RIME_SMTP_HOST) {
  console.warn(
    '[e2e] RIME_SMTP_HOST is not set. The `basic` suite creates an API key, which sends real\n' +
      '      mail — its api-key tests will fail with `mail_error`. Every other suite is fine.'
  );
}

type Args = {
  name: string;
};

export function createPlaywrightConfig({ name }: Args): PlaywrightTestConfig {
  return defineConfig({
    workers: 1,
    reporter: 'line',
    webServer: {
      command: `bun run rime:use ${name} && bunx vite dev`,
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
      url: `${process.env.PUBLIC_RIME_URL || 'http://localhost:5173'}/${process.env.RIME_PANEL_ROUTE || 'panel'}/sign-in`,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    expect: {
      timeout: 30000
    },
    use: {
      baseURL: process.env.PUBLIC_RIME_URL || 'http://localhost:5173',
      extraHTTPHeaders: {
        origin: process.env.PUBLIC_RIME_URL || 'http://localhost:5173'
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
