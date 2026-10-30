import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getPackageManager } from './package-manager.server.js';

const cwd = process.cwd();
let root: string;
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
});

describe('getPackageManager', () => {
  it.each([
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['package-lock.json', 'npm'],
    ['no lockfile', 'npm']
  ])('with %s in the project root, answers %s', (lockFile, packageManager) => {
    root = mkdtempSync(join(tmpdir(), 'rime-pm-'));
    if (lockFile !== 'no lockfile') writeFileSync(join(root, lockFile), '');
    process.chdir(root);
    expect(getPackageManager()).toBe(packageManager);
  });
});
