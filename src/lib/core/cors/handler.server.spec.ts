import { describe, expect, it } from 'vitest';
import { handleCORS } from './handler.server.js';

/** An API request from `origin`, or with no `Origin`, the site trusting https://app.example.com. */
const request = (method: string, origin: string | null = 'https://app.example.com') => {
  const event = {
    request: new Request('https://site.com/api/pages', {
      method,
      headers: origin ? { origin } : {}
    }),
    url: new URL('https://site.com/api/pages'),
    locals: {
      rime: {
        config: { raw: { $trustedOrigins: ['https://site.com', 'https://app.example.com'] } },
        routes: { isAPI: true }
      }
    }
  };
  return handleCORS({
    event,
    resolve: async () => new Response('[]', { headers: { 'cache-control': 'max-age=3600' } })
  } as never) as Promise<Response>;
};

describe('handleCORS', () => {
  it("varies a trusted origin's answer by origin, so a shared cache keeps them apart", async () => {
    const response = await request('GET');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('varies the preflight answer by origin too', async () => {
    const response = await request('OPTIONS');
    expect(response.status).toBe(204);
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('varies an answer to a request with no Origin too, which a cache could hand to one with', async () => {
    const response = await request('GET', null);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('vary')).toBe('Origin');
  });
});
