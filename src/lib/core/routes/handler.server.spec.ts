import { describe, expect, it, vi } from 'vitest';
import { handleRoutes, routeHandlers } from './handler.server.js';

// A collection whose list answers GET alone
vi.mock('#lib/core/prototype/collection/definition.server.js', () => ({
  collection: { rest: { '': { GET: () => new Response('list') } } }
}));
vi.mock('#lib/core/prototype/area/definition.server.js', () => ({ area: { rest: {} } }));

/** A `method` request on `pathname`, the config declaring `$routes`. */
const eventFor = (method: string, pathname: string, $routes: object = {}) =>
  ({
    request: new Request(`https://site.com${pathname}`, { method }),
    url: new URL(`https://site.com${pathname}`),
    locals: { rime: { routes: { isPanel: false }, config: { raw: { $routes } } } }
  }) as any;

describe('HEAD', () => {
  it('is answered by the GET handler of a REST route', async () => {
    const response = await routeHandlers.rest('collection', '', eventFor('HEAD', '/api/pages'));
    expect(await response.text()).toBe('list');
  });

  it('is answered by the GET handler of a declared route', async () => {
    const event = eventFor('HEAD', '/hello', { '/hello': { GET: () => new Response('hi') } });
    const resolve = vi.fn(async () => new Response(null, { status: 404 }));

    const response = await handleRoutes({ event, resolve } as never);

    expect(response.status).toBe(200);
    expect(resolve).not.toHaveBeenCalled();
  });
});
