import dotenv from 'dotenv';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { RIME_DEV_CACHE_DIR } from '../../constant.server.js';
import { ensureHasInit } from '../../ensure.server.js';
import { logger } from '../../logger/index.server.js';
import { INPUT_DIR, isInstalledDependency, OUTPUT_DIR } from '../constants.js';
import { buildRuntimeRegistry, type RuntimeRegistry } from '../generate/runtime/index.server.js';
import { sanitize } from '../generate/sanitize/index.server.js';

dotenv.config({ override: true });
const dev = process.env.NODE_ENV === 'development';

export function rime(): Plugin {
  const VCoreId = '$rime/config';
  const VSchemaId = '$rime/schema';
  /** Any field's client/server split: rime's own (relation/index.ts, link/index.ts) and a
   *  consumer app's own local fields alike. `import { x } from '$rime/<name>'` resolves `<name>`
   *  against a registry built once (see generate/runtime/index.server.ts's buildRuntimeRegistry,
   *  which scans for `<name>/module.ts` + `module.server.ts` pairs) to either `module.server.ts`
   *  (server builds) or `module.ts` (browser builds). The specifier is a static string baked into
   *  the source, so it survives esbuild's dep-optimizer flattening — unlike an importer-relative
   *  lookup, which breaks the moment the importing file gets pre-bundled (importer becomes the
   *  flattened chunk, not the real source file). `config` and `schema` are reserved names (see
   *  VCoreId/VSchemaId below, checked first) — a field can't be registered under either. */
  const VPrefix = '$rime/';

  const resolvedVModule = (name: string) => '\0' + name;

  let runtimeRegistry: RuntimeRegistry | null = null;
  const getRuntimeRegistry = () => (runtimeRegistry ??= buildRuntimeRegistry());

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
        },
        server: {
          watch: {
            // db/*.sqlite (+ its -wal/-shm sidecars) and logs/ are runtime data, not source —
            // every write (e.g. saving a document) touches them, and without this Vite's default
            // whole-project-root watch treats that churn as a source change and force-reloads.
            ignored: ['**/db/**', '**/logs/**']
          }
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

      if (!isInstalledDependency(import.meta.url) && file.includes('src/lib/core/config')) {
        logger.info('reload core config');
        const module = invalidateVModule(VCoreId);
        if (module) return [module];
      }
    },

    resolveId(id) {
      if (id === VCoreId) {
        return resolvedVModule(id);
      }
      if (id === VSchemaId) {
        return resolvedVModule(id);
      }
      if (id.startsWith(VPrefix)) {
        const name = id.slice(VPrefix.length);
        // Unregistered name: return null so it surfaces as a normal "failed to resolve
        // import" error instead of a silent virtual-module 404.
        if (!getRuntimeRegistry().has(name)) return null;
        return resolvedVModule(id);
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

      if (id.startsWith(resolvedVModule(VPrefix))) {
        const name = id.slice(resolvedVModule(VPrefix).length);
        const entry = getRuntimeRegistry().get(name);
        if (entry) {
          const target = (isServer ? entry.server : entry.client).replace(/\.ts$/, '.js');
          return `export * from '${target}';`;
        }
      }

      return null;
    }
  };
}
