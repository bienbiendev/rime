import { expect, test, vi } from 'vitest';

vi.mock('$app/state', () => ({ page: {} }));
vi.mock('$app/env/public', () => ({ SITE_URL: 'https://panel.test' }));
vi.mock('svelte', async (original) => ({ ...(await original()), setContext: () => {} }));
// A seed whose relations take a while to read: the document holding `slow`
vi.mock('#lib/fields/relation/populate.js', () => ({
  populate: async (value: any) => {
    if (value?.slow) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return value;
  }
}));
const { setLiveContext, updateURI } = await import('./context.svelte.js');

const fromPanel = (data: unknown) => ({ origin: 'https://panel.test', data }) as MessageEvent;

test('a two-word slug is written as its URL segment', () => {
  const doc = { _type: 'blogPosts', _prototype: 'collection', id: 'a1' } as any;
  expect(updateURI(doc)).toBe('/blog-posts/a1');
});

test('an area has no id, and a version and a locale go in the query', () => {
  const doc = { _type: 'siteInfos', _prototype: 'area', versionId: 'v1', locale: 'fr' } as any;
  expect(updateURI(doc)).toBe('/site-infos?versionId=v1&locale=fr');
});

test('a string message from the page is ignored', async () => {
  const live = setLiveContext('https://site.test/');
  await expect(live.onMessage(fromPanel('hello'))).resolves.toBeUndefined();
});

test('updates apply in the order they arrive, a slow one included', async () => {
  const live = setLiveContext('https://site.test/');
  const seed = { update: '/pages/1', path: '', value: { slow: true, title: 'Old' } };
  const typed = { update: '/pages/1', path: 'title', value: 'New' };
  await Promise.all([live.onMessage(fromPanel(seed)), live.onMessage(fromPanel(typed))]);
  expect(live.getPanelValue('/pages/1', 'title')).toBe('New');
});
