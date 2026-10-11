import { afterEach, describe, expect, test, vi } from 'vitest';
import { trycatchFetch } from './function.js';

describe('trycatchFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** `fetch` answering `body` with `status`. */
  const answering = (body: string, status: number) =>
    vi.stubGlobal('fetch', async () => new Response(body, { status }));

  test('answers the message of an error body', async () => {
    answering(JSON.stringify({ message: 'Nope' }), 403);
    const [error] = await trycatchFetch('/api/x');
    expect(error?.message).toBe('Nope');
  });

  test('answers the status when the error body is not JSON', async () => {
    answering('<h1>Down</h1>', 502);
    const [error] = await trycatchFetch('/api/x');
    expect(error?.message).toBe('HTTP error! Status: 502');
  });

  test('answers the response when it is ok', async () => {
    answering(JSON.stringify({ docs: [] }), 200);
    const [error, response] = await trycatchFetch('/api/x');
    expect(error).toBeNull();
    expect(await response.json()).toEqual({ docs: [] });
  });

  test('answers the error of a request that never reached the server', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    const [error] = await trycatchFetch('/api/x');
    expect(error?.message).toBe('fetch failed');
  });
});
