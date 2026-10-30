import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '#lib/core/logger.server.js';
import { build } from './build.js';

// `vite build` leaves its output in ./build
vi.mock('child_process', async () => {
  const { mkdirSync } = await import('node:fs');
  return {
    spawnSync: vi.fn(() => {
      mkdirSync('./build', { recursive: true });
      return { status: 0 };
    })
  };
});
vi.mock('../util/package.server.js', () => ({ usesBunScripts: () => false }));
vi.mock('../util/package-manager.server.js', () => ({ getInvokingPackageManager: () => 'npm' }));
// A .rime cache of its own, with no adapter recorded: the default one, sqlite, is asked
vi.mock('#lib/core/constants.server.js', async (original) => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const cache = join(mkdtempSync(join(tmpdir(), 'rime-build-cache-')), '.rime');
  return { ...(await original<object>()), RIME_DEV_CACHE_DIR: cache };
});

/** A project with a static folder, a database and an upload, as the build sees it. */
let root: string;
const cwd = process.cwd();
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rime-build-'));
  const write = (file: string) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), file);
  };
  write('package.json');
  write('drizzle.config.ts');
  write('static/favicon.png');
  write('storage/sqlite/app.sqlite');
  write('storage/uploads/medias/photo.jpg');
  process.chdir(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  process.chdir(cwd);
  process.exitCode = undefined;
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const exists = (file: string) => existsSync(join(root, file));

describe('rime build', () => {
  it('copies storage/, the database and the uploads, with --with-storage', async () => {
    await build({ withStorage: true });

    expect(exists('app/storage/sqlite/app.sqlite')).toBe(true);
    expect(exists('app/storage/uploads/medias/photo.jpg')).toBe(true);
    expect(exists('app/static')).toBe(false);
  });

  it('copies static/ alone with --with-static', async () => {
    await build({ withStatic: true });

    expect(exists('app/static/favicon.png')).toBe(true);
    expect(exists('app/storage')).toBe(false);
  });

  it('packs the app with no static/, with --with-static', async () => {
    rmSync(join(root, 'static'), { recursive: true });
    vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await build({ withStatic: true });

    expect(exists('app/index.js')).toBe(true);
    expect(exists('app/static')).toBe(false);
  });

  it('packs nothing when the adapter writes no ./build', async () => {
    vi.mocked(spawnSync).mockImplementationOnce(() => ({ status: 0 }) as never);
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    await build({});

    expect(process.exitCode).toBe(1);
    expect(exists('app')).toBe(false);
  });

  it.each([
    [
      'keeps its database in db/',
      () => {
        rmSync(join(root, 'storage/sqlite'), { recursive: true });
        mkdirSync(join(root, 'db'));
      }
    ],
    [
      'has a drizzle.config.ts that still names db/',
      () => {
        writeFileSync(join(root, 'drizzle.config.ts'), "export default { out: './db' };\n");
      }
    ]
  ])('refuses --with-storage, naming rime db:move, when the project %s', async (_, setUp) => {
    setUp();
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    await build({ withStorage: true });

    expect(exists('app')).toBe(false);
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('rime db:move'));
  });
});
