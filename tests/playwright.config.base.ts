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
      command: `pnpm rime:use ${name} && pnpm vite dev`,
      port: 5173,
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

        // testMatch: /pages\.test\.ts/
      }
    ]
  });
}
