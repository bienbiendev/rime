import { afterEach, expect, test, vi } from 'vitest';

vi.mock('svelte', async (original) => ({
  ...(await original()),
  setContext: (_key: unknown, value: unknown) => value
}));
const { setAPIProxyContext } = await import('./api-proxy.svelte.js');

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a refresh answered late does not overwrite a newer one', async () => {
  // Each fetch answers when the test calls its `answer`, in the order the fetches started
  const answers: Array<(body: unknown) => void> = [];
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise((resolve) => {
        answers.push((body) => resolve(new Response(JSON.stringify(body))));
      })
  );
  const proxy = setAPIProxyContext(() => undefined);
  const versions = proxy.getRessource('/api/pages--versions');
  proxy.invalidate('/api/pages');

  // The refresh answers first, the first fetch after it
  answers[1]({ docs: ['saved'] });
  await vi.waitFor(() => expect(versions.isLoading).toBe(false));
  answers[0]({ docs: ['auto-saved'] });
  await new Promise((resolve) => setTimeout(resolve));

  expect(versions.data).toEqual({ docs: ['saved'] });
});
