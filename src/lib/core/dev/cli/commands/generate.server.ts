import { RIME_DEV_CACHE_DIR } from '#lib/core/constants.server.js';
import cache from '#lib/core/dev/cache.server.js';
import { sanitize } from '#lib/core/dev/codegen/sanitize/index.server.js';
import { ensureGeneratedConfig, ensureUserConfigExist } from '#lib/core/dev/ensure.server.js';
import { regenerateModulesDeclaration } from '#lib/core/dev/vite.server.js';
import { logger } from '#lib/core/logger.server.js';
import { trycatch } from '#lib/util/function.js';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';

export const generate = async (args: { force?: boolean }) => {
  const { force } = args;

  /**
   * Clear the cached .rime folder
   */
  function clearConfigCache() {
    try {
      rmSync(RIME_DEV_CACHE_DIR, { recursive: true, force: true });
      mkdirSync(RIME_DEV_CACHE_DIR);
    } catch (err: any) {
      logger.error(err.message);
    }
  }

  /*
   * Delete routes/(rime) folder
   */
  function clearRoutes() {
    try {
      rmSync(path.join(process.cwd(), 'src', 'routes', '(rime)'), { recursive: true, force: true });
    } catch (err: any) {
      logger.error(err.message);
    }
  }

  /**
   * Sanitize the user config into GENERATED_DIR (`src/+rime.generated` by default)
   */
  async function sanitizeConfig() {
    await sanitize();
  }

  /**
   * Create the vite devServer
   */
  async function createServer() {
    const { createServer } = await import('vite');

    // Create a Vite server using the project's vite.config.ts
    const vite = await createServer({
      configFile: path.join(process.cwd(), 'vite.config.ts'),
      // A cache of its own: this server runs with hmr off, and in `node_modules/.vite` that
      // setting would make the next `vite dev` see a changed config and rebuild every dependency
      cacheDir: path.join(RIME_DEV_CACHE_DIR, 'vite'),
      server: {
        hmr: false,
        middlewareMode: true,
        // One run, nothing to reload: the files codegen writes must not reach SvelteKit's watcher
        watch: { ignored: ['**'] }
      },
      optimizeDeps: { disabled: true },
      appType: 'custom',
      logLevel: 'error'
    });
    return vite;
  }

  async function run() {
    if (force) {
      clearConfigCache();
      clearRoutes();
    }
    // Mark that a CLI generation is in flight, so a running dev server leaves the .rime cache to
    // it (see core/codegen.server.ts). The marker holds this process's id and the time it started:
    // a marker left by a process that died blocks nothing, and one older than ten minutes is
    // ignored even when another process has taken that id.
    process.env.RIME_CLI = 'true';
    cache.set('.cli', `${process.pid} ${Date.now()}`);
    try {
      ensureUserConfigExist();
      await sanitizeConfig();
      // Normal `vite dev` writes this from `configureServer`'s `listening` event, which never
      // fires here — this command's own Vite server runs in `middlewareMode` (no `httpServer`).
      regenerateModulesDeclaration();
      const importPathJS = ensureGeneratedConfig();

      logger.debug('Starting vite server...');
      const vite = await createServer();
      try {
        const mod = await vite.ssrLoadModule(importPathJS);
        // The generated config's default export is the createRime() promise;
        // ssrLoadModule only awaits the module's synchronous evaluation, so we
        // must await it directly to observe init failures (e.g. config validation).
        await mod.default;
        logger.debug('[✓] Generation completed successfully');
      } finally {
        await vite.close();
      }
    } finally {
      cache.delete('.cli');
    }
  }

  const [error] = await trycatch(run);

  if (error) {
    logger.error('[✗] Error during generation:', error);
    throw error;
  }
};
