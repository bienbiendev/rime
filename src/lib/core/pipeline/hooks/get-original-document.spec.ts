import { describe, expect, it } from 'vitest';
import { getOriginalDocument } from './get-original-document.server.js';

/**
 * A request whose caller API refuses every read, and whose system API answers `stored`. Each
 * system read lands in `calls`, with the slug it was made on.
 */
const eventWith = (stored: object) => {
  const calls: object[] = [];
  const refused = async () => {
    throw new Error('unauthorized');
  };
  const answer = (slug: string) => async (args: object) => {
    calls.push({ slug, ...args });
    return stored;
  };
  const api = (slug: string, system: boolean) => ({
    system: (isSystem = true) => api(slug, isSystem),
    findById: system ? answer(slug) : refused,
    find: system ? answer(slug) : refused
  });
  const rime = {
    collection: (slug: string) => api(slug, false),
    area: (slug: string) => api(slug, false)
  };
  return { event: { locals: { rime } } as any, calls };
};

/** The update of `slug`, a config of `type`, with `params`. */
const updateOf = (event: unknown, type: string, slug: string, params: object) =>
  ({ event, config: { type, slug }, context: { params }, operation: 'update', data: {} }) as any;

describe('getOriginalDocument', () => {
  it('reads the document as rime, whatever the caller may read', async () => {
    const stored = { id: 'o1', title: 'T' };
    for (const type of ['collection', 'area']) {
      const { event } = eventWith(stored);
      const args = await getOriginalDocument(updateOf(event, type, 'orders', { id: 'o1' }));
      expect(args.context.originalDoc).toEqual(stored);
    }
  });

  it('reads the document, locale, version and latest flag the update names', async () => {
    const params = { id: 'o1', locale: 'fr', versionId: 'v2', latest: true };

    const collection = eventWith({});
    await getOriginalDocument(updateOf(collection.event, 'collection', 'orders', params));
    expect(collection.calls).toEqual([
      { slug: 'orders', locale: 'fr', id: 'o1', versionId: 'v2', latest: true }
    ]);

    const area = eventWith({});
    await getOriginalDocument(updateOf(area.event, 'area', 'settings', params));
    expect(area.calls).toEqual([{ slug: 'settings', locale: 'fr', versionId: 'v2', latest: true }]);
  });
});
