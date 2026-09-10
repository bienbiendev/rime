import type { Collection } from '$lib/core/config/types.js';
import type { OmitPreservingDiscrimination } from '$lib/util/types.js';

export type CollectionWithoutSlug<S> = OmitPreservingDiscrimination<Collection<S>, 'slug'>;

/** What a collection is called, in the panel and in a form. */
export type CollectionLabel = {
  singular: string;
  plural: string;
  /** Label to search document, ex: Search for pages... */
  search?: string;
  /** Label for creation ex: New page */
  create?: string;
  /** Label when no document found, ex: No pages found */
  none?: string;
};
