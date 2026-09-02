import cache from '$lib/core/dev/cache.server.js';
import { CONFIG_DIR, PANEL_ROUTE } from '$lib/core/dev/constants.server.js';
import type { Config } from '$lib/core/factory/config/types.js';
import { slugify } from '$lib/util/string.js';
import fs from 'fs';
import path from 'path';

/**
 * Types for route definitions
 */
export type RouteTemplateFunction<T extends any[] = any[]> = (...args: T) => string;
export type RouteDefinition = Record<string, RouteTemplateFunction>;
export type Routes = Record<string, RouteDefinition>;

/**
 * Check if routes need to be regenerated based on config changes.
 * Panel/API routes are a fixed set of dynamic-segment files (file count never
 * grows with schema size), but the [panel=panel]/[slug=<prototype>] param
 * matchers under src/params/ bake in the actual accepted value(s), so
 * changing RIME_PANEL_ROUTE or RIME_CONFIG_DIR, or adding/removing/renaming a
 * prototype, still needs a regen to keep those matchers in sync — same
 * trigger as custom routes and panel CSS. Both PANEL_ROUTE and CONFIG_DIR must
 * stay in this memo: they're read once at process start, so a changed value
 * only takes effect after a restart, and only if the restart's regen actually
 * notices the change. CONFIG_DIR specifically is baked into the panel/live
 * layout's config import path (see configImportPaths() calls in
 * common.server.ts) — leaving it out would silently keep that import stale
 * instead of erroring, the same failure mode RIME_CONFIG_DIR hit once for
 * hooks.server.ts (see regenerateHooks() in cli/init/templates.ts).
 * @returns true if routes should be regenerated, false otherwise
 */
export function shouldRegenerateRoutes<T extends Config>(config: T): boolean {
  const memo = `
    panel:${PANEL_ROUTE}
    config:${CONFIG_DIR}
    custom:${
      config.panel?.routes
        ? Object.entries(config.panel.routes)
            .map(([k, v]) => `${k}-${slugify(v.component.toString())}`)
            .join(',')
        : ''
    }
    css:${config.panel?.css ? config.panel.css : 'none'}
    prototypes:${[...(config.collections || []), ...(config.areas || [])]
      .map((p) => `${p.type}:${p.slug}`)
      .join(',')}
  `;

  const cachedMemo = cache.get('routes');

  if (cachedMemo && cachedMemo === memo) {
    return false;
  }

  cache.set('routes', memo);
  return true;
}

/**
 * Creates a directory if it doesn't exist
 * @example
 * // Ensure a directory exists
 * const dirPath = '/path/to/directory';
 * ensureDir(dirPath);
 * // The directory will be created if it doesn't exist
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Writes a route file with its content
 * @param basePath The base path where routes are generated
 * @param routePath The specific route path
 * @param fileType The type of file to generate (page, pageServer, layout, layoutServer)
 * @param content The content to write to the file
 * @example
 * // Write a page file for a collection
 * const basePath = '/path/to/src/routes';
 * const routePath = '(rime)/[panel=panel]/news';
 * const fileType = 'page';
 * const content = '<script>\n  import { Collection } from "rime/panel"\n</script>...';
 * writeRouteFile(basePath, routePath, fileType, content);
 * // Creates /path/to/src/routes/(rime)/[panel=panel]/news/+page.svelte with the provided content
 */
export function writeRouteFile(
  basePath: string,
  routePath: string,
  fileType: string,
  content: string
): void {
  const dir = path.join(basePath, routePath);
  ensureDir(dir);

  let fileName: string;
  let baseType = fileType;
  let groupName = '';

  // Check if fileType contains a group name after @
  if (fileType.includes('@')) {
    const parts = fileType.split('@');
    baseType = parts[0];
    groupName = parts[1];
  }

  if (baseType === 'layout') {
    fileName = '+layout.svelte';
  } else if (baseType === 'layoutServer') {
    fileName = '+layout.server.ts';
  } else if (baseType === 'page') {
    fileName = '+page.svelte';
  } else if (baseType === 'pageServer') {
    fileName = '+page.server.ts';
  } else if (baseType === 'error') {
    fileName = '+error.svelte';
  } else if (baseType === 'server') {
    fileName = '+server.ts';
  } else {
    fileName = `+${baseType}.svelte`;
  }

  // Insert group name before the first dot if a group name exists
  if (groupName) {
    const dotIndex = fileName.indexOf('.');
    if (dotIndex !== -1) {
      fileName = fileName.substring(0, dotIndex) + '@' + groupName + fileName.substring(dotIndex);
    }
  }

  fs.writeFileSync(path.join(dir, fileName), content);
}
