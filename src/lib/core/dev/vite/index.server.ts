import dotenv from 'dotenv';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { RIME_DEV_CACHE_DIR } from '../../constant.server.js';
import { ensureHasInit } from '../../ensure.server.js';
import { logger } from '../../logger/index.server.js';
import { getPackageInfoByKey } from '../cli/util/package.server.js';
import { INPUT_DIR, isInstalledDependency, OUTPUT_DIR, schemaPath } from '../constants.js';
import { parseExportNames } from '../generate/runtime/parse-exports.server.js';
import {
  findInstalledPackageRoot,
  findModulePair,
  scanModulePairs,
  type RuntimeRegistryEntry
} from '../generate/runtime/index.server.js';
import { sanitize } from '../generate/sanitize/index.server.js';

dotenv.config({ override: true });
const dev = process.env.NODE_ENV === 'development';

/** Picks the client or server side of a module.(server.)ts pair. When the requested side
 *  wasn't authored (e.g. a collection's $url/$hooks, real only server-side, imported anyway by
 *  the isomorphic index.ts a client build also needs for its field definitions), stubs each of
 *  the *other* side's export names to `undefined` instead of returning nothing — ESM does
 *  static named-export binding, so an empty module isn't enough, `import { x } from ...` throws
 *  a SyntaxError at link time if `x` isn't actually exported, it doesn't lazily become
 *  `undefined`. Harmless: server-only exports are already stripped from client-side types, so
 *  nothing client-side ever reads the stubbed value — it only has to exist. */
function exportFrom(entry: RuntimeRegistryEntry, isServer: boolean): string {
  const target = isServer ? entry.server : entry.client;
  if (target) return `export * from '${target.replace(/\.ts$/, '.js')}';`;

  const other = isServer ? entry.client : entry.server;
  if (!other) return '';
  return parseExportNames(other)
    .map((name) => (name === 'default' ? 'export default undefined;' : `export const ${name} = undefined;`))
    .join('\n');
}

/** Splits `<pkg>/<subpath>` or `@scope/<pkg>/<subpath>` into its package name and the rest —
 *  a scoped name is two path segments, a plain one is one. */
function splitPackageSpecifier(rest: string): { pkgName: string; subpath: string } {
  const segments = rest.split('/');
  const pkgName = rest.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  const subpath = segments.slice(pkgName.split('/').length).join('/');
  return { pkgName, subpath };
}

export function rime(): Plugin {
  /** Two reserved names, always resolved to *the currently running app's* generated
   *  config/schema, independent of who's asking — a third-party plugin importing
   *  `$rime/config` gets the host app's config, never its own. Unrelated to the modules
   *  mechanism below (a package's own client/server split): different problem, same `$rime/`
   *  namespace only by convention. */
  const VCoreId = '$rime/config';
  const VSchemaId = '$rime/schema';

  /** `$rime/modules` — a package's own client/server split, resolved relative to *whoever's
   *  asking*, always self-contained. Two forms:
   *
   *  - The bare barrel, `$rime/modules`, addressed by *export name* rather than path — dev
   *    only, live-scans this project's own `src/lib` for every `module.(server.)ts` pair (see
   *    `regenerateModulesDeclaration` below for the matching local-dev `.d.ts`). Never ships:
   *    a prepack step (the `generate-manifest` CLI command) AST-rewrites every `$rime/modules`
   *    import into the qualified form below before publish, so a consumer never sees the
   *    barrel at all.
   *  - The qualified form, `$rime/modules/<pkg>/<path>`, always package-qualified — even for a
   *    package's own internal references to itself. Two ways it resolves, both in `resolveId`
   *    (not `load`, which never receives `importer`): `<pkg>` equals this project's own
   *    `package.json` name → self-reference, resolved directly off this project's own
   *    `src/lib`. Otherwise → an installed dependency, its root found by walking up
   *    `node_modules/<pkg>` from the importer's own directory (`findInstalledPackageRoot` —
   *    pure directory existence, no `exports`-conditions matching, since a package whose
   *    `exports` map declares only conditions neither `require.resolve` nor
   *    `import.meta.resolve` use fails to resolve through either) and its shipped
   *    `dist/.rime-modules.json` read directly — no directory-convention guessing beyond that,
   *    immune to Vite's dep-optimizer flattening a package (reading a known filename off disk
   *    never touches the import graph the optimizer rewrites). Full design:
   *    docs/plans/imports.md. */
  const VModulesId = '$rime/modules';
  const VModulesPrefix = '$rime/modules/';
  const ownPackageName = getPackageInfoByKey('name');

  // Separates a resolved root from the original specifier inside one virtual module id — never
  // appears in a real path or a JS specifier, so it's an unambiguous split point. Only the
  // third-party qualified-form case needs it (the root has to travel with the id since load()
  // doesn't receive importer); the barrel and self-reference cases carry no baked-in root.
  const ROOT_SEP = '\x01';

  const resolvedVModule = (name: string) => '\0' + name;

  // Local-dev types for the $rime/modules barrel — declares every module.(server.)ts pair
  // currently under this project's own src/lib, live. Regenerated on startup and whenever a
  // module file appears/changes/disappears (see the watcher below) — never ships, gitignored,
  // same treatment as app.generated.d.ts/rime.generated.d.ts.
  //
  // $lib/-aliased paths, not bare relative/absolute ones — verified directly (a plain relative
  // or absolute `export * from` inside a `declare module` block silently resolves to no
  // exports at all; TS only picks up the re-exported names through a real configured alias).
  function regenerateModulesDeclaration() {
    const libDir = path.resolve(process.cwd(), 'src/lib');
    const pairs = scanModulePairs(libDir);
    const exports = Array.from(pairs.values())
      .map((entry) => entry.server || entry.client)
      .filter(Boolean)
      .map((file) => `$lib/${path.relative(libDir, file).split(path.sep).join('/')}`.replace(/\.ts$/, '.js'))
      .map((aliased) => `  export * from '${aliased}';`)
      .join('\n');
    writeFileSync(
      path.resolve(process.cwd(), 'src/rime.modules.generated.d.ts'),
      `declare module '$rime/modules' {\n${exports}\n}\n`
    );
  }

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
        /[/\\]module(\.server)?\.ts$/.test(p) && p.includes(`${path.sep}src${path.sep}lib${path.sep}`);
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

      if (/[/\\]module(\.server)?\.ts$/.test(file) && file.includes(`${path.sep}src${path.sep}lib${path.sep}`)) {
        const module = invalidateVModule(VModulesId);
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
      if (id === VModulesId) {
        return resolvedVModule(id); // barrel, no root to bake in — load() always scans this project's own src/lib
      }
      if (id.startsWith(VModulesPrefix)) {
        const { pkgName } = splitPackageSpecifier(id.slice(VModulesPrefix.length));
        if (pkgName === ownPackageName) {
          return resolvedVModule(id); // self-reference: load() scans this project's own src/lib too
        }
        if (!importer) {
          throw new Error(`$rime/modules: '${id}' has no importer to resolve '${pkgName}' from`);
        }
        // Third-party dependency: find its installed root now, while `importer` is still
        // available (load() doesn't receive it) — baked into the id via ROOT_SEP. Walks up
        // node_modules directly (see findInstalledPackageRoot) rather than resolving through
        // the package's own `exports` map — confirmed in practice that both `require.resolve`
        // and `import.meta.resolve` gate on a condition set matching, and a package whose
        // exports only declare conditions neither uses (rime's own included: `types`/`svelte`/
        // `import`, no `require`/`default`) fails to resolve at all through either.
        const pkgRoot = findInstalledPackageRoot(pkgName, path.dirname(importer));
        return resolvedVModule(`${pkgRoot}${ROOT_SEP}${id}`);
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

      if (id === resolvedVModule(VModulesId)) {
        // Dev-mode barrel — re-exports every module.(server.)ts pair found under this
        // project's own src/lib, live. Never ships: prepack rewrites every '$rime/modules'
        // import into a qualified one before publish, so this only ever runs during dev.
        const pairs = scanModulePairs(path.resolve(process.cwd(), 'src/lib'));
        return Array.from(pairs.values())
          .map((entry) => exportFrom(entry, isServer))
          .filter(Boolean)
          .join('\n');
      }

      // Self-reference qualified form — resolveId returned this bare, no root baked in
      // (matches VModulesId's shape above): resolve directly off this project's own src/lib.
      if (id.startsWith(resolvedVModule(VModulesPrefix))) {
        const subpath = splitPackageSpecifier(id.slice(resolvedVModule(VModulesPrefix).length)).subpath;
        const pair = findModulePair(path.resolve(process.cwd(), 'src/lib'), subpath);
        if (!pair) throw new Error(`${id.slice(1)}: doesn't resolve under this project's own src/lib`);
        return exportFrom(pair, isServer);
      }

      // Third-party qualified form — resolveId baked the resolved package root in via
      // ROOT_SEP: read what it shipped at prepack, don't guess.
      {
        const modulesSepIndex = id.indexOf(ROOT_SEP);
        const modulesSpecifier = modulesSepIndex === -1 ? '' : id.slice(modulesSepIndex + 1);
        if (modulesSpecifier.startsWith(VModulesPrefix)) {
          const pkgRoot = id.slice(1, modulesSepIndex);
          const rest = modulesSpecifier.slice(VModulesPrefix.length);
          const { pkgName, subpath } = splitPackageSpecifier(rest);

          const manifestPath = path.join(pkgRoot, 'dist/.rime-modules.json');
          if (!existsSync(manifestPath)) {
            throw new Error(
              `$rime/modules/${pkgName}: no manifest at ${manifestPath} — does ${pkgName} run 'rime generate-manifest' at prepack?`
            );
          }
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const pair = manifest[subpath];
          if (!pair) {
            throw new Error(`$rime/modules/${pkgName}/${subpath}: not found in ${pkgName}'s manifest`);
          }
          return exportFrom(pair, isServer);
        }
      }

      return null;
    }
  };
}
