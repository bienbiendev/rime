import { building } from '$app/environment';
import { handleAuth } from '$lib/core/auth/handler/index.server.js';
import { handleCORS } from '$lib/core/cors/handler.server.js';
import { logger } from '$lib/core/logger.server.js';
import { type Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Config } from './config/types.js';
import { createPluginsHandler } from './plugins/plugins.server.js';
import type { Rime } from './rime.server.js';
import { handleRoutes } from './routes/handler.server.js';

function createCMSHandler<const C extends Config>(rime: Rime<C>) {
  const handleCMS: Handle = async ({ event, resolve }) => {
    logger.info(`${event.request.method} ${event.url.pathname}`);
    event.locals.rime = rime.createRimeContext(event) as any;
    return svelteKitHandler({ event, resolve, auth: rime.auth, building });
  };

  return handleCMS;
}

export default async function <const C extends Config>(rime: Promise<Rime<C>>) {
  return [
    createCMSHandler(await rime),
    handleCORS,
    handleAuth,
    ...createPluginsHandler(await rime),
    handleRoutes
  ];
}
