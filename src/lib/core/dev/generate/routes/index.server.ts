import { logger } from '$lib/core/logger/index.server.js';
import type { Config } from '$lib/types.js';
import fs from 'fs';
import path from 'path';
import { commonRoutes, customRoute, paramMatcher } from './common.server.js';
import { injectCustomCSS, removeCustomCSS } from './custom-css.server.js';
import { ensureDir, shouldRegenerateRoutes, writeRouteFile } from './util.server.js';

const projectRoot = process.cwd();

/**
 * Main function to generate browser routes based on configuration.
 * commonRoutes is a fixed set of files (layout, sign-in, dashboard, the
 * matcher-disambiguated /panel/[slug=collection|area]/... and
 * /api/[slug=collection|area]/... dynamic routes) — it no longer varies with
 * how many collections/areas are configured, so there's no per-collection/area
 * loop here anymore. The src/params/collection.ts and area.ts matchers backing
 * those routes DO bake in the actual slug list, so they're rewritten here too.
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
  const panelRoute = path.join(rimeRoutes, 'panel');
  const paramsDir = path.resolve(projectRoot, 'src', 'params');

  fs.rmSync(rimeRoutes, { recursive: true, force: true });

  ensureDir(rootRoutes);
  ensureDir(rimeRoutes);
  ensureDir(panelRoute);
  ensureDir(paramsDir);

  // 3. Process common routes (now includes the matcher-disambiguated [slug=collection|area] routes) —
  // skip the [slug=collection]/[slug=area] routes and their matchers when there are no collections/areas
  // configured, rather than generating a matcher that can never match anything.
  const hasCollections = (config.collections || []).length > 0;
  const hasAreas = (config.areas || []).length > 0;

  for (const [pattern, files] of Object.entries(commonRoutes)) {
    if (!hasCollections && pattern.includes('[slug=collection]')) continue;
    if (!hasAreas && pattern.includes('[slug=area]')) continue;
    for (const [fileType, templateFn] of Object.entries(files)) {
      writeRouteFile(rootRoutes, pattern, fileType, templateFn());
    }
  }

  // 4. Write the [slug=collection]/[slug=area] param matchers, only when needed — and remove any
  // stale matcher left over from a previous config that did have collections/areas.
  const collectionMatcherPath = path.join(paramsDir, 'collection.ts');
  if (hasCollections) {
    fs.writeFileSync(collectionMatcherPath, paramMatcher((config.collections || []).map((c) => c.kebab)));
  } else {
    fs.rmSync(collectionMatcherPath, { force: true });
  }

  const areaMatcherPath = path.join(paramsDir, 'area.ts');
  if (hasAreas) {
    fs.writeFileSync(areaMatcherPath, paramMatcher((config.areas || []).map((a) => a.kebab)));
  } else {
    fs.rmSync(areaMatcherPath, { force: true });
  }

  // 5. Handle custom routes from config
  const customRoutes = config.panel?.routes;
  if (customRoutes) {
    for (const [route, routeConfig] of Object.entries(customRoutes)) {
      const routePath = path.join('(rime)', 'panel', route);
      writeRouteFile(rootRoutes, routePath, 'page', customRoute(routeConfig));
    }
  }

  // 6. Handle custom CSS in layout file
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
