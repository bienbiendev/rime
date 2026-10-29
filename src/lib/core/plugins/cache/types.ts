import type { RequestEvent } from '@sveltejs/kit';

/** What an author writes under `cache`. */
export type CacheConfig = {
  /**
   * Whether the API cache is on for a request. Only GET requests from non-panel routes are cached.
   *
   * @example
   * isEnabled: (event) => !event.locals.user // default
   */
  isEnabled?: (event: RequestEvent) => boolean;
};
