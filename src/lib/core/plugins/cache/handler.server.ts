import { RIME_CACHE_ENABLED } from '$app/env/private';
import type { Handle } from '@sveltejs/kit/hooks';

/**
 * Turns the cache on for an anonymous GET outside the panel, when `RIME_CACHE_ENABLED` is on
 * (`isEnabled` decides who counts as anonymous), and gives a 200 answer a `cache-control` when the
 * route set none.
 */
export const handler: Handle = async ({ event, resolve }) => {
  const { rime } = event.locals;

  event.locals.cacheEnabled = false;

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return await resolve(event);
  }

  // Do not cache if RIME_CACHE_ENABLED is off
  if (!RIME_CACHE_ENABLED) {
    return await resolve(event);
  }

  // Do not cache panel routes
  if (event.params.panel !== undefined) {
    return await resolve(event);
  }

  // The cache plugin's `isEnabled` option decides (by default: no signed-in user).
  if (!rime.cache.isEnabled(event)) {
    return await resolve(event);
  }

  event.locals.cacheEnabled = true;
  const response = await resolve(event);

  // A route that sets its own cache-control keeps it. A page read without a session is kept by
  // the browser for an hour, and read again once the cookies change (a sign-in, a locale).
  // A redirect or an error is never kept.
  if (response.status === 200 && !response.headers.has('cache-control')) {
    response.headers.set('cache-control', 'private, max-age=3600');
    response.headers.append('vary', 'Cookie');
  }

  return response;
};

declare global {
  namespace App {
    interface Locals {
      cacheEnabled: boolean;
    }
  }
}
