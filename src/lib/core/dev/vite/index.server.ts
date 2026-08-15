import dotenv from 'dotenv';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { RIME_DEV_CACHE_DIR } from '../../constant.server.js';
import { ensureHasInit } from '../../ensure.server.js';
import { logger } from '../../logger/index.server.js';
import { INPUT_DIR, OUTPUT_DIR } from '../constants.js';
import { sanitize } from '../generate/sanitize/index.server.js';

dotenv.config({ override: true });
const dev = process.env.NODE_ENV === 'development';

export function rime(): Plugin {
  const VCoreId = '$rime/config';
  const VSchemaId = '$rime/schema';
  /** General-purpose server/browser split, usable anywhere in the app (not just rime's own
   *  field code — see relation/index.ts for the first user). `import { x } from '$rime/runtime'`
   *  resolves to a sibling `server.ts` (server builds) or `browser.ts` (browser builds) next
   *  to whichever file does the importing — the importer's path travels encoded in the
   *  resolved id since `load()` only receives the id, not the importer. */
  const VRuntimeId = '$rime/runtime';
  const VRuntimeMarker = `\0${VRuntimeId}::`;

  const resolvedVModule = (name: string) => '\0' + name;

  return {
    name: 'virtual-rime',

    configureServer(server) {
      // Add a listener for when the server starts
      server.httpServer?.once('listening', () => {
        dev && ensureHasInit();
        // Check if we need to rebuild
        const shouldRebuild = process.argv.includes('--rebuild');

        if (shouldRebuild && existsSync(RIME_DEV_CACHE_DIR)) {
          rmSync(RIME_DEV_CACHE_DIR, { recursive: true, force: true });
          logger.info('--rebuild : node_modules/.rime folder deleted');
        }
      });

      // Add a watcher for sanitizing config changes
      // and trigger schema/routes/types generation
      server.watcher.on('change', async (modulePath) => {
        if (
          modulePath.includes(`src/lib/${INPUT_DIR}`) &&
          !modulePath.includes(`src/lib/${OUTPUT_DIR}`)
        ) {
          // Sanitize the config client/server
          try {
            await sanitize();
          } catch (error: any) {
            logger.error('Error while sanitizing config:', error.message);
            return;
          }
          // Trigger generation
          try {
            const mod = await server.ssrLoadModule(`src/lib/${OUTPUT_DIR}/rime.config.server.ts`);
            // The config's default export is the createRime() promise; ssrLoadModule
            // only awaits the module's synchronous evaluation, so we must await it
            // directly to observe init errors (e.g. invalid config) here instead of
            // letting them become unhandled rejections that crash the dev server.
            await mod.default;
          } catch (error: any) {
            logger.error('Failed to reload the config', error.message);
          }
        }
      });
    },

    config(): UserConfig {
      return {
        ssr: {
          external: ['sharp']
        },
        optimizeDeps: {
          exclude: ['sharp'],
          include: ['@lucide/svelte']
        },
        build: {
          rollupOptions: {
            external: ['sharp']
          },
          target: 'es2022'
        }
      };
    },

    async handleHotUpdate({ server, file }) {
      function invalidateVModule(moduleId: string) {
        const module = server.moduleGraph.getModuleById(resolvedVModule(moduleId));
        if (module) {
          server.moduleGraph.invalidateModule(module);
          return module;
        }
        return null;
      }

      if (process.env.IS_PACKAGE_DEV && file.includes('src/lib/core/config')) {
        logger.info('reload core config');
        const module = invalidateVModule(VCoreId);
        if (module) return [module];
      }
    },

    resolveId(id, importer) {
      if (id === VCoreId) {
        return resolvedVModule(id);
      }
      if (id === VSchemaId) {
        return resolvedVModule(id);
      }
      if (id === VRuntimeId && importer) {
        return `${VRuntimeMarker}${importer}`;
      }

      return null;
    },

    load(id) {
      const isServer = this.environment?.config?.consumer === 'server';

      if (id === resolvedVModule(VCoreId)) {
        const corePath = isServer ? 'rimecms/config/server' : 'rimecms/config';
        return `export * from '${corePath}';`;
      }

      if (id === resolvedVModule(VSchemaId) && isServer) {
        const schemaPath = path.resolve(process.cwd(), `src/lib/${OUTPUT_DIR}/schema.server.ts`);
        if (existsSync(schemaPath)) {
          const modulePath = schemaPath.replace('.ts', '.js');
          return `export * from '${modulePath}'; export { default } from '${modulePath}';`;
        }
      }

      if (id.startsWith(VRuntimeMarker)) {
        const importer = id.slice(VRuntimeMarker.length);
        const dir = path.dirname(importer);
        const target = path.join(dir, isServer ? 'runtime.server.ts' : 'runtime.ts');
        return `export * from '${target.replace(/\.ts$/, '.js')}';`;
      }

      return null;
    }
  };
}
