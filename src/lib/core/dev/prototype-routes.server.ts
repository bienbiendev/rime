import { area } from '$lib/core/prototype/area/definition.server.js';
import { collection } from '$lib/core/prototype/collection/definition.server.js';

/**
 * Every `/api` route the installed prototypes declare, as one string.
 *
 * ```
 * collection[:GET|POST|DELETE,[id]:DELETE|GET|PATCH,[id]/duplicate:POST,[id]/lock:DELETE|POST];area[...]
 * ```
 *
 * A cache key, not a route table — `generateRoutes` writes the files from the declarations
 * themselves. It is here because both memos that gate codegen need it and neither owns it: the
 * paths come from the package, so nothing in a project's own config moves when one is added, and
 * a version bump is no help inside this repo, where the version stands still between commits.
 *
 * Sorted, because `Object.keys` order is insertion order and reordering a declaration is not a
 * change to what gets written.
 */
export const restSurface = (): string =>
  [collection, area]
    .map(
      (prototype) =>
        `${prototype.name}[${Object.entries(prototype.rest || {})
          .map(([routePath, methods]) => `${routePath}:${Object.keys(methods).sort().join('|')}`)
          .sort()
          .join(',')}]`
    )
    .join(';');
