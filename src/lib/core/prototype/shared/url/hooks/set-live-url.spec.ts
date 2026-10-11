import { describe, expect, test, vi } from 'vitest';

vi.mock('$app/env/private', () => ({ RIME_PANEL_ROUTE: 'panel' }));
const env = vi.hoisted(() => ({ siteUrl: 'https://site.com' }));
vi.mock('$app/env/public', () => ({
  get SITE_URL() {
    return env.siteUrl;
  }
}));

const { setLiveUrl } = await import('./set-live-url.server.js');

const run = async (doc: Record<string, unknown>, locale?: string) => {
  const args = {
    config: { slug: 'pages', live: true },
    event: { locals: { user: { isStaff: true } } },
    context: { params: { locale } },
    doc
  };
  const result = await setLiveUrl(args as any);
  return new URL(result.doc._live!);
};

describe('setLiveUrl', () => {
  test('a url with a fragment stays whole in src, and slug and id follow', async () => {
    const live = await run({ id: '1', url: 'https://site.com/faq#top' });

    expect(live.pathname).toBe('/panel/live-edit');
    expect(live.searchParams.get('src')).toBe('https://site.com/faq#top');
    expect(live.searchParams.get('slug')).toBe('pages');
    expect(live.searchParams.get('id')).toBe('1');
  });

  test('a url with a query keeps it in src', async () => {
    const live = await run({ id: '1', url: 'https://site.com/news?page=2&sort=asc' }, 'fr');

    expect(live.searchParams.get('src')).toBe('https://site.com/news?page=2&sort=asc');
    expect(live.searchParams.get('locale')).toBe('fr');
  });

  test('a SITE_URL ending in a slash joins on one slash', async () => {
    env.siteUrl = 'https://site.com/';
    const live = await run({ id: '1', url: 'https://site.com/faq' });
    env.siteUrl = 'https://site.com';

    expect(live.pathname).toBe('/panel/live-edit');
  });
});
