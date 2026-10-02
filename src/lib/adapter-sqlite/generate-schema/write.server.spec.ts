import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const spawnSync = vi.fn();
vi.mock('node:child_process', () => ({ spawnSync: (...args: unknown[]) => spawnSync(...args) }));

const cache = { matches: vi.fn(() => false), remember: vi.fn(), delete: vi.fn() };
vi.mock('$lib/core/dev/cache.server.js', () => ({ default: cache }));
vi.mock('$lib/core/dev/cli/util/package-manager.server.js', () => ({
  getPackageManager: () => 'bun'
}));

let cwd: string;
vi.mock('$lib/core/dev/constants.server.js', () => ({
  schemaPath: () => path.join(cwd, 'src/+rime.generated/schema.server.ts')
}));

const { default: write, dataLoss, confirm } = await import('./write.server.js');

/** The SQL of 20261001201736_noisy_purple_man, which dropped a site's news and relations. */
const NOISY_PURPLE_MAN = [
  'ALTER TABLE `pages__$blocks_card` ADD `image` text;',
  'DROP INDEX IF EXISTS `news_updated_at_idx`;',
  'DROP TABLE `news`;',
  'DROP TABLE `pages__$relations`;',
  'ALTER TABLE `pages` DROP COLUMN `hero__summary`;'
].join('--> statement-breakpoint\n');

/** How drizzle-kit changes a column SQLite cannot alter in place: the rows are copied over. */
const REBUILD = [
  'PRAGMA foreign_keys=OFF;',
  'CREATE TABLE `__new_pages` (`id` text PRIMARY KEY, `title` text NOT NULL);',
  'INSERT INTO `__new_pages`(`id`, `title`) SELECT `id`, `title` FROM `pages`;',
  'DROP TABLE `pages`;',
  'ALTER TABLE `__new_pages` RENAME TO `pages`;',
  'PRAGMA foreign_keys=ON;'
].join('--> statement-breakpoint\n');

describe('dataLoss', () => {
  test('lists the dropped tables and columns', () => {
    expect(dataLoss(NOISY_PURPLE_MAN)).toEqual([
      'DROP TABLE `news`;',
      'DROP TABLE `pages__$relations`;',
      'ALTER TABLE `pages` DROP COLUMN `hero__summary`;'
    ]);
  });

  test('a table rebuilt to change a column loses nothing', () => {
    expect(dataLoss(REBUILD)).toEqual([]);
  });

  test('additions and indexes lose nothing', () => {
    expect(dataLoss('CREATE TABLE `infos` (`id` text);\nDROP INDEX IF EXISTS `a_idx`;')).toEqual(
      []
    );
  });
});

describe('confirm', () => {
  test('without a terminal the answer is no, and nothing is asked', () => {
    const isTTY = process.stdin.isTTY;
    process.stdin.isTTY = false as any;
    try {
      expect(confirm('Continue? [y/N] ')).toBe(false);
      expect(spawnSync).not.toHaveBeenCalled();
    } finally {
      process.stdin.isTTY = isTTY;
    }
  });
});

describe('write', () => {
  const migrations = () => fs.readdirSync(path.join(cwd, 'db'));
  const schemaFile = () => path.join(cwd, 'src/+rime.generated/schema.server.ts');
  let isTTY: boolean;

  /** `drizzle-kit generate` writes `sql` as a new migration; `migrate` is only recorded. */
  const drizzleWrites = (sql: string) =>
    spawnSync.mockImplementation((_command: string, args: string[]) => {
      if (args[1] === 'generate') {
        const dir = path.join(cwd, 'db', '20261001201736_noisy_purple_man');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'migration.sql'), sql);
      }
      return { status: 0 };
    });

  const ran = (step: string) => spawnSync.mock.calls.some(([, args]) => args[1] === step);

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(tmpdir(), 'rime-write-'));
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    fs.mkdirSync(path.join(cwd, 'db', '20260930000000_first'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'db', '20260930000000_first', 'migration.sql'), '');
    fs.mkdirSync(path.dirname(schemaFile()), { recursive: true });
    fs.writeFileSync(schemaFile(), 'the schema before');
    isTTY = process.stdin.isTTY;
    process.stdin.isTTY = false as any;
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.stdin.isTTY = isTTY;
    vi.restoreAllMocks();
    spawnSync.mockReset();
    cache.remember.mockClear();
    cache.delete.mockClear();
  });

  test('a migration that loses data, refused, leaves db/ and the schema as they were', () => {
    drizzleWrites(NOISY_PURPLE_MAN);

    expect(() => write('the new schema')).toThrow(/Migration cancelled/);

    expect(ran('migrate')).toBe(false);
    expect(migrations()).toEqual(['20260930000000_first']);
    expect(fs.readFileSync(schemaFile(), 'utf8')).toBe('the schema before');
    // asked again on the next boot, not taken as generated
    expect(cache.delete).toHaveBeenCalledWith('config');
    expect(cache.remember).not.toHaveBeenCalled();
  });

  test('a migration that loses nothing is applied without a question', () => {
    drizzleWrites('ALTER TABLE `pages` ADD `subtitle` text;');

    write('the new schema');

    expect(ran('migrate')).toBe(true);
    expect(fs.readFileSync(schemaFile(), 'utf8')).toBe('the new schema');
    expect(cache.remember).toHaveBeenCalledWith('schema', expect.any(String));
  });

  test('a yes applies the migration as generated', () => {
    process.stdin.isTTY = true as any;
    // The prompt answers yes; drizzle-kit itself succeeds.
    spawnSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === '-e') return { status: 0 };
      if (args[1] === 'generate') {
        const dir = path.join(cwd, 'db', '20261001201736_noisy_purple_man');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'migration.sql'), NOISY_PURPLE_MAN);
      }
      return { status: 0 };
    });

    write('the new schema');

    expect(ran('migrate')).toBe(true);
    expect(migrations()).toContain('20261001201736_noisy_purple_man');
  });
});
