import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '#lib/core/logger.server.js';
import { dbMove, ignoreStorage, moveDatabaseFolder, moveDrizzlePaths } from './db-move.server.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rime-db-move-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Writes `content` at `file`, a path below the temporary project root. */
const write = (file: string, content: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const exists = (file: string) => existsSync(join(root, file));

/** A project from before the move: its database and one migration in `db/`. */
const oldProject = () => {
  write('db/app.sqlite', 'database');
  write('db/20261001194217_dazzling_wallflower/migration.sql', 'CREATE TABLE `pages` (`id` text);');
};

const DRIZZLE = `import { defineConfig, type Config } from 'drizzle-kit';

export const config: Config = {
  schema: './src/+rime.generated/schema.server.ts',
  out: './db',
  strict: false,
  verbose: true,
  dialect: 'sqlite',
  dbCredentials: {
    url: './db/app.sqlite'
  }
};
`;

describe('moveDatabaseFolder', () => {
  it('moves db/ to storage/sqlite/, migrations included', () => {
    oldProject();

    expect(moveDatabaseFolder(root)).toBe(true);

    expect(exists('db')).toBe(false);
    expect(read('storage/sqlite/app.sqlite')).toBe('database');
    expect(exists('storage/sqlite/20261001194217_dazzling_wallflower/migration.sql')).toBe(true);
  });

  it('moves nothing a second time', () => {
    oldProject();
    moveDatabaseFolder(root);

    expect(moveDatabaseFolder(root)).toBe(false);
    expect(read('storage/sqlite/app.sqlite')).toBe('database');
  });

  it('takes an empty storage/sqlite/ as absent', () => {
    oldProject();
    mkdirSync(join(root, 'storage/sqlite'), { recursive: true });

    expect(moveDatabaseFolder(root)).toBe(true);
    expect(read('storage/sqlite/app.sqlite')).toBe('database');
  });

  it('throws when storage/sqlite/ holds a file, and moves nothing', () => {
    oldProject();
    write('storage/sqlite/other.sqlite', 'other');

    expect(() => moveDatabaseFolder(root)).toThrow('hold files');
    expect(read('db/app.sqlite')).toBe('database');
    expect(readdirSync(join(root, 'storage/sqlite'))).toEqual(['other.sqlite']);
  });

  it('moves the folder of a deployed app, which has no drizzle.config.ts and no .gitignore', () => {
    oldProject();

    expect(moveDatabaseFolder(root)).toBe(true);
    expect(moveDrizzlePaths(root)).toEqual([]);
    expect(ignoreStorage(root)).toBe(false);
    expect(exists('storage/sqlite/app.sqlite')).toBe(true);
    expect(exists('.gitignore')).toBe(false);
  });
});

describe('a fresh clone, its db/ gitignored', () => {
  it('moves no folder and points drizzle.config.ts at storage/sqlite', () => {
    write('drizzle.config.ts', DRIZZLE);

    expect(moveDatabaseFolder(root)).toBe(false);
    expect(moveDrizzlePaths(root)).toHaveLength(2);
    expect(read('drizzle.config.ts')).toContain("url: './storage/sqlite/app.sqlite'");
  });
});

describe('moveDrizzlePaths', () => {
  it('points the ./db paths at storage/sqlite, and leaves every other line', () => {
    write('drizzle.config.ts', DRIZZLE);

    expect(moveDrizzlePaths(root)).toEqual([
      "'./db' -> './storage/sqlite'",
      "'./db/app.sqlite' -> './storage/sqlite/app.sqlite'"
    ]);

    expect(read('drizzle.config.ts')).toBe(
      DRIZZLE.replace("out: './db'", "out: './storage/sqlite'").replace(
        "url: './db/app.sqlite'",
        "url: './storage/sqlite/app.sqlite'"
      )
    );
    expect(read('drizzle.config.ts')).toContain("schema: './src/+rime.generated/schema.server.ts'");
    expect(read('drizzle.config.ts')).toContain('verbose: true');
  });

  it('patches nothing a second time', () => {
    write('drizzle.config.ts', DRIZZLE);
    moveDrizzlePaths(root);
    const once = read('drizzle.config.ts');

    expect(moveDrizzlePaths(root)).toEqual([]);
    expect(read('drizzle.config.ts')).toBe(once);
  });

  it('points every spelling of the old folder at storage/sqlite, and no other path', () => {
    write(
      'drizzle.config.ts',
      [
        "out: 'db',",
        "url: 'file:./db/app.sqlite',",
        'other: "db/app.sqlite",',
        "keep: './dbx/app.sqlite',",
        "data: './data/db.sqlite'"
      ].join('\n')
    );

    moveDrizzlePaths(root);

    expect(read('drizzle.config.ts')).toBe(
      [
        "out: 'storage/sqlite',",
        "url: 'file:./storage/sqlite/app.sqlite',",
        'other: "storage/sqlite/app.sqlite",',
        "keep: './dbx/app.sqlite',",
        "data: './data/db.sqlite'"
      ].join('\n')
    );
  });
});

describe('ignoreStorage', () => {
  it('adds /storage to a .gitignore that does not cover it', () => {
    write('.gitignore', 'node_modules\n/db\n');

    expect(ignoreStorage(root)).toBe(true);
    expect(read('.gitignore')).toBe('node_modules\n/db\n/storage\n');
    expect(ignoreStorage(root)).toBe(false);
  });

  it('leaves a .gitignore that has /storage or storage/', () => {
    for (const line of ['/storage', 'storage/']) {
      write('.gitignore', `node_modules\n${line}\n`);
      expect(ignoreStorage(root)).toBe(false);
      expect(read('.gitignore')).toBe(`node_modules\n${line}\n`);
    }
  });
});

describe('dbMove', () => {
  it('says what it changed', () => {
    oldProject();
    write('drizzle.config.ts', DRIZZLE);
    const debug = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    const cwd = process.cwd();
    process.chdir(root);
    try {
      dbMove();
    } finally {
      process.chdir(cwd);
    }
    const logged = debug.mock.calls.map(([line]) => String(line)).join('\n');
    debug.mockRestore();

    expect(logged).toContain('db/ moved to storage/sqlite/');
    expect(logged).toContain("'./db' -> './storage/sqlite'");
    expect(logged).toContain("'./db/app.sqlite' -> './storage/sqlite/app.sqlite'");
  });
});
