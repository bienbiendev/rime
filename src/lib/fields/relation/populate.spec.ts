import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { populate } from './populate.js';

const docs: Record<string, unknown> = {
  '/api/medias/m1?depth=1': { doc: { id: 'm1', title: 'Photo', url: '/medias/m1' } },
  '/api/pages/p1?depth=1': { doc: { id: 'p1', title: 'Home', url: '/home' } }
};

const fetchMock = vi.fn(async (url: string) => ({ json: async () => docs[url] ?? {} }));

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  populate.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe('populate', () => {
  it('replaces a relation by its document', async () => {
    const result = await populate({ relationTo: 'medias', documentId: 'm1' });
    expect(result).toEqual({ id: 'm1', title: 'Photo', url: '/medias/m1' });
  });

  it('walks arrays and objects', async () => {
    const result = await populate({
      title: 'Page',
      images: [{ relationTo: 'medias', documentId: 'm1' }],
      nested: { link: { relationTo: 'pages', documentId: 'p1' } }
    });
    expect(result).toEqual({
      title: 'Page',
      images: [{ id: 'm1', title: 'Photo', url: '/medias/m1' }],
      nested: { link: { id: 'p1', title: 'Home', url: '/home' } }
    });
  });

  it('requests a document once', async () => {
    await populate([
      { relationTo: 'medias', documentId: 'm1' },
      { relationTo: 'medias', documentId: 'm1' }
    ]);
    await populate({ relationTo: 'medias', documentId: 'm1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('takes a livePreview as is', async () => {
    const livePreview = { id: 'm1', title: 'Draft' };
    const result = await populate({ relationTo: 'medias', documentId: 'm1', livePreview });
    expect(result).toBe(livePreview);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives a resource link its url, and leaves a plain url alone', async () => {
    const resource = { type: 'pages', value: 'p1', target: '_self' };
    const url = { type: 'url', value: 'https://example.com', target: '_blank' };
    expect(await populate(resource)).toEqual({ ...resource, url: '/home' });
    expect(await populate(url)).toEqual(url);
  });

  it('keeps the reference when the request fails, and does not retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ref = { relationTo: 'medias', documentId: 'm1' };
    expect(await populate(ref)).toEqual(ref);
    expect(await populate(ref)).toEqual(ref);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns primitives and nulls as they are', async () => {
    expect(await populate('text')).toBe('text');
    expect(await populate(null)).toBe(null);
    expect(await populate(undefined)).toBe(undefined);
  });
});
