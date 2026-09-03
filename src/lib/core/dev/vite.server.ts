import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { IS_RIME_REPO, RIME_DEV_CACHE_DIR } from '../constants.server.js';
import { logger } from '../logger.server.js';
import { getPackageInfoByKey } from './cli/util/package.server.js';
import {
  findInstalledPackageRoot,
  findModulePair,
  scanModulePairs,
  type RuntimeRegistryEntry
} from './codegen/runtime/index.server.js';
import {
  applyEdits,
  buildModuleIndex,
  planBarrelRewrite,
  type ModuleIndex
} from './codegen/runtime/barrel-rewrite.server.js';
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
    .map((name) =>
      name === 'default' ? 'export default undefined;' : `export const ${name} = undefined;`
    )
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

// Writes the local-dev $rime/modules barrel types from every module.(server.)ts pair under
// src/lib. Exported so the CLI `generate` command can call it too — its Vite server runs in
// middlewareMode, which never fires the `listening` event `rime()` normally hooks this to.
export function regenerateModulesDeclaration() {
  const libDir = path.resolve(process.cwd(), 'src/lib');
  const pairs = scanModulePairs(libDir);
  const exports = Array.from(pairs.values())
    .map((entry) => entry.server || entry.client)
    .filter(Boolean)
    .map((file) =>
      `$lib/${path.relative(libDir, file).split(path.sep).join('/')}`.replace(/\.ts$/, '.js')
    )
    .map((aliased) => `  export * from '${aliased}';`)
    .join('\n');
  writeFileSync(
    path.resolve(process.cwd(), 'src/rime.modules.generated.d.ts'),
    `declare module '$rime/modules' {\n${exports}\n}\n`
  );
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
   * `$rime/modules` lets a package split its code into client and server files.
   *
   * While developing, you can just write `$rime/modules` with no path and it scans this
   * project's own `src/lib` for every split. Before the package is published, that gets
   * rewritten into explicit imports like `$rime/modules/<pkg>/<path>` — so anyone installing
   * the package never sees the bare form, only real paths.
   *
   * When resolving one of those explicit imports: if `<pkg>` is this same project, we read
   * straight from `src/lib`. Otherwise it's a real dependency, so we find it in
   * `node_modules` and read the file list it shipped.
   *
   */
  const VModulesId = '$rime/modules';
  const VModulesPrefix = '$rime/modules/';
  const ownPackageName = getPackageInfoByKey('name');

  /**
   * Export name → the pair that declares it, for the rewrite in `transform` below.
   *
   * Built once and cached because it parses every pair's exports; dropped whenever a pair is
   * added, changed or removed (see handleHotUpdate). `moduleRewrites` remembers which modules
   * the rewrite actually touched, so those can be invalidated at the same time — a new pair can
   * change where an *existing* import resolves to.
   */
  let moduleIndex: ModuleIndex | null = null;
  const moduleRewrites = new Set<string>();

  const getModuleIndex = () => {
    if (moduleIndex) return moduleIndex;

    const pairs = scanModulePairs(path.resolve(process.cwd(), 'src/lib'));
    moduleIndex = buildModuleIndex(pairs, (subpath, onlyServer, onlyClient) => {
      // Legal — a server-only helper beside a client half is normal, and nothing breaks until
      // something imports across the gap, which `transform` reports precisely. Worth saying out
      // loud anyway: this is the shape that fails in the browser rather than at build time.
      logger.warn(
        `$rime/modules: ${subpath}'s two halves export different names ` +
          `(server-only: ${onlyServer.join(', ') || 'none'}; ` +
          `client-only: ${onlyClient.join(', ') || 'none'}). ` +
          `Importing one of those from isomorphic code fails on the side that lacks it.`
      );
    });
    return moduleIndex;
  };

  // Separates a resolved root from the original specifier inside one virtual module id — never
  // appears in a real path or a JS specifier, so it's an unambiguous split point. Only the
  // third-party qualified-form case needs it (the root has to travel with the id since load()
  // doesn't receive importer); the barrel and self-reference cases carry no baked-in root.
  const ROOT_SEP = '\x01';

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

      if (
        /[/\\]module(\.server)?\.ts$/.test(file) &&
        file.includes(`${path.sep}src${path.sep}lib${path.sep}`)
      ) {
        // The index is now stale, and so is every rewrite made from it: a pair appearing or
        // losing an export moves where an existing import resolves to, in files that did not
        // themselves change.
        moduleIndex = null;
        const touched = Array.from(moduleRewrites)
          .map((id) => server.moduleGraph.getModuleById(id))
          .filter((module) => module !== undefined);
        touched.forEach((module) => server.moduleGraph.invalidateModule(module));
        moduleRewrites.clear();
        if (touched.length) return touched;
      }
    },

    /**
     * Rewrites `import { x } from '$rime/modules'` into an import of the one pair that declares
     * `x`, per name — the same rewrite `rime generate-manifest` performs at prepack, moved into
     * dev so both behave alike.
     *
     * Why it is not enough to let the bare specifier resolve to a barrel: the barrel re-exports
     * *every* pair in the package, so importing one binding evaluates all of them and everything
     * they import. A module the barrel leads back to is then evaluated inside an import cycle,
     * and a binding it reads at module scope is `undefined` — silently, and only in dev, because
     * dist has been rewritten since before it shipped. Rewriting here means one pair is
     * imported, and no barrel module exists in the graph to route a cycle through.
     */
    transform(code, id) {
      if (!code.includes(VModulesId)) return null;
      // A dependency's own bare imports were already rewritten by *its* prepack; anything left
      // in node_modules naming the barrel is the qualified form, which resolveId handles.
      if (id.includes('node_modules')) return null;

      if (!ownPackageName) {
        throw new Error(
          `$rime/modules: ${id} imports the barrel, but this project's package.json has no ` +
            `"name" — the rewrite has no package to qualify the import with.`
        );
      }

      const edits = planBarrelRewrite({
        code,
        filePath: id,
        pkgName: ownPackageName,
        index: getModuleIndex(),
        side: this.environment?.config?.consumer === 'server' ? 'server' : 'client'
      });
      if (!edits.length) return null;

      moduleRewrites.add(id);
      // Each statement's replacement is one line, so every other line keeps its number and the
      // original sourcemap stays usable — `map: null` tells Vite exactly that.
      return { code: applyEdits(code, edits), map: null };
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
        // There is no barrel any more. `transform` above rewrites every bare `$rime/modules`
        // import into a qualified, per-pair one, so nothing should ever ask to load the bare
        // specifier as a module. Reaching here means something imported it in a form the
        // rewrite does not handle and did not go through `transform` — a backstop, not a path.
        throw new Error(
          `$rime/modules: something imported the bare barrel without being rewritten. Only ` +
            `named static imports are supported — not \`import * as\`, \`export * from\`, or ` +
            `\`import()\`.`
        );
      }

      // Self-reference qualified form — resolveId returned this bare, no root baked in
      // (matches VModulesId's shape above): resolve directly off this project's own src/lib.
      if (id.startsWith(resolvedVModule(VModulesPrefix))) {
        const subpath = splitPackageSpecifier(
          id.slice(resolvedVModule(VModulesPrefix).length)
        ).subpath;
        const pair = findModulePair(path.resolve(process.cwd(), 'src/lib'), subpath);
        if (!pair)
          throw new Error(`${id.slice(1)}: doesn't resolve under this project's own src/lib`);
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

          const distDir = path.join(pkgRoot, 'dist');
          const manifestPath = path.join(distDir, '.rime-modules.json');
          if (!existsSync(manifestPath)) {
            throw new Error(
              `$rime/modules/${pkgName}: no manifest at ${manifestPath} — does ${pkgName} run 'rime generate-manifest' at prepack?`
            );
          }
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const pair = manifest[subpath];
          if (!pair) {
            throw new Error(
              `$rime/modules/${pkgName}/${subpath}: not found in ${pkgName}'s manifest`
            );
          }
          // Manifest entries are stored relative to *that package's own* dist/ (written by
          // generate-manifest on whatever machine packed it) - re-rooted onto distDir (this
          // installed copy's real, resolved location) here, not trusted as absolute. An
          // absolute path baked in at pack time would silently read the package author's own
          // working-copy dist/ instead of what's actually installed here whenever both
          // happen to exist on the same machine (exactly what authoring rime itself hit).
          const resolvedPair: RuntimeRegistryEntry = {
            client: pair.client ? path.join(distDir, pair.client) : '',
            server: pair.server ? path.join(distDir, pair.server) : ''
          };
          return exportFrom(resolvedPair, isServer);
        }
      }

      return null;
    }
  };
}
