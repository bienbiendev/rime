import type { AdapterHooks } from '#lib/core/adapter.js';
import devCache from '#lib/core/dev/cache.server.js';

/** The adapter `rime init` sets up when `--adapter` names none, and `rime clear` asks with no record. */
export const DEFAULT_ADAPTER = 'sqlite';

/** `--adapter` as a hooks module: `sqlite` is rime's own, any other name a package's `<name>/hooks`. */
export const adapterHooksModule = (name: string) =>
  name === 'sqlite' ? 'rimecms/adapter-sqlite/hooks' : `${name}/hooks`;

/**
 * Imports the hooks a module specifier names. Rime's own come from the source through `#lib`: in
 * this repo `rimecms/...` resolves to `dist/`.
 */
export const importAdapterHooks = (specifier: string): Promise<AdapterHooks> =>
  (specifier === 'rimecms/adapter-sqlite/hooks'
    ? import('#lib/adapter-sqlite/hooks.server.js')
    : import(/* @vite-ignore */ specifier)
  ).then((m) => m.hooks);

/**
 * The hooks module of this project's adapter: the one `rime init` or the last dev boot recorded in
 * `node_modules/.rime`, else the default adapter's, as after a fresh install.
 */
export const recordedHooksModule = () =>
  devCache.get('adapter-hooks') || adapterHooksModule(DEFAULT_ADAPTER);
