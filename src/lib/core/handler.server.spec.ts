import { expect, test, vi } from 'vitest';
import { ensureAddresses } from './prototype/shared/url/addresses.server.js';

vi.mock('$app/env', () => ({ building: false, dev: true }));
vi.mock('./logger.server.js', () => ({ logger: { response: () => {} } }));
vi.mock('./prototype/shared/url/addresses.server.js', () => ({ ensureAddresses: vi.fn() }));

const { default: createHandles } = await import('./handler.server.js');

const eventOf = (isSubRequest: boolean) =>
  ({
    isSubRequest,
    url: new URL('http://localhost/api/agenda'),
    request: new Request('http://localhost/api/agenda'),
    locals: {}
  }) as any;

test("a sub-request is answered while the first request's address backfill is pending", async () => {
  // The backfill waits on a beforeRead hook that fetches the app's own `/api/agenda`
  let finish = () => {};
  vi.mocked(ensureAddresses).mockImplementation(
    () => new Promise<void>((resolve) => (finish = () => resolve()))
  );
  const rime = { createRimeContext: () => ({}), config: { raw: { plugins: [] } } } as any;
  const [handleCMS] = await createHandles(Promise.resolve(rime));
  const resolve = async () => new Response('ok');

  const first = handleCMS({ event: eventOf(false), resolve });
  const sub = await handleCMS({ event: eventOf(true), resolve });

  expect(sub.status).toBe(200);
  expect(ensureAddresses).toHaveBeenCalledOnce();
  finish();
  expect((await first).status).toBe(200);
});
