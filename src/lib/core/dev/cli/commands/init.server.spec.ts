import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import devCache from '#lib/core/dev/cache.server.js';
import { CONFIG_DIR } from '../../constants.server.js';
import { importAdapterHooks } from '../util/adapter-hooks.server.js';
import { installDependencies } from '../util/package-manager.server.js';

vi.mock('#lib/core/dev/cache.server.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));
vi.mock('../util/adapter-hooks.server.js', async (original) => ({
  ...(await original<object>()),
  importAdapterHooks: vi.fn()
}));
vi.mock('../util/package-manager.server.js', async (original) => ({
  ...(await original<object>()),
  installDependencies: vi.fn()
}));
vi.mock('./generate.server.js', () => ({ generate: vi.fn(async () => {}) }));

/** What a third-party adapter's `init` answers. */
const ADAPTER_INIT = {
  config: { import: "import { postgres } from '@acme/rime-postgres';", call: "postgres('shop')" },
  dependencies: ['@acme/rime-postgres', 'pg'],
  devDependencies: ['@types/pg']
};

const cwd = process.cwd();
let root: string;
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('rime init --adapter', () => {
  it('records the hooks module, then writes the starter config and the install from its answer', async () => {
    // A fresh SvelteKit project, the current directory when init loads
    root = mkdtempSync(join(tmpdir(), 'rime-init-'));
    // The parent of the config folder, `src/lib` in this repo
    mkdirSync(join(root, CONFIG_DIR, '..'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'shop' }));
    writeFileSync(
      join(root, 'vite.config.ts'),
      "import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({\n  plugins: [sveltekit()]\n});\n"
    );
    process.chdir(root);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapterInit = vi.fn(async () => ADAPTER_INIT);
    vi.mocked(importAdapterHooks).mockResolvedValue({ init: adapterInit } as never);

    const { init } = await import('./init.server.js');
    await init({ name: 'shop', adapter: '@acme/rime-postgres' });

    expect(devCache.set).toHaveBeenCalledWith('adapter-hooks', '@acme/rime-postgres/hooks');
    expect(importAdapterHooks).toHaveBeenCalledWith('@acme/rime-postgres/hooks');
    expect(vi.mocked(devCache.set).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(importAdapterHooks).mock.invocationCallOrder[0]
    );
    expect(adapterInit).toHaveBeenCalledWith({ name: 'shop', bun: false });

    const config = readFileSync(join(root, CONFIG_DIR, 'rime.config.server.ts'), 'utf8');
    expect(config).toContain(ADAPTER_INIT.config.import);
    expect(config).toContain("$adapter: postgres('shop'),");
    expect(config).not.toContain('adapterSqlite');
    expect(installDependencies).toHaveBeenCalledWith(ADAPTER_INIT);
    // static/ is the app's alone: the panel fonts come from the package
    expect(existsSync(join(root, 'static'))).toBe(false);
  });
});
