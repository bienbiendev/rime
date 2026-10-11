import { describe, expect, it, vi } from 'vitest';
import { handler } from './handler.server.js';

vi.mock('$app/env/private', () => ({ RIME_CACHE_ENABLED: true }));

/** An anonymous site GET the cache plugin takes. */
const event = () =>
  ({
    request: { method: 'GET' },
    params: {},
    locals: { rime: { cache: { isEnabled: () => true } } }
  }) as any;

describe('cache handler', () => {
  it('keeps a cache-control the route set', async () => {
    const response = await handler({
      event: event(),
      resolve: async () => new Response('', { headers: { 'cache-control': 'no-store' } })
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('gives a page a private max-age that varies with the cookies', async () => {
    const response = await handler({ event: event(), resolve: async () => new Response('') });
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(response.headers.get('vary')).toContain('Cookie');
  });

  it('adds nothing to a redirect or an error', async () => {
    for (const status of [302, 404, 500]) {
      const headers: Record<string, string> = status === 302 ? { location: '/login' } : {};
      const response = await handler({
        event: event(),
        resolve: async () => new Response('', { status, headers })
      });
      expect(response.headers.get('cache-control')).toBeNull();
    }
  });
});
