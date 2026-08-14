import type { Config } from '$lib/core/config/types.js';
import cache from '$lib/core/dev/cache/index.server.js';
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
 * grows with schema size), but the [slug=collection]/[slug=area] param
 * matchers under src/params/ bake in the actual slug lists, so adding,
 * removing, or renaming a collection/area still needs a regen to keep those
 * matchers in sync — same trigger as custom routes and panel CSS.
 * @returns true if routes should be regenerated, false otherwise
 */
export function shouldRegenerateRoutes<T extends Config>(config: T): boolean {
  const memo = `
    custom:${
      config.panel?.routes
        ? Object.entries(config.panel.routes)
            .map(([k, v]) => `${k}-${slugify(v.component.toString())}`)
            .join(',')
        : ''
    }
    css:${config.panel?.css ? config.panel.css : 'none'}
    collections:${(config.collections || []).map((c) => c.slug).join(',')}
    areas:${(config.areas || []).map((a) => a.slug).join(',')}
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
 * const routePath = '(rime)/panel/news';
 * const fileType = 'page';
 * const content = '<script>\n  import { Collection } from "rime/panel"\n</script>...';
 * writeRouteFile(basePath, routePath, fileType, content);
 * // Creates /path/to/src/routes/(rime)/panel/news/+page.svelte with the provided content
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
