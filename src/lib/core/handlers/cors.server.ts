import { RimeError } from '$lib/core/errors/index.js';
import { logger } from '$lib/core/logger/index.server.js';
import { error, type Handle } from '@sveltejs/kit';

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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Adds CORS headers to the response
 */
function addCorsHeaders(response: Response, origin: string): void {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
}

/**
 * Validates CORS for API routes with Origin header
 */
function validateCorsOrigin(origin: string, trustedOrigins: string[], pathname: string): void {
  if (!isOriginTrusted(origin, trustedOrigins)) {
    logger.error(`CORS violation: Origin "${origin}" not in trusted origins for ${pathname}`);
    throw error(403, RimeError.UNAUTHORIZED || 'CORS origin not allowed');
  }
}

/**
 * Handles Cross-Origin Resource Sharing (CORS) for API routes
 *
 * Only validates CORS when Origin header is present (indicating browser cross-origin request).
 * Same-origin requests and server-to-server requests don't have Origin header and are allowed.
 */
export const handleCORS: Handle = async ({ event, resolve }) => {
  const { rime } = event.locals;
  const trustedOrigins = rime.config.raw.$trustedOrigins || [];

  const IS_API_ROUTE = event.url.pathname.startsWith('/api');
  const IS_OPTIONS_REQUEST = event.request.method === 'OPTIONS';
  const origin = event.request.headers.get('origin');

  // Only handle CORS for API routes
  if (!IS_API_ROUTE) {
    return resolve(event);
  }

  // No Origin header = same-origin or server-to-server request
  // These don't need CORS validation
  if (!origin) {
    return resolve(event);
  }

  // Origin header present = browser cross-origin request
  // Validate the origin is trusted
  validateCorsOrigin(origin, trustedOrigins, event.url.pathname);

  // Handle preflight OPTIONS requests
  if (IS_OPTIONS_REQUEST) {
    return handlePreflightRequest(origin);
  }

  // Process the request
  const response = await resolve(event);

  // Add CORS headers for cross-origin requests
  addCorsHeaders(response, origin);

  return response;
};
