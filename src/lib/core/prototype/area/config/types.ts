import type { Area } from '$lib/core/config/types.js';
import type { OmitPreservingDiscrimination } from '$lib/util/types.js';

export type AreaWithoutSlug<S> = OmitPreservingDiscrimination<Area<S>, 'slug'>;
