import { logger } from '#lib/core/logger.server.js';
import { area } from '#lib/core/prototype/area/definition.server.js';
import { collection } from '#lib/core/prototype/collection/definition.server.js';
import type { Config } from '#lib/types.js';
import fs from 'fs';
import path from 'path';
import { PANEL_ROUTE, paramsPath } from '../../constants.server.js';
import {
  commonRoutes,
  customRoute,
  mainLayout,
  paramsModule,
  prototypeApiServer
} from './common.server.js';
import { injectCustomCSS } from './custom-css.server.js';
import cache from '#lib/core/dev/cache.server.js';
import { ensureDir, routesMemo, writeRouteFile } from './util.server.js';

const projectRoot = process.cwd();

/**
 * The app's root `+layout.server.ts`, written only when the app has no root layout server
 * (`.ts` or `.js`). After that the file is the app's, and regeneration leaves it alone.
 */
export const writeAppLayoutServer = (rootRoutes: string): boolean => {
  const exists = ['+layout.server.ts', '+layout.server.js'].some((file) =>
    fs.existsSync(path.join(rootRoutes, file))
  );
  if (exists) return false;
  writeRouteFile(rootRoutes, '', 'layoutServer', mainLayout());
  return true;
};

/**
 * What each generated matcher accepts, by matcher name: `panel` always, one per prototype name
 * with configs, and `locale` when the config has locales.
 *
 * ```ts
 * matcherValues(config, { collection: ['pages'], area: [] });
 * // { panel: ['panel'], collection: ['pages'], locale: ['fr', 'en'] }
 * ```
 */
export const matcherValues = (config: Config, kebabsByPrototype: Record<string, string[]>) => {
  const values: Record<string, string[]> = { panel: [PANEL_ROUTE] };
  for (const [name, kebabs] of Object.entries(kebabsByPrototype)) {
    if (kebabs.length) values[name] = kebabs;
  }
  const locales = (config.localization?.locales ?? []).map((locale) => locale.code);
  if (locales.length) values.locale = locales;
  return values;
};

/**
 * Writes the (rime) route tree — panel pages and /api — and the generated params.ts.
 *
 * Every file written here is a fixed set of dynamic-segment routes — the count never grows with
 * how many collections or areas are configured, only with how many prototype *kinds* exist and
 * what each one declares. `commonRoutes` holds the ones that are the same for everybody plus the
 * panel's own [slug=<name>] tree; the /api tree is written from each prototype's `rest`
 * declaration.
 *
 * The folder is always the literal `[panel=panel]` segment; only the `panel` matcher's content
 * varies with RIME_PANEL_ROUTE, so the URL itself can be hidden from admin-path scanners without
 * ever renaming a directory. The per-prototype matchers work the same way, baking in the actual
 * slug list — all of them are rewritten here, into the generated params.ts.
 */
function generateRoutes<T extends Config>(config: T): void {
  logger.debug('Routes generation...');

  // 1. Skip when the route tree already matches the config and the package
  const memo = routesMemo(config);
  if (cache.matches('routes', memo)) {
    return;
  }

  // 2. Ensure base directories exist
  const rootRoutes = path.resolve(projectRoot, 'src', 'routes');
  const rimeRoutes = path.join(rootRoutes, '(rime)');
  const panelRoute = path.join(rimeRoutes, '[panel=panel]');

  fs.rmSync(rimeRoutes, { recursive: true, force: true });

  ensureDir(rootRoutes);
  ensureDir(rimeRoutes);
  ensureDir(panelRoute);

  // 3. The URL segments each prototype accepts, by prototype name. A name with none configured
  // gets no routes and no matcher — generating a matcher that can never match anything would
  // leave SvelteKit with a route no request can reach.
  const prototypes = [collection, area];
  const kebabsByPrototype: Record<string, string[]> = {
    collection: (config.collections || []).map((c) => c.kebab),
    area: (config.areas || []).map((a) => a.kebab)
  };

  // 4. Process common routes — the fixed files plus the panel's own
  // [panel=panel]/[slug=<name>]/... tree. A pattern naming a matcher is skipped when that
  // matcher will not exist, read off the pattern itself rather than from a per-kind boolean.
  const matcherIn = (pattern: string) => pattern.match(/\[slug=([^\]]+)\]/)?.[1];

  for (const [pattern, files] of Object.entries(commonRoutes)) {
    const matcher = matcherIn(pattern);
    if (matcher && !kebabsByPrototype[matcher]?.length) continue;
    for (const [fileType, templateFn] of Object.entries(files)) {
      writeRouteFile(rootRoutes, pattern, fileType, templateFn());
    }
  }
  writeAppLayoutServer(rootRoutes);

  // 5. The /api tree, written from what each prototype declared in its own rest/index.server.ts.
  for (const prototype of prototypes) {
    if (!kebabsByPrototype[prototype.name]?.length) continue;

    for (const [routePath, routeConfig] of Object.entries(prototype.rest || {})) {
      const methods = Object.keys(routeConfig);
      if (!methods.length) continue;

      const pattern = path.join(`(rime)/api/[slug=${prototype.name}]`, routePath);
      writeRouteFile(
        rootRoutes,
        pattern,
        'server',
        prototypeApiServer(prototype.name, routePath, methods)
      );
    }
  }

  // 6. Param matchers. The [panel=panel] one is always present; the prototype ones are one per
  // prototype name, and **the key is the prototype name** — that is what makes
  // `[slug=collection]` in a route pattern mean "a slug of the collection prototype". A prototype
  // with no configs gets no matcher, so a stale one from a previous config cannot keep matching.
  // A config with locales gets `locale`, for the site's `[[locale=locale]]`.
  fs.writeFileSync(paramsPath(), paramsModule(matcherValues(config, kebabsByPrototype)));

  // 7. Handle custom routes from config
  const customRoutes = config.panel?.routes;
  if (customRoutes) {
    for (const [route, routeConfig] of Object.entries(customRoutes)) {
      const routePath = path.join('(rime)', '[panel=panel]', route);
      const routeDir = path.join(rootRoutes, routePath);
      writeRouteFile(rootRoutes, routePath, 'page', customRoute(routeConfig, routeDir));
    }
  }

  // 8. Handle custom CSS in layout file
  const layoutPath = path.join(rimeRoutes, '+layout.svelte');
  if (fs.existsSync(layoutPath)) {
    if (config.panel?.css) {
      injectCustomCSS(layoutPath, config.panel.css);
    }
  }

  // The tree is written: the next run with the same memo has nothing to do
  cache.remember('routes', memo);
  logger.debug('[✓] Routes generated');
}

export default generateRoutes;
