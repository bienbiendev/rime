import type { RelationValue } from '$lib/fields/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFetchedDocs } from './fetch.js';
import { Relation } from './relation.js';

type Doc = { id: string; _type: string; alt?: string };

const m1: Doc = { id: 'm1', _type: 'medias', alt: 'One' };
const m2: Doc = { id: 'm2', _type: 'medias', alt: 'Two' };
const ref1 = { relationTo: 'medias', documentId: 'm1' };
const ref2 = { relationTo: 'medias', documentId: 'm2' };

const docs: Record<string, unknown> = {
  '/api/medias/m1?depth=1': { doc: m1 },
  '/api/medias/m2?depth=1': { doc: m2 }
};
const fetchMock = vi.fn(async (url: string) => ({ json: async () => docs[url] ?? {} }));

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  clearFetchedDocs();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

/** In the browser: what fetches a ref. */
const inBrowser = () => vi.stubGlobal('window', {});

describe('Relation.resolve', () => {
  it('gives nothing for an empty value, at once', () => {
    for (const value of [null, undefined, false, [], [null]] as const) {
      expect(Relation.resolve<Doc>(value as never).first()).toBe(null);
      expect(Relation.resolve<Doc>(value as never).all()).toEqual([]);
    }
  });

  it('gives nothing for bare ids: they name no collection', () => {
    // Not a read's shape: a write's, or a default before the server takes it.
    expect(Relation.resolve<Doc>('m1' as never).all()).toEqual([]);
    expect(Relation.resolve<Doc>(['m1', 'm2'] as never).first()).toBe(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives documents as they are, at once', () => {
    expect(Relation.resolve([m1, m2]).all()).toEqual([m1, m2]);
    expect(Relation.resolve([m1, m2]).first()).toBe(m1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('takes a document outside an array', () => {
    expect(Relation.resolve(m1).all()).toEqual([m1]);
    expect(Relation.resolve<Doc>(ref1).first()).toBeInstanceOf(Promise);
  });

  it('fetches refs in the browser, in their order', async () => {
    inBrowser();
    const all = Relation.resolve<Doc>([ref2, ref1]).all();
    expect(all).toBeInstanceOf(Promise);
    expect(await all).toEqual([m2, m1]);
    expect(await Relation.resolve<Doc>([ref1]).first()).toEqual(m1);
    expect(fetchMock).toHaveBeenCalledWith('/api/medias/m1?depth=1');
  });

  it('fetches only the refs when documents and refs are mixed', async () => {
    inBrowser();
    const mixed = [m1, ref2] as RelationValue<Doc>;
    expect(await Relation.resolve(mixed).all()).toEqual([m1, m2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves out a ref that cannot be fetched', async () => {
    inBrowser();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await Relation.resolve<Doc>([ref1, ref2]).all()).toEqual([m2]);
  });

  it('gives a live preview as it is, at once', () => {
    const draft = { id: 'm1', _type: 'medias', alt: 'Draft' };
    const live: RelationValue<Doc> = [{ ...ref1, livePreview: draft } as typeof ref1];
    expect(Relation.resolve(live).first()).toBe(draft);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch during server rendering: the promise stays pending', async () => {
    const all = Relation.resolve<Doc>([ref1]).all();
    expect(all).toBeInstanceOf(Promise);
    const settled = await Promise.race([
      all,
      new Promise((done) => setTimeout(done, 10, 'pending'))
    ]);
    expect(settled).toBe('pending');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Relation.isRef', () => {
  it('tells a ref from a document', () => {
    expect(Relation.isRef(ref1)).toBe(true);
    expect(Relation.isRef({ ...ref1, id: 'row', _type: 'medias' })).toBe(true);
    expect(Relation.isRef(m1)).toBe(false);
    expect(Relation.isRef('m1')).toBe(false);
    expect(Relation.isRef(null)).toBe(false);
  });
});
