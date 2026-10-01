import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/server', () => ({
  getRequestEvent: () => ({ request: { headers: new Headers() } })
}));
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_RIME_URL: 'http://rime.test' } }));

const { ensureRelationExists } = await import('./module.server.js');

/** `u1` and `u2` exist, any other id does not. */
const fetchMock = vi.fn(async (url: string) => {
  const id = url.split('/').pop()!.split('?')[0];
  const exists = ['u1', 'u2'].includes(id);
  return {
    ok: exists,
    status: exists ? 200 : 404,
    json: async () => ({ doc: exists ? { id } : null })
  };
});

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

const ensure = (value: unknown) =>
  ensureRelationExists(value as never, { config: { relationTo: 'users' } } as never);

describe('ensureRelationExists', () => {
  it('keeps the ids and refs that name a document', async () => {
    expect(await ensure(['u1', 'x'])).toEqual(['u1']);
    expect(await ensure([{ relationTo: 'users', documentId: 'u2' }])).toEqual([
      { relationTo: 'users', documentId: 'u2' }
    ]);
  });

  it('keeps a document sent back, read at depth 1', async () => {
    const doc = { id: 'u1', _type: 'users', name: 'Ann' };
    expect(await ensure([doc])).toEqual([doc]);
  });

  it('reads one value outside an array as a list of one', async () => {
    expect(await ensure('u1')).toEqual(['u1']);
    expect(await ensure({ relationTo: 'users', documentId: 'u1' })).toEqual([
      { relationTo: 'users', documentId: 'u1' }
    ]);
  });

  it('skips a null element', async () => {
    expect(await ensure([null, 'u1'])).toEqual(['u1']);
  });
});
