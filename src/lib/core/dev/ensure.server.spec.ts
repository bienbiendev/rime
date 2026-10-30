import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** The environment as the app reads it, the shell and the .env files together. */
const env = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock('./env.server.js', () => ({ env }));

// A project with no .env file and nothing `rime init` writes, the current directory when
// ensure.server.ts loads
const cwd = process.cwd();
let root: string;
let ensureHasInit: () => void;
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'rime-ensure-'));
  process.chdir(root);
  ({ ensureHasInit } = await import('./ensure.server.js'));
});
afterAll(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
});
beforeEach(() => {
  for (const name of Object.keys(env)) delete env[name];
});

describe('ensureHasInit', () => {
  it('names the required variables that are unset', () => {
    env.BETTER_AUTH_SECRET = 'dev-secret';
    expect(() => ensureHasInit()).toThrow('Missing SITE_URL');
  });

  it('takes the variables from the environment, with no .env file', () => {
    env.SITE_URL = 'http://localhost:5173';
    env.BETTER_AUTH_SECRET = 'dev-secret';
    expect(() => ensureHasInit()).toThrow('Missing src/hooks.server.ts file');
  });
});
