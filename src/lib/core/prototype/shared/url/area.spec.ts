import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/public', () => ({ SITE_URL: 'https://site.com' }));

const { refreshAreaUrls } = await import('./area.server.js');

/**
 * `infos` in fr and en, whose fr row is stored and en row is not, over a paths handle of spies.
 * Its `$url` reads a field, so the url says which document it was formatted from.
 */
const setup = () => {
  const $url = vi.fn(
    ({ locale, doc }: { locale: string; doc: { email?: string } }) =>
      `/${locale}/${doc.email ? 'contact' : 'about'}`
  );
  const config = { slug: 'infos', type: 'area', $url } as any;
  const find = vi.fn(async ({ locale }: { locale?: string }) => ({
    id: 'i1',
    email: locale === 'fr' ? 'a@b.fr' : undefined
  }));
  const paths = {
    get: vi.fn(async ({ locale }: { locale: string }) =>
      locale === 'fr' ? [{ ownerId: 'i1', locale: 'fr', slug: 'infos' }] : []
    ),
    insert: vi.fn(async () => []),
    setUrls: vi.fn(async () => {})
  };
  const event = {
    locals: {
      rime: {
        config: { getLocalesCodes: () => ['fr', 'en'] },
        adapter: { paths },
        area: () => ({ system: () => ({ find }) })
      }
    }
  } as any;
  return { event, config, $url, find, paths };
};

describe('refreshAreaUrls', () => {
  it('reads the area once per locale and formats each url with no path', async () => {
    const { event, config, $url, find } = setup();
    await refreshAreaUrls({ event, config });

    expect(find.mock.calls.map(([args]) => args.locale)).toEqual(['fr', 'en']);
    expect($url).toHaveBeenCalledWith(
      expect.objectContaining({ path: [], slug: '', locale: 'fr' })
    );
    expect($url).toHaveBeenCalledWith(
      expect.objectContaining({ path: [], slug: '', locale: 'en' })
    );
  });

  it('adds the row a locale lacks, the area slug with no parent, and only that one', async () => {
    const { event, config, paths } = setup();
    await refreshAreaUrls({ event, config });

    expect(paths.insert).toHaveBeenCalledOnce();
    expect(paths.insert).toHaveBeenCalledWith({
      slug: 'infos',
      ownerId: 'i1',
      parentId: null,
      rows: [{ locale: 'en', slug: 'infos' }]
    });
  });

  it('writes every url in one go, and answers them', async () => {
    const { event, config, paths } = setup();
    const rows = await refreshAreaUrls({ event, config });

    const expected = [
      { ownerId: 'i1', locale: 'fr', url: 'https://site.com/fr/contact' },
      { ownerId: 'i1', locale: 'en', url: 'https://site.com/en/about' }
    ];
    expect(paths.setUrls).toHaveBeenCalledOnce();
    expect(paths.setUrls).toHaveBeenCalledWith({ slug: 'infos', rows: expected });
    expect(rows).toEqual(expected);
  });
});
