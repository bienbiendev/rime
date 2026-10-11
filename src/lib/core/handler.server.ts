import { building, dev } from '$app/env';
import { handleAuth } from '#lib/core/auth/handler/index.server.js';
import { handleCORS } from '#lib/core/cors/handler.server.js';
import { logger } from '#lib/core/logger.server.js';
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import type { Config } from './config/types.js';
import { createPluginsHandler } from './plugins/plugins.server.js';
import { handleUploads } from './prototype/collection/upload/handler.server.js';
import { ensureAddresses } from './prototype/shared/url/addresses.server.js';
import type { Rime } from './rime.server.js';
import { handleRoutes } from './routes/handler.server.js';

/** `200 GET /panel/pages`. In dev only to the log file: SvelteKit prints every response itself. */
function logResponse(event: RequestEvent, status: number) {
  const { pathname, search } = event.url;
  logger.response(status, `${event.request.method} ${pathname}${search}`, { console: !dev });
}

function createCMSHandler<const C extends Config>(rime: Rime<C>) {
  const handleCMS: Handle = async ({ event, resolve }) => {
    event.locals.rime = rime.createRimeContext(event) as any;
    // Once per process: every `$url` page missing an address gets one.
    if (!building) await ensureAddresses(event);
    const response = await svelteKitHandler({ event, resolve, auth: rime.auth, building }).catch(
      (err) => {
        // Thrown by a later handle step, as handleAuth does: SvelteKit answers it
        logResponse(event, isHttpError(err) || isRedirect(err) ? err.status : 500);
        throw err;
      }
    );
    logResponse(event, response.status);
    return response;
  };

  return handleCMS;
}

export default async function <const C extends Config>(rime: Promise<Rime<C>>) {
  return [
    createCMSHandler(await rime),
    handleCORS,
    handleAuth,
    // After the user is known: a private collection's file goes to its readers only
    handleUploads,
    ...createPluginsHandler(await rime),
    handleRoutes
  ];
}
