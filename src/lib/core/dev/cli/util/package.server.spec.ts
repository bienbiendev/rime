import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setBunScripts } from './package.server.js';

const cwd = process.cwd();
let root: string;
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
});

describe('setBunScripts', () => {
  it('runs a bare `vite` script and a `vite <args>` one with bun --bun, and leaves the others', () => {
    root = mkdtempSync(join(tmpdir(), 'rime-package-'));
    const scripts = { dev: 'vite', build: 'vite build', preview: 'node build' };
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'site', scripts }));
    process.chdir(root);

    expect(setBunScripts()).toBe(true);
    const json = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(json.scripts).toEqual({
      dev: 'bun --bun vite',
      build: 'bun --bun vite build',
      preview: 'node build'
    });
  });
});
