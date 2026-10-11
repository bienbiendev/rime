import { RIME_DEV_CACHE_DIR } from '#lib/core/constants.server.js';
import type { BuiltCollection } from '#lib/core/config/types.js';
import { sanitize } from '#lib/core/dev/codegen/sanitize/index.server.js';
import { ensureGeneratedConfig, ensureUserConfigExist } from '#lib/core/dev/ensure.server.js';
import { logger } from '#lib/core/logger.server.js';
import { UPLOADS } from '#lib/core/prototype/collection/upload/constant.js';
import { mediaFilePath } from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import type { Rime } from '#lib/core/rime.server.js';
import { trycatch, trycatchSync } from '#lib/util/function.js';
import type { Dic } from '#lib/util/types.js';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import path from 'path';

/** Where every upload collection wrote its files before each had a folder of its own. */
const SOURCE = 'static/medias';

/** What `moveUploads` reads: the upload collections, and their rows. */
type UploadsSource = {
  config: { raw: { collections: BuiltCollection[] } };
  adapter: { collection(slug: string): { findMany(): Promise<Dic[]> } };
};

/**
 * The files a raw row of an upload collection names: its own and each size's.
 *
 * ```ts
 * rowFileNames({ filename: 'a.jpg', hero: 'a-hero-800.jpg|a-hero-800.webp' }, config);
 * // ['a.jpg', 'a-hero-800.jpg', 'a-hero-800.webp']
 * ```
 */
const rowFileNames = (row: Dic, config: BuiltCollection): string[] => {
  const sizes = config.upload?.imageSizes ?? [];
  const names = [row.filename, ...sizes.flatMap((size) => String(row[size.name] ?? '').split('|'))];
  return names.filter((name): name is string => typeof name === 'string' && !!name);
};

/**
 * Moves one file of `static/medias` to the folder of each collection naming it: a file two
 * collections share is copied to the second. `false` when the file is not in `static/medias`.
 */
const moveFile = (name: string, configs: BuiltCollection[]) => {
  // Throws on a name that is not a file in the folder
  const [first, ...others] = configs.map((config) => mediaFilePath(config, name));
  const from = path.resolve(process.cwd(), SOURCE, name);
  if (!existsSync(from)) return false;

  for (const to of [first, ...others]) {
    mkdirSync(path.dirname(to), { recursive: true });
  }
  renameSync(from, first);
  for (const to of others) {
    copyFileSync(first, to);
  }
  return true;
};

/**
 * Moves each file a row of an upload collection names, every version's included, with its image
 * sizes, from `static/medias/<file>` to `storage/uploads/<folder>/<file>`. A file already gone
 * from `static/medias` is skipped, so a second run moves nothing.
 *
 * Answers how many files moved, and the files of `static/medias` no row names, left in place.
 */
export const moveUploads = async (rime: UploadsSource) => {
  // Each file a row names, and the collections whose rows name it
  const owners = new Map<string, Set<BuiltCollection>>();
  for (const config of rime.config.raw.collections) {
    if (!config.upload || config._shadowOf) continue;

    // The rows holding `filename`: the versions table's on a versioned collection
    const rows = await rime.adapter.collection(config._versions?.slug ?? config.slug).findMany();
    for (const name of rows.flatMap((row) => rowFileNames(row, config))) {
      owners.set(name, new Set([...(owners.get(name) ?? []), config]));
    }
  }

  let moved = 0;
  for (const [name, configs] of owners) {
    const [error, done] = trycatchSync(() => moveFile(name, [...configs]));
    if (error) {
      logger.error(error);
    } else if (done) {
      moved++;
    }
  }

  const source = path.resolve(process.cwd(), SOURCE);
  const unreferenced = existsSync(source)
    ? readdirSync(source, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !owners.has(entry.name))
        .map((entry) => entry.name)
    : [];

  return { moved, unreferenced };
};

/**
 * `rime uploads:move`: loads the project's config, then `moveUploads`.
 *
 * Run once, on a project whose files were all written to `static/medias`.
 */
export const uploadsMove = async () => {
  async function run() {
    // A CLI run, as `rime generate` marks itself: the bin runs on Node, so a config on the bun
    // driver opens its database with libsql (adapter-sqlite/connect.server.ts)
    process.env.RIME_CLI = 'true';
    ensureUserConfigExist();
    await sanitize();

    const { createServer } = await import('vite');
    // The same throwaway server as `rime generate`, with a cache of its own
    const vite = await createServer({
      configFile: path.join(process.cwd(), 'vite.config.ts'),
      cacheDir: path.join(RIME_DEV_CACHE_DIR, 'vite'),
      server: { hmr: false, middlewareMode: true, watch: { ignored: ['**'] } },
      optimizeDeps: { disabled: true },
      appType: 'custom',
      logLevel: 'error'
    });

    try {
      const mod = await vite.ssrLoadModule(ensureGeneratedConfig());
      // The generated config's default export is the createRime() promise
      const rime: Rime = await mod.default;

      const { moved, unreferenced } = await moveUploads(rime);
      logger.debug(`[✓] ${moved} files moved from ${SOURCE} to ${UPLOADS.DIRECTORY}/<folder>`);
      if (unreferenced.length) {
        logger.warn(`No row names these files, left in ${SOURCE}:\n${unreferenced.join('\n')}`);
      }
    } finally {
      await vite.close();
    }
  }

  const [error] = await trycatch(run);

  if (error) {
    logger.error('[✗] Error while moving the uploads:', error);
    throw error;
  }
};
