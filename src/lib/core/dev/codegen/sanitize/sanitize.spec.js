import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CONFIG_DIR, GENERATED_DIR } from '../../constants.server.js';
import { sanitize } from './index.server.js';

/** @type {string} */
let root;

// sanitize() reads the project root from the working directory: a temporary project per test
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rime-sanitize-'));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

/**
 * Writes `content` at `file`, a path below the temporary project root.
 * @param {string} file
 * @param {string} content
 */
const write = (file, content) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};

/**
 * The content of `file`, a path below the temporary project root.
 * @param {string} file
 */
const read = (file) => readFileSync(join(root, file), 'utf8');

test('sanitize() splits a config file, deletes a stale generated file, and keeps schema.server.ts and params.ts', async () => {
  write(
    `${CONFIG_DIR}/rime.config.server.ts`,
    "import { fields } from './fields';\nexport default { fields };\n"
  );
  write(
    `${CONFIG_DIR}/fields.ts`,
    "export const fields = [text('title').$beforeSave((value) => value.trim())];\n"
  );
  write(`${GENERATED_DIR}/stale.ts`, 'export const removed = true;\n');
  write(`${GENERATED_DIR}/schema.server.ts`, '// schema\n');
  write(`${GENERATED_DIR}/params.ts`, '// params\n');

  // The project is the temporary one, never this repository
  expect(process.cwd()).toBe(root);
  await sanitize();

  expect(existsSync(join(root, GENERATED_DIR, 'stale.ts'))).toBe(false);
  // Written by other codegen steps: left as they are
  expect(read(`${GENERATED_DIR}/schema.server.ts`)).toBe('// schema\n');
  expect(read(`${GENERATED_DIR}/params.ts`)).toBe('// params\n');

  expect(read(`${GENERATED_DIR}/fields.ts`)).not.toContain('$beforeSave');
  expect(read(`${GENERATED_DIR}/fields.server.ts`)).toContain('$beforeSave');
  expect(read(`${GENERATED_DIR}/rime.config.server.ts`)).toContain("from './fields.server.js'");
});

test('sanitize() splits a .js config file like a .ts one', async () => {
  const news = `import { Collection } from 'rimecms';
const SECRET = 'abc';
export const News = Collection.create('news', {
  label: 'News',
  $url: (doc) => '/' + SECRET + doc.id
});
`;
  write(`${CONFIG_DIR}/news.js`, news);
  write(
    `${CONFIG_DIR}/rime.config.server.ts`,
    "import { News } from './news.js';\nexport default rime({ collections: [News] });\n"
  );

  await sanitize();

  expect(read(`${GENERATED_DIR}/news.js`)).not.toContain('$url');
  expect(read(`${GENERATED_DIR}/news.js`)).not.toContain('SECRET');
  expect(read(`${GENERATED_DIR}/news.server.js`)).toBe(news);
  expect(read(`${GENERATED_DIR}/rime.config.server.ts`)).toContain("from './news.server.js'");
});
