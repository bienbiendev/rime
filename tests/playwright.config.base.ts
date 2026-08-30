import { type PlaywrightTestConfig, defineConfig } from '@playwright/test';
import path from 'path';

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
      // `/` is a 404 for any config without a front-end route of its own (the `empty` fixture,
      // for one). Sign-in is generated for every config, needs no auth, and returns 200.
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
