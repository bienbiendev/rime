import cache from '$lib/core/dev/cache/index.js';
import { sanitize } from '$lib/core/dev/generate/sanitize/index.js';
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
      rmSync(path.join(process.cwd(), '.rime'), { recursive: true, force: true });
      mkdirSync(path.join(process.cwd(), '.rime'));
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
    ensureUserConfigExist();
    await sanitizeConfig();
    const importPathJS = ensureGeneratedConfig();

    logger.info('Generate');
    const vite = await createServer();
    await vite.ssrLoadModule(importPathJS);

    while (cache.get('.init')) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await vite.close();
    logger.info('[✓] Generation completed successfully');
  }

  const [error] = await trycatch(run);

  if (error) {
    logger.error('Error during generation:', error);
    throw error;
  }
};
