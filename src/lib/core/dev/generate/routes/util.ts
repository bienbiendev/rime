import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import cache from '$lib/core/dev/cache/index.js';
import { hasDirectoriesSuffix, hasVersionsSuffix } from '$lib/core/naming.js';
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
 * Check if routes need to be regenerated based on config changes
 * @returns true if routes should be regenerated, false otherwise
 * @example
 * // Check if routes need to be regenerated
 * const config = { areas: [], collections: [], panel: { css: 'styles.css' } };
 * const needsRegeneration = shouldRegenerateRoutes(config);
 * // If the config has changed since last run, needsRegeneration will be true
 */
export function shouldRegenerateRoutes<T extends Config>(config: T): boolean {
  const versionsSuffix = (document: any) => (document.versions ? '.v' : '');
  const authSuffix = (collection: BuiltCollection) =>
    collection.auth ? `.${collection.auth.type}` : '';

  const memo = `
    areas:${(config.areas || []).map((area) => `${area.slug}${versionsSuffix(area)}`).join(',')}
    collections:${(config.collections || []).map((collection) => `${collection.slug}${authSuffix(collection)}${versionsSuffix(collection)}`).join(',')}
    custom:${
      config.panel?.routes
        ? Object.entries(config.panel.routes)
            .map(([k, v]) => `${k}-${slugify(v.component.toString())}`)
            .join(',')
        : ''
    }
    css:${config.panel?.css ? config.panel.css : 'none'}
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

/**
 * Cast slug in generated templates for document with versions
 * in order to prevent TS error that slug_versions is not a collection/area
 *
 * @example
 * castVersionSlug('pages_versions')
 * // output : 'pages_versions' as any
 * export const GET = api.collection.get('pages_versions' as any)
 */
export const TScastVersionSlug = (slug: string) =>
  hasVersionsSuffix(slug) || hasDirectoriesSuffix(slug) ? `'${slug}' as any` : `'${slug}'`;
