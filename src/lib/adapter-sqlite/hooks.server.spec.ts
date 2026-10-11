import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GENERATED_DIR } from '#lib/core/dev/constants.server.js';
import { hooks } from './hooks.server.js';

/** A temporary project, the current directory while each test runs. */
let root: string;
const cwd = process.cwd();
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rime-sqlite-hooks-'));
  process.chdir(root);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const read = (file: string) => readFileSync(join(root, file), 'utf8');
const exists = (file: string) => existsSync(join(root, file));

describe('init', () => {
  it('writes drizzle.config.ts on storage/sqlite, creates the folder, and answers the starter config', async () => {
    const answer = await hooks.init({ name: 'app', bun: false });

    expect(read('drizzle.config.ts')).toContain("out: './storage/sqlite'");
    expect(read('drizzle.config.ts')).toContain("url: './storage/sqlite/app.sqlite'");
    expect(exists('storage/sqlite')).toBe(true);
    expect(answer.config).toEqual({
      import: "import { adapterSqlite } from 'rimecms/adapter-sqlite';",
      call: "adapterSqlite('app.sqlite')"
    });
    expect(answer.dependencies).toEqual(['drizzle-orm@1.0.0-rc.4', '@libsql/client']);
    expect(answer.devDependencies).toEqual(['drizzle-kit@1.0.0-rc.4']);
  });

  it('gives the bun driver to a bun project', async () => {
    const answer = await hooks.init({ name: 'app', bun: true });
    expect(answer.config.call).toBe("adapterSqlite('app.sqlite', { driver: 'bun' })");
  });

  it("patches only a stale schema line of a project's own drizzle.config.ts", async () => {
    writeFileSync(
      join(root, 'drizzle.config.ts'),
      "export default {\n  schema: './old/schema.server.ts',\n  verbose: true\n};\n"
    );

    await hooks.init({ name: 'app', bun: false });

    expect(read('drizzle.config.ts')).toBe(
      `export default {\n  schema: './${GENERATED_DIR}/schema.server.ts',\n  verbose: true\n};\n`
    );
  });
});

describe('init on a project from before the move', () => {
  it('throws naming rime db:move when its drizzle.config.ts names db/', async () => {
    writeFileSync(
      join(root, 'drizzle.config.ts'),
      "export default { out: './db', dbCredentials: { url: './db/app.sqlite' } };\n"
    );

    await expect(hooks.init({ name: 'app', bun: false })).rejects.toThrow('rime db:move');
    expect(exists('storage/sqlite')).toBe(false);
  });
});

describe('boot', () => {
  it('creates storage/sqlite/', async () => {
    writeFileSync(join(root, 'drizzle.config.ts'), 'export default {};\n');
    await hooks.boot();
    expect(exists('storage/sqlite')).toBe(true);
  });

  it('throws without drizzle.config.ts', async () => {
    await expect(hooks.boot()).rejects.toThrow('Missing drizzle.config.ts');
  });

  it('throws naming rime db:move when drizzle.config.ts still names db/, as in a fresh clone', async () => {
    writeFileSync(
      join(root, 'drizzle.config.ts'),
      "export default { out: './db', dbCredentials: { url: './db/app.sqlite' } };\n"
    );

    await expect(hooks.boot()).rejects.toThrow('rime db:move');
    expect(exists('storage/sqlite')).toBe(false);

    // Even beside a storage/sqlite/ an earlier boot left
    mkdirSync(join(root, 'storage/sqlite'), { recursive: true });
    await expect(hooks.boot()).rejects.toThrow('rime db:move');
  });

  it('throws naming rime db:move when the database is still in db/, and creates nothing', async () => {
    writeFileSync(join(root, 'drizzle.config.ts'), 'export default {};\n');
    mkdirSync(join(root, 'db'));

    await expect(hooks.boot()).rejects.toThrow('rime db:move');
    expect(exists('storage/sqlite')).toBe(false);
  });
});

describe('clear', () => {
  it('removes storage/sqlite/ and drizzle.config.ts, and answers both', async () => {
    writeFileSync(join(root, 'drizzle.config.ts'), 'export default {};\n');
    mkdirSync(join(root, 'storage/sqlite'), { recursive: true });
    writeFileSync(join(root, 'storage/sqlite/app.sqlite'), '');
    mkdirSync(join(root, 'storage/uploads'), { recursive: true });

    expect(await hooks.clear()).toEqual(['storage/sqlite', 'drizzle.config.ts']);
    expect(exists('storage/sqlite')).toBe(false);
    expect(exists('drizzle.config.ts')).toBe(false);
    // The uploads are core's
    expect(exists('storage/uploads')).toBe(true);
  });

  it('answers nothing on an empty project', async () => {
    expect(await hooks.clear()).toEqual([]);
  });
});

describe('module', () => {
  it('names the package entry the hooks are imported from', () => {
    expect(hooks.module).toBe('rimecms/adapter-sqlite/hooks');
  });
});
