import { PANEL_ROUTE } from '$lib/core/dev/constants.server.js';
import { logger } from '$lib/core/logger.server.js';
import type { Config } from '$lib/types.js';
import fs from 'fs';
import path from 'path';
import { prototypes } from '$lib/core/prototype/registry.server.js';
import { commonRoutes, customRoute, paramMatcher, prototypeApiServer } from './common.server.js';
import { injectCustomCSS, removeCustomCSS } from './custom-css.server.js';
import { ensureDir, shouldRegenerateRoutes, writeRouteFile } from './util.server.js';

const projectRoot = process.cwd();

/**
 * Main function to generate browser routes based on configuration.
 *
 * Every file written here is a fixed set of dynamic-segment routes — the count never grows with
 * how many collections or areas are configured, only with how many prototype *kinds* exist and
 * what each one declares. `commonRoutes` holds the ones that are the same for everybody plus the
 * panel's own [slug=<name>] tree; the /api tree is written from each prototype's `rest`
 * declaration, so this file names no kind of its own.
 *
 * The folder is always the literal `[panel=panel]` segment; only src/params/panel.ts's matcher
 * content varies with RIME_PANEL_ROUTE, so the URL itself can be hidden from admin-path scanners
 * without ever renaming a directory. The per-prototype matchers work the same way, baking in the
 * actual slug list — all of them are rewritten here.
 */
function generateRoutes<T extends Config>(config: T): void {
  logger.info('Routes generation...');

  // 1. Check if routes need to be regenerated
  if (!shouldRegenerateRoutes(config)) {
    return;
  }

  // 2. Ensure base directories exist
  const rootRoutes = path.resolve(projectRoot, 'src', 'routes');
  const rimeRoutes = path.join(rootRoutes, '(rime)');
  const panelRoute = path.join(rimeRoutes, '[panel=panel]');
  const paramsDir = path.resolve(projectRoot, 'src', 'params');

  fs.rmSync(rimeRoutes, { recursive: true, force: true });

  ensureDir(rootRoutes);
  ensureDir(rimeRoutes);
  ensureDir(panelRoute);
  ensureDir(paramsDir);

  // 3. The URL segments each prototype accepts, by prototype name. A name with none configured
  // gets no routes and no matcher — generating a matcher that can never match anything would
  // leave SvelteKit with a route no request can reach.
  const allPrototypes = [...(config.collections || []), ...(config.areas || [])];
  const kebabsByPrototype = Object.fromEntries(
    prototypes.map((prototype) => [
      prototype.name,
      allPrototypes.filter((p) => p.type === prototype.name).map((p) => p.kebab)
    ])
  );

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

  // 5. The /api tree, written from what each prototype declared in its own rest/index.server.ts
  // — so an endpoint exists because a definition says so, and codegen never names a kind.
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

  // 6. Param matchers. The [panel=panel] one is always present; the rest are one per prototype
  // name, and **the file name is the prototype name** — that is what makes `[slug=collection]`
  // in a route pattern mean "a slug of the collection prototype", and the whole reason nothing
  // above needs a list of kinds. A matcher whose prototype has no configs is removed, so a
  // stale one from a previous config cannot keep matching.
  fs.writeFileSync(path.join(paramsDir, 'panel.ts'), paramMatcher([PANEL_ROUTE]));

  for (const prototype of prototypes) {
    const matcherPath = path.join(paramsDir, `${prototype.name}.ts`);
    const kebabs = kebabsByPrototype[prototype.name];

    if (kebabs?.length) {
      fs.writeFileSync(matcherPath, paramMatcher(kebabs));
    } else {
      fs.rmSync(matcherPath, { force: true });
    }
  }

  // 7. Handle custom routes from config
  const customRoutes = config.panel?.routes;
  if (customRoutes) {
    for (const [route, routeConfig] of Object.entries(customRoutes)) {
      const routePath = path.join('(rime)', '[panel=panel]', route);
      writeRouteFile(rootRoutes, routePath, 'page', customRoute(routeConfig));
    }
  }

  // 8. Handle custom CSS in layout file
  const layoutPath = path.join(rimeRoutes, '+layout.svelte');
  if (fs.existsSync(layoutPath)) {
    if (config.panel?.css) {
      injectCustomCSS(layoutPath, config.panel.css);
    } else {
      removeCustomCSS(layoutPath);
    }
  }

  logger.info('[✓] Routes generated');
}

export default generateRoutes;
