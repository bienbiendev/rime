import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RIME_DEV_CACHE_DIR } from '#lib/core/constants.server.js';
import { logger } from '#lib/core/logger.server.js';
import { CONFIG_DIR, GENERATED_DIR } from '../../constants.server.js';
import { importAdapterHooks } from '../util/adapter-hooks.server.js';
import { clear } from './clear.server.js';

// A temporary project, whose .rime cache this is: the real one under node_modules is not touched
vi.mock('#lib/core/constants.server.js', async (original) => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'rime-clear-'));
  return { ...(await original<object>()), RIME_DEV_CACHE_DIR: join(root, 'node_modules/.rime') };
});
vi.mock('../util/adapter-hooks.server.js', async (original) => ({
  ...(await original<object>()),
  importAdapterHooks: vi.fn()
}));

/** The temporary project's root, two levels above its cache. */
const root = dirname(dirname(RIME_DEV_CACHE_DIR));
const cwd = process.cwd();
const exists = (file: string) => existsSync(join(root, file));
const write = (file: string, content = '') => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
};

/** What core removes, and what the SQLite adapter owns, as `rime init` and a boot leave them. */
beforeEach(() => {
  write('src/routes/(rime)/+layout.svelte');
  write(`${CONFIG_DIR}/rime.config.server.ts`);
  write(`${GENERATED_DIR}/schema.server.ts`);
  write('src/hooks.server.ts');
  write('src/app.generated.d.ts');
  write('storage/uploads/medias/photo.jpg');
  write('storage/sqlite/app.sqlite');
  write('drizzle.config.ts');
  process.chdir(root);
});
afterEach(() => {
  process.chdir(cwd);
  vi.restoreAllMocks();
  vi.mocked(importAdapterHooks).mockReset();
});

const coreRemoved = () => {
  for (const file of [
    'node_modules/.rime',
    'src/routes/(rime)',
    CONFIG_DIR,
    GENERATED_DIR,
    'src/hooks.server.ts',
    'src/app.generated.d.ts',
    'storage/uploads'
  ]) {
    expect(exists(file), file).toBe(false);
  }
};

describe('rime clear', () => {
  it("runs the recorded adapter's clear while the record is still there, then removes core's paths", async () => {
    write('node_modules/.rime/adapter-hooks.txt', 'rimecms/adapter-sqlite/hooks');
    let recordAtClear = false;
    vi.mocked(importAdapterHooks).mockResolvedValue({
      clear: async () => {
        recordAtClear = exists('node_modules/.rime/adapter-hooks.txt');
        rmSync(join(root, 'storage/sqlite'), { recursive: true });
        rmSync(join(root, 'drizzle.config.ts'));
        return ['storage/sqlite', 'drizzle.config.ts'];
      }
    } as never);

    await clear({ force: true });

    expect(importAdapterHooks).toHaveBeenCalledWith('rimecms/adapter-sqlite/hooks');
    expect(recordAtClear).toBe(true);
    expect(exists('storage/sqlite')).toBe(false);
    coreRemoved();
  });

  it('asks the default adapter, sqlite, with no record, as after a fresh install', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const adapterClear = vi.fn(async () => ['storage/sqlite', 'drizzle.config.ts']);
    vi.mocked(importAdapterHooks).mockResolvedValue({ clear: adapterClear } as never);

    await clear({ force: true });

    expect(importAdapterHooks).toHaveBeenCalledWith('rimecms/adapter-sqlite/hooks');
    expect(adapterClear).toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    coreRemoved();
  });

  it("removes core's paths, and warns that the adapter's files are left, when the module does not import", async () => {
    write('node_modules/.rime/adapter-hooks.txt', '@acme/gone/hooks');
    vi.mocked(importAdapterHooks).mockRejectedValue(new Error('Cannot find module'));
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await clear({ force: true });

    coreRemoved();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("The database adapter's files are left: Cannot find module")
    );
  });
});
