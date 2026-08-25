import dotenv from 'dotenv';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, UserConfig } from 'vite';
import { RIME_DEV_CACHE_DIR } from '../../constant.server.js';
import { ensureHasInit } from '../../ensure.server.js';
import { logger } from '../../logger/index.server.js';
import { INPUT_DIR, isInstalledDependency, OUTPUT_DIR, schemaPath } from '../constants.js';
import { parseExportNames } from '../generate/runtime/parse-exports.server.js';
import {
  findDistRoot,
  findModulePair,
  findPackageRoot,
  findRimePluginRoots,
  type RuntimeRegistryEntry
} from '../generate/runtime/index.server.js';
import { sanitize } from '../generate/sanitize/index.server.js';

dotenv.config({ override: true });
const dev = process.env.NODE_ENV === 'development';

function exportFrom(entry: RuntimeRegistryEntry, isServer: boolean): string {
  const target = isServer ? entry.server : entry.client;
  if (target) return `export * from '${target.replace(/\.ts$/, '.js')}';`;

  // That side wasn't authored — e.g. a collection's $url/$hooks, real only in
  // module.server.ts, imported anyway by the isomorphic index.ts a client build also needs
  // for its field definitions. ESM does static named-export binding, so an empty module
  // isn't enough — `import { buildNewsUrl } from ...` throws a SyntaxError at link time if
  // that name isn't actually exported, it doesn't lazily become `undefined`. Parse the real
  // side's export names and stub each one out instead. Harmless: $url/$hooks are already
  // stripped from the client-side collection type (see BuiltCollectionClient), so nothing
  // client-side ever reads the value — it only has to exist.
  const other = isServer ? entry.client : entry.server;
  if (!other) return '';
  return parseExportNames(other)
    .map((name) => (name === 'default' ? 'export default undefined;' : `export const ${name} = undefined;`))
    .join('\n');
}

export function rime(): Plugin {
  const VCoreId = '$rime/config';
  const VSchemaId = '$rime/schema';
  /** One rule, no exceptions: `import { x } from '$rime/<name>'` always resolves `<name>`
   *  relative to the *importing file's own package* — rime's own (relation/index.ts,
   *  cache/index.ts, ...), a consumer app's own local fields, or a third-party field/plugin
   *  package's own client/server split, resolved straight off that package's disk (its
   *  `dist/` once built and installed, its `src/lib/` while still source — rime's own dev, a
   *  consumer app's own files, or a package's own dev sandbox alike). No package-name prefix
   *  ever needed, even for a package referencing its own split — `resolveLibRoot` below
   *  finds the importer's own root directly, so there's nothing to spell out. Never a
   *  `node_modules` walk. The specifier is a static string baked into the source, so it
   *  survives esbuild's dep-optimizer flattening — unlike an importer-relative *file* import,
   *  which breaks the moment the importing file gets pre-bundled (the resolved import then
   *  points at the flattened chunk, not the real source file); resolving `$rime/<name>`
   *  itself off the *original* importer sidesteps that entirely. `config` and `schema` are
   *  reserved names (see VCoreId/VSchemaId below, checked first) — a field can't be
   *  registered under either. */
  const VPrefix = '$rime/';
  // Separates the resolved root from the original specifier inside one virtual module id —
  // never appears in a real path or a JS specifier, so it's an unambiguous split point.
  const ROOT_SEP = '\x01';

  const resolvedVModule = (name: string) => '\0' + name;

  /** `$rime/<name>`'s root: walk up from the importing file to its own nearest
   *  `package.json`, then use `dist/` if that file is already built/installed
   *  (`node_modules` anywhere in its path) or `src/lib/` if it's still source. */
  function resolveLibRoot(importer: string): string {
    const packageRoot = findPackageRoot(path.dirname(importer));
    const isBuilt = importer.includes(`${path.sep}node_modules${path.sep}`);
    return path.join(packageRoot, isBuilt ? 'dist' : 'src/lib');
  }

  // Fallback roots for load() below, computed once (not from any runtime importer) — needed
  // because Vite's esbuild-based dep-optimizer can't resolve a virtual $rime/<name> import
  // itself (only this plugin's own load() can), so it leaves it as a live import in the
  // flattened node_modules/.vite/deps/* chunk it produces for rimecms instead of erroring.
  // Once the browser later requests that chunk, the importer resolveId() sees is the
  // flattened path, not rime's real source — resolveLibRoot's walk-up then lands on
  // .vite/deps's own package.json, not rime's. These two static roots are exactly what the
  // plugin used before it went importer-relative, and they're immune to this: neither is
  // derived from a runtime importer, so optimizer flattening can't affect them.
  const consumerLibDir = path.resolve(process.cwd(), 'src/lib');
  const nativeLibDir = isInstalledDependency(import.meta.url)
    ? findDistRoot(path.dirname(fileURLToPath(import.meta.url)))
    : null;
  // Covers a *third-party* plugin/field package getting optimizer-flattened — nativeLibDir/
  // consumerLibDir only ever point at rime's own dist or this app's own src/lib, neither of
  // which is a third-party package's root. Every installed package that itself depends on
  // rimecms, discovered once at startup (see findRimePluginRoots's own doc comment).
  const pluginLibDirs = findRimePluginRoots(process.cwd());

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
            // source code), so computed directly here.
            const serverConfigPath = `src/lib/${OUTPUT_DIR}/rime.config.server.ts`;
            const mod = await server.ssrLoadModule(serverConfigPath);
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
          modulePath.includes(`src/lib/${INPUT_DIR}`) &&
          !modulePath.includes(`src/lib/${OUTPUT_DIR}`);

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

    resolveId(id, importer) {
      if (id === VCoreId) {
        return resolvedVModule(id);
      }
      if (id === VSchemaId) {
        return resolvedVModule(id);
      }
      if (id.startsWith(VPrefix)) {
        if (!importer) {
          throw new Error(`$rime: '${id}' has no importer to resolve its package root from`);
        }
        // The root has to be part of the resolved id itself, not tracked separately — two
        // different packages can use the same bare name for their own split (e.g. both a
        // plugin and a field calling it "$rime/module"), and Vite's module graph caches
        // purely by id, so each needs a genuinely distinct one. load() resolves on demand
        // and throws its own clear error if nothing matches under that root.
        return resolvedVModule(`${resolveLibRoot(importer)}${ROOT_SEP}${id}`);
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

      if (!id.startsWith('\0')) return null;
      const sepIndex = id.indexOf(ROOT_SEP);
      if (sepIndex === -1) return null; // VCoreId/VSchemaId, already handled above

      const root = id.slice(1, sepIndex);
      const specifier = id.slice(sepIndex + 1);
      const name = specifier.slice(VPrefix.length);

      // The importer-derived root first — correct for the vast majority of cases. Falling
      // back to the static roots covers it being wrong specifically because the importer
      // was an optimizer-flattened chunk (see the comment on nativeLibDir/consumerLibDir
      // above) — cheap and harmless to just try them too rather than distinguish why the
      // first lookup failed. pluginLibDirs last, one findModulePair call per discovered
      // third-party package — small in practice (how many plugins/fields one app installs).
      const hit =
        findModulePair(root, name) ??
        (nativeLibDir && findModulePair(nativeLibDir, name)) ??
        findModulePair(consumerLibDir, name) ??
        pluginLibDirs.reduce<RuntimeRegistryEntry | null>(
          (found, dir) => found ?? findModulePair(dir, name),
          null
        );
      if (!hit) {
        throw new Error(`$rime/${name}: doesn't resolve under ${root}`);
      }
      return exportFrom(hit, isServer);
    }
  };
}
