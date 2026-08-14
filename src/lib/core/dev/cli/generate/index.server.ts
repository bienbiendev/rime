import { RIME_DEV_CACHE_DIR } from '$lib/core/constant.server';
import cache from '$lib/core/dev/cache/index.server.js';
import { sanitize } from '$lib/core/dev/generate/sanitize/index.server.js';
import { ensureGeneratedConfig, ensureUserConfigExist } from '$lib/core/ensure.server.js';
import { logger } from '$lib/core/logger/index.server.js';
import { trycatch } from '$lib/util/function.js';
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
   * Sanitize the user config and create the config.generated folder
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
      server: {
        hmr: false,
        middlewareMode: true
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
    // Mark that a CLI generation is in flight, so a concurrently running dev
    // server doesn't race us on the shared .rime cache (see rime.server.ts).
    process.env.RIME_CLI = 'true';
    cache.set('.cli', new Date().toISOString());
    try {
      ensureUserConfigExist();
      await sanitizeConfig();
      const importPathJS = ensureGeneratedConfig();

      logger.info('Starting vite server...');
      const vite = await createServer();
      try {
        const mod = await vite.ssrLoadModule(importPathJS);
        // The generated config's default export is the createRime() promise;
        // ssrLoadModule only awaits the module's synchronous evaluation, so we
        // must await it directly to observe init failures (e.g. config validation).
        await mod.default;
        logger.info('[✓] Generation completed successfully');
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
