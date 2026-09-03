import type { Collection } from '$lib/core/factory/config/types.js';
import type { OmitPreservingDiscrimination } from '$lib/util/types.js';

export type CollectionWithoutSlug<S> = OmitPreservingDiscrimination<Collection<S>, 'slug'>;
