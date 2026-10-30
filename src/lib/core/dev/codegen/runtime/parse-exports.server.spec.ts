import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { parseExportNames } from './parse-exports.server.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rime-parse-exports-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** The export names of a module holding `content`. */
const exportsOf = (content: string) => {
  const file = join(dir, 'module.server.ts');
  writeFileSync(file, content);
  return parseExportNames(file);
};

it('collects a destructured export and a namespace re-export', () => {
  expect(exportsOf("export const { a } = o;\nexport * as ns from './x';\n")).toEqual(['a', 'ns']);
});

it('refuses `export *`, whose names live in another file', () => {
  expect(() => exportsOf("export * from './x';\n")).toThrow("export * from './x'");
});

it('leaves out `export type *`, which has no runtime names', () => {
  expect(exportsOf("export type * from './x';\nexport const b = 1;\n")).toEqual(['b']);
});
