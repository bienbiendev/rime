import type { RequestEvent } from '@sveltejs/kit';

/** What an author writes under `cache`. */
export type CacheConfig = { isEnabled?: (event: RequestEvent) => boolean };
