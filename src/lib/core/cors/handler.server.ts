import { RimeError } from '#lib/core/errors/index.js';
import { logger } from '#lib/core/logger.server.js';
import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

/**
 * Validates if the origin is in the trusted origins list
 */
function isOriginTrusted(origin: string, trustedOrigins: string[]): boolean {
  return trustedOrigins.includes(origin);
}

/**
 * Handles preflight OPTIONS requests for CORS
 */
function handlePreflightRequest(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Origin': origin,
      // A credentialed request is sent only when its preflight allows credentials too
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    }
  });
}

/** The CORS headers of a trusted origin's answer. */
function addCorsHeaders(response: Response, origin: string): void {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
}

/**
 * Every API answer depends on `Origin`, whether or not the request sent one, so a shared cache
 * never hands one origin's answer to another.
 */
function varyByOrigin(response: Response): Response {
  response.headers.append('Vary', 'Origin');
  return response;
}

/**
 * Validates CORS for API routes with Origin header
 */
function validateCorsOrigin(origin: string, trustedOrigins: string[], pathname: string): void {
  if (!isOriginTrusted(origin, trustedOrigins)) {
    logger.error(`CORS violation: Origin "${origin}" not in trusted origins for ${pathname}`);
    throw error(403, RimeError.UNAUTHORIZED);
  }
}

/**
 * Refuses an API request whose `Origin` is not trusted, answers its preflight, and adds the CORS
 * headers to its response. A browser sends `Origin` on every cross-origin request and on a
 * same-origin `POST`, `PATCH` or `DELETE`, which is why the site's own origin is always in the
 * list. A request with no `Origin` (a server, a same-origin `GET`) passes.
 */
export const handleCORS: Handle = async ({ event, resolve }) => {
  const { rime } = event.locals;
  // Always a list by here: `./configure.server.ts` defaults it.
  const trustedOrigins = rime.config.raw.$trustedOrigins;

  const { isAPI } = event.locals.rime.routes;
  const IS_OPTIONS_REQUEST = event.request.method === 'OPTIONS';
  const origin = event.request.headers.get('origin');

  // Only handle CORS for API routes
  if (!isAPI) {
    return resolve(event);
  }

  // No Origin header: a server, or a same-origin GET
  if (!origin) {
    return varyByOrigin(await resolve(event));
  }

  // A browser request, cross-origin or a same-origin write: the origin has to be trusted
  validateCorsOrigin(origin, trustedOrigins, event.url.pathname);

  // Handle preflight OPTIONS requests
  if (IS_OPTIONS_REQUEST) {
    return handlePreflightRequest(origin);
  }

  // Process the request
  const response = await resolve(event);

  // Add CORS headers for cross-origin requests
  addCorsHeaders(response, origin);

  return varyByOrigin(response);
};
