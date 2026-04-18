import { building } from '$app/environment';
import { logger } from '$lib/core/logger/index.server.js';
import { type Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Config } from '../config/types.js';
import type { Rime } from '../rime.server.js';

export function createCMSHandler<const C extends Config>(rime: Rime<C>) {
  //
  const handleCMS: Handle = async ({ event, resolve }) => {
    //
    logger.info(`${event.request.method} ${event.url.pathname}`);
    event.locals.rime = rime.createRimeContext(event) as any;
    return svelteKitHandler({ event, resolve, auth: rime.auth, building });
  };

  return handleCMS;
}
