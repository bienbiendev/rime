import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { IS_RIME_REPO, RIME_DEV_CACHE_DIR } from '../constants.server.js';
import { logger } from '../logger.server.js';
import { findModulePair, scanModulePairs } from './codegen/runtime/index.server.js';
import { parseExportNames } from './codegen/runtime/parse-exports.server.js';
import { sanitize } from './codegen/sanitize/index.server.js';
import {
  CONFIG_DIR,
  GENERATED_DIR,
  generatedConfigServerPath,
  schemaPath
} from './constants.server.js';
import { ensureHasInit } from './ensure.server.js';

const dev = process.env.NODE_ENV === 'development';

export function regenerateModulesDeclaration() {
  const libDir = path.resolve(process.cwd(), 'src/lib');
  const blocks = Array.from(scanModulePairs(libDir))
    .map(([subpath, entry]) => {
      // The server half where there is one: a pair's two halves share their export names, and a
      // name only one side declares is always the server's (`uploadHooks`, and every other piece
      // a browser has no use for).
      const file = entry.server || entry.client;
      if (!file) return null;
      const aliased = `$lib/${path.relative(libDir, file).split(path.sep).join('/')}`.replace(
        /\.ts$/,
        '.js'
      );
      return `declare module '$rime/modules:${subpath}' {\n  export * from '${aliased}';\n}`;
    })
    .filter((block) => block !== null)
    .join('\n\n');

  writeFileSync(path.resolve(process.cwd(), 'src/rime.modules.generated.d.ts'), `${blocks}\n`);
}

export function rime(): Plugin {
  /** Two reserved names, always resolved to *the currently running app's* generated
   *  config/schema, independent of who's asking — a third-party plugin importing
   *  `$rime/config` gets the host app's config, never its own. Unrelated to the modules
   *  mechanism below (a package's own client/server split): different problem, same `$rime/`
   *  namespace only by convention. */
  const VCoreId = '$rime/config';
  const VSchemaId = '$rime/schema';

  /**
   * `$rime/modules:<path>` picks the client or server half of one module pair.
   *
   * ```ts
   * import { augmentAuth } from '$rime/modules:core/auth';   // rooted at src/lib
   * import { Boooz }       from '$rime/modules:../nested';   // relative to the importer
   * import { populate }    from '$rime/modules:.';           // the importer's own folder
   * ```
   *
   * The path is part of the specifier, so a name is unique per pair rather than per package, and
   * a name the pair does not export is an error at that path instead of `undefined` at link time.
   *
   * This hook only ever answers for *this* project's own `src/lib`. A dependency's halves were
   * rewritten to real package subpaths by its own prepack, so nothing here crosses into
   * `node_modules` — which is what used to put a raw file path in the browser's module graph
   * (see docs/isomorphic-module.md).
   */
  const VModulesPrefix = '$rime/modules:';
  const libDir = () => path.resolve(process.cwd(), 'src/lib');

  /** `$rime/modules:<path>` -> the pair's subpath under src/lib, or null if it names nothing. */
  const subpathOf = (id: string, importer: string | undefined) => {
    const spec = id.slice(VModulesPrefix.length);
    const base = spec.startsWith('.')
      ? path.resolve(path.dirname(importer ?? libDir()), spec)
      : path.resolve(libDir(), spec);
    return path.relative(libDir(), base).split(path.sep).join('/');
  };

  const resolvedVModule = (name: string) => '\0' + name;

  return {
    name: 'virtual-rime',

    configureServer(server) {
      // Add a listener for when the server starts
      server.httpServer?.once('listening', () => {
        dev && ensureHasInit();
        regenerateModulesDeclaration();
        // Check if we need to rebuild
        const shouldRebuild = process.argv.includes('--rebuild');

        if (shouldRebuild && existsSync(RIME_DEV_CACHE_DIR)) {
          rmSync(RIME_DEV_CACHE_DIR, { recursive: true, force: true });
          logger.info('--rebuild : node_modules/.rime folder deleted');
        }
      });

      // module.ts/module.server.ts appearing, changing, or disappearing under this project's
      // own src/lib — regenerate the $rime/modules declaration above so the IDE picks up the
      // new/changed/removed split immediately. Listens on add/unlink too, unlike the config
      // watcher below (change-only) — a new split is exactly as likely to be a brand new file
      // as an edit to an existing one.
      const isModuleFile = (p: string) =>
        /[/\\]module(\.server)?\.ts$/.test(p) &&
        p.includes(`${path.sep}src${path.sep}lib${path.sep}`);
      server.watcher.on('add', (p) => isModuleFile(p) && regenerateModulesDeclaration());
      server.watcher.on('unlink', (p) => isModuleFile(p) && regenerateModulesDeclaration());
      server.watcher.on('change', (p) => isModuleFile(p) && regenerateModulesDeclaration());

      // Add a watcher for sanitizing config changes and triggering schema/routes/types
      // generation. Debounced + single-flight: a config change is rarely one file (e.g. a
      // plugin swap copying several files under +rime/ at once) — without this, each file
      // fires its own overlapping sanitize()+generate()+migrate() run against the same db/
      // and sqlite file, racing each other.
      let reloadTimer: ReturnType<typeof setTimeout> | null = null;
      let reloadInFlight: Promise<void> | null = null;
      let reloadQueued = false;

      async function runConfigReload() {
        if (reloadInFlight) {
          reloadQueued = true;
          return;
        }
        reloadInFlight = (async () => {
          // Sanitize the config client/server
          try {
            await sanitize();
          } catch (error: any) {
            logger.error('Error while sanitizing config:', error.message);
            return;
          }
          // Trigger generation
          try {
            // ssrLoadModule wants the real .ts file path, not a $lib/*.js-style import
            // specifier — different consumer than configImportPaths() (used for generated
            // source code).
            const mod = await server.ssrLoadModule(generatedConfigServerPath());
            // The config's default export is the createRime() promise; ssrLoadModule
            // only awaits the module's synchronous evaluation, so we must await it
            // directly to observe init errors (e.g. invalid config) here instead of
            // letting them become unhandled rejections that crash the dev server.
            await mod.default;
          } catch (error: any) {
            logger.error('Failed to reload the config', error.message);
          }
        })();
        await reloadInFlight;
        reloadInFlight = null;
        if (reloadQueued) {
          reloadQueued = false;
          await runConfigReload();
        }
      }

      server.watcher.on('change', (modulePath) => {
        const isConfigChange =
          modulePath.includes(CONFIG_DIR) && !modulePath.includes(GENERATED_DIR);

        if (!isConfigChange) return;

        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloadTimer = null;
          runConfigReload();
        }, 150);
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

      if (IS_RIME_REPO && file.includes('src/lib/core/config')) {
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
      if (id.startsWith(VModulesPrefix)) {
        const subpath = subpathOf(id, importer);
        const pair = findModulePair(libDir(), subpath);
        if (!pair) {
          throw new Error(
            `${id}: no module.ts or module.server.ts under src/lib/${subpath}` +
              (importer ? ` (imported by ${importer})` : '')
          );
        }
        const wanted = this.environment?.config?.consumer === 'server' ? pair.server : pair.client;
        // The half this build wants — a real source file, so the bundler sees it and everything
        // it imports. Only the *missing* half of a half pair stays virtual, and that module is
        // nothing but `undefined` bindings: it reaches no other file.
        return wanted || resolvedVModule(`${VModulesPrefix}${subpath}`);
      }

      return null;
    },

    async load(id) {
      const isServer = this.environment?.config?.consumer === 'server';

      if (id === resolvedVModule(VCoreId)) {
        const corePath = isServer ? 'rimecms/config/server' : 'rimecms/config';
        return `export * from '${corePath}';`;
      }

      if (id === resolvedVModule(VSchemaId) && isServer) {
        // Mirrors write.server.ts (adapter-sqlite/generate-schema) — the adapter itself never
        // needed to change for this, it already goes through this virtual module instead of a
        // hardcoded path.
        const schemaFilePath = schemaPath();
        if (existsSync(schemaFilePath)) {
          const modulePath = schemaFilePath.replace('.ts', '.js');
          return `export * from '${modulePath}'; export { default } from '${modulePath}';`;
        }
      }

      // The missing half of a half pair. ESM binds named exports statically, so an empty module
      // is not enough — `import { x }` throws a SyntaxError at link time if `x` is absent, it
      // does not lazily become `undefined`. Stub each of the other half's names instead.
      if (id.startsWith(resolvedVModule(VModulesPrefix))) {
        const subpath = id.slice(resolvedVModule(VModulesPrefix).length);
        const pair = findModulePair(libDir(), subpath);
        const other = isServer ? pair?.client : pair?.server;
        if (!other) return '';
        return parseExportNames(other)
          .map((name) =>
            name === 'default' ? 'export default undefined;' : `export const ${name} = undefined;`
          )
          .join('\n');
      }

      return null;
    }
  };
}
