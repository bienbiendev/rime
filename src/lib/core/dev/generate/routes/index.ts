import { logger } from '$lib/core/logger/index.server.js';
import { withDirectoriesSuffix, withVersionsSuffix } from '$lib/core/naming.js';
import type { Config } from '$lib/types.js';
import fs from 'fs';
import path from 'path';
import { areaAPIRoutes, areaRoutes, areaVersionsPanelRoutes } from './area.js';
import {
  collectionAPIRoutes,
  collectionPanelRoutes,
  collectionVersionsPanelRoutes
} from './collection.js';
import { commonRoutes, customRoute } from './common.js';
import { injectCustomCSS, removeCustomCSS } from './custom-css.js';
import { ensureDir, shouldRegenerateRoutes, writeRouteFile, type Routes } from './util.js';

const projectRoot = process.cwd();

/**
 * Main function to generate browser routes based on configuration
 */
function generateRoutes<T extends Config>(config: T): void {
  logger.info('Routes generation...');

  const areas = (config.areas || []).filter((a) => a._generateRoutes !== false);
  const collections = (config.collections || []).filter((c) => c._generateRoutes !== false);

  // 1. Check if routes need to be regenerated
  if (!shouldRegenerateRoutes(config)) {
    return;
  }

  // 2. Ensure base directories exist
  const rootRoutes = path.resolve(projectRoot, 'src', 'routes');
  const rimeRoutes = path.join(rootRoutes, '(rime)');
  const panelRoute = path.join(rimeRoutes, 'panel');

  fs.rmSync(rimeRoutes, { recursive: true, force: true });

  ensureDir(rootRoutes);
  ensureDir(rimeRoutes);
  ensureDir(panelRoute);

  // Function that generate area/collection routes files from a Routes object
  const processRoutes = (slug: string, kebab: string, routes: Routes) => {
    for (const [pattern, files] of Object.entries(routes)) {
      const routePath = pattern.replace('{area.kebab}', kebab).replace('{collection.kebab}', kebab);
      // Generate each file type (page, layout, etc.)
      for (const [fileType, templateFn] of Object.entries(files)) {
        writeRouteFile(rootRoutes, routePath, fileType, templateFn(slug));
      }
    }
  };

  // 3. Process common routes
  for (const [pattern, files] of Object.entries(commonRoutes)) {
    for (const [fileType, templateFn] of Object.entries(files)) {
      writeRouteFile(rootRoutes, pattern, fileType, templateFn());
    }
  }

  // 4. Process area routes
  for (const area of areas) {
    processRoutes(area.slug, area.kebab, areaRoutes);
    processRoutes(area.slug, area.kebab, areaAPIRoutes);

    if (area.versions) {
      processRoutes(area.slug, area.kebab, areaVersionsPanelRoutes);
      // Use collections API route as area_versions is a collection
      processRoutes(
        withVersionsSuffix(area.slug),
        withVersionsSuffix(area.kebab),
        collectionAPIRoutes
      );
    }
  }

  // 5. Process collection routes
  for (const collection of collections) {
    // Function that generate routes files
    const processRoutes = (slug: string, kebab: string, routes: Routes) => {
      for (const [pattern, files] of Object.entries(routes)) {
        const routePath = pattern.replace('{collection.kebab}', kebab);
        // Generate each file type (page, layout, etc.)
        for (const [fileType, templateFn] of Object.entries(files)) {
          // Check if function takes parameters before calling it
          const content = templateFn.length > 0 ? templateFn(slug) : templateFn();
          writeRouteFile(rootRoutes, routePath, fileType, content);
        }
      }
    };

    // Panel routes
    processRoutes(collection.slug, collection.kebab, collectionPanelRoutes);
    processRoutes(collection.slug, collection.kebab, collectionAPIRoutes);

    if (collection.versions) {
      processRoutes(collection.slug, collection.kebab, collectionVersionsPanelRoutes);
      processRoutes(
        withVersionsSuffix(collection.slug),
        withVersionsSuffix(collection.kebab),
        collectionAPIRoutes
      );
    }
    if (collection.upload) {
      processRoutes(
        withDirectoriesSuffix(collection.slug),
        withDirectoriesSuffix(collection.kebab),
        collectionAPIRoutes
      );
    }
  }

  // 6. Handle custom routes from config
  const customRoutes = config.panel?.routes;
  if (customRoutes) {
    for (const [route, routeConfig] of Object.entries(customRoutes)) {
      const routePath = path.join('(rime)', 'panel', route);
      writeRouteFile(rootRoutes, routePath, 'page', customRoute(routeConfig));
    }
  }

  // 7. Handle custom CSS in layout file
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
