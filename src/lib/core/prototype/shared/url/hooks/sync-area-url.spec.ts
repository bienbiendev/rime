import { describe, expect, it, vi } from 'vitest';
import { refreshAreaUrls } from '../area.server.js';

vi.mock('../area.server.js', () => ({
  refreshAreaUrls: vi.fn(async () => [
    { ownerId: 'i1', locale: 'fr', url: 'https://site.com/fr/about' },
    { ownerId: 'i1', locale: 'en', url: 'https://site.com/en/about' }
  ])
}));

const { syncAreaUrl } = await import('./sync-area-url.server.js');

const run = (params: Record<string, unknown>) =>
  syncAreaUrl({
    event: {},
    config: { slug: 'infos' },
    doc: { id: 'i1', locale: 'en', url: 'https://site.com/stale' },
    context: { params }
  } as any);

describe('syncAreaUrl', () => {
  it('writes the url in every locale and answers the document with its own', async () => {
    vi.mocked(refreshAreaUrls).mockClear();
    const result = await run({ locale: 'en' });
    expect(refreshAreaUrls).toHaveBeenCalledOnce();
    expect(result.doc.url).toBe('https://site.com/en/about');
  });

  it('changes no url on an auto-save', async () => {
    vi.mocked(refreshAreaUrls).mockClear();
    const result = await run({ locale: 'en', autoSave: true });
    expect(refreshAreaUrls).not.toHaveBeenCalled();
    expect(result.doc.url).toBe('https://site.com/stale');
  });
});
