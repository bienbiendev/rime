import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import devCache from '#lib/core/dev/cache.server.js';
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

/** The config folder of every test project; src/cms is missing. */
const CONFIG_DIR = 'src/cms/config';

const cwd = process.cwd();
let root: string;
afterEach(() => {
  process.chdir(cwd);
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/**
 * A fresh SvelteKit project with an empty `src/`, plus `files`, made the current directory.
 * Returns `init` loaded from there, as it reads the project root and RIME_CONFIG_DIR when it loads.
 */
async function project(files: Record<string, string> = {}) {
  root = mkdtempSync(join(tmpdir(), 'rime-init-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'shop' }));
  writeFileSync(
    join(root, 'vite.config.ts'),
    "import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vite';\n\nexport default defineConfig({\n  plugins: [sveltekit()]\n});\n"
  );
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }
  process.chdir(root);
  vi.stubEnv('RIME_CONFIG_DIR', CONFIG_DIR);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(importAdapterHooks).mockResolvedValue({ init: async () => ADAPTER_INIT } as never);
  vi.resetModules();
  return (await import('./init.server.js')).init;
}

describe('rime init --adapter', () => {
  it('records the hooks module, then writes the starter config and the install from its answer', async () => {
    const init = await project();
    const adapterInit = vi.fn(async () => ADAPTER_INIT);
    vi.mocked(importAdapterHooks).mockResolvedValue({ init: adapterInit } as never);

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

describe('rime init', () => {
  it('writes the config in a folder whose parents are missing', async () => {
    const init = await project();
    await init({ name: 'shop' });
    expect(existsSync(join(root, CONFIG_DIR, 'rime.config.server.ts'))).toBe(true);
  });

  it('ignores every declaration file rime generates', async () => {
    const init = await project({ '.gitignore': 'node_modules\n' });
    await init({ name: 'shop' });

    const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    expect(lines).toContain('src/app.generated.d.ts');
    expect(lines).toContain('src/rime.generated.d.ts');
    expect(lines).toContain('src/rime.modules.generated.d.ts');
  });

  it('adds an entry that a longer line starts with, and never one already there', async () => {
    const init = await project({ '.gitignore': '/storage-backup\n.cache-loader\n/logs\n' });
    await init({ name: 'shop' });

    const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n');
    expect(lines.filter((line) => line === '/storage')).toHaveLength(1);
    expect(lines.filter((line) => line === '.cache')).toHaveLength(1);
    expect(lines.filter((line) => line === '/logs')).toHaveLength(1);
  });
});
