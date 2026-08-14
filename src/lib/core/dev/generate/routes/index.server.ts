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

  // 3. Process common routes (now includes the matcher-disambiguated [slug=collection|area] routes)
  for (const [pattern, files] of Object.entries(commonRoutes)) {
    for (const [fileType, templateFn] of Object.entries(files)) {
      writeRouteFile(rootRoutes, pattern, fileType, templateFn());
    }
  }

  // 4. Write the [slug=collection]/[slug=area] param matchers
  fs.writeFileSync(
    path.join(paramsDir, 'collection.ts'),
    paramMatcher((config.collections || []).map((c) => c.slug))
  );
  fs.writeFileSync(
    path.join(paramsDir, 'area.ts'),
    paramMatcher((config.areas || []).map((a) => a.slug))
  );

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
