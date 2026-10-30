import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateExports } from './generate-exports.server.js';

const cwd = process.cwd();
let root: string;
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
});

/** A package holding `files`, made the current directory. */
function project(files: Record<string, string>) {
  root = mkdtempSync(join(tmpdir(), 'rime-exports-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  process.chdir(root);
}

const readExports = () => JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).exports;

describe('generateExports', () => {
  it("deletes the entries a previous run wrote, and keeps the author's own", () => {
    const authors = {
      './tools/module': './src/tools/module.js',
      './widgets/module': { default: './dist/ui/widgets/module.js' },
      './extra/module': { svelte: './dist/extra/module.js', default: './dist/extra/module.js' }
    };
    const written = {
      './old/module': { default: './dist/old/module.server.js' },
      './gone/module': {
        types: './dist/gone/module.server.d.ts',
        browser: './dist/gone/module.browser.js',
        default: './dist/gone/module.server.js'
      }
    };
    // dist/ holds one pair, ui/widgets, and none of the written ones
    project({
      'package.json': JSON.stringify({
        name: '@acme/widgets',
        exports: { ...authors, ...written }
      }),
      'dist/index.js': 'export {};\n',
      'dist/ui/widgets/module.js': 'export const widget = 1;\n'
    });

    generateExports();

    expect(readExports()).toEqual({
      ...authors,
      './ui/widgets/module': {
        browser: './dist/ui/widgets/module.js',
        default: './dist/ui/widgets/module.js'
      }
    });
  });
});
