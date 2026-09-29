import type { DocTypeContribution } from '$lib/core/dev/codegen/types/contributions.server.js';

/**
 * A document of a config with `$url` carries its url. A collection's also carries its address:
 * the slugs down to it and its own slug. `null` until the page has one.
 */
export const urlDocType = (type: 'collection' | 'area'): DocTypeContribution => ({
  members:
    type === 'collection'
      ? ['url: string | null', '_urlPath: string | null', '_slug: string | null']
      : ['url: string | null']
});
