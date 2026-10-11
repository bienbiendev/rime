import { expect, test, vi } from 'vitest';
import { refreshAreaUrls } from './area.server.js';

vi.mock('./area.server.js', () => ({ refreshAreaUrls: vi.fn(async () => []) }));

const { ensureAddresses } = await import('./addresses.server.js');

test('the first request gives an area with $url the url it lacks in a locale', async () => {
  const infos = { slug: 'infos', type: 'area', $url: () => '/about' };
  const settings = { slug: 'settings', type: 'area' };
  const missingOwners = vi.fn(async ({ slug, locale }: { slug: string; locale: string }) =>
    slug === 'infos' && locale === 'en' ? ['i1'] : []
  );
  const event = {
    locals: {
      rime: {
        config: {
          raw: { collections: [], areas: [infos, settings] },
          getLocalesCodes: () => ['fr', 'en']
        },
        adapter: { paths: { missingOwners } }
      }
    }
  } as any;

  await ensureAddresses(event);

  expect(refreshAreaUrls).toHaveBeenCalledOnce();
  expect(refreshAreaUrls).toHaveBeenCalledWith({ event, config: infos });
  expect(missingOwners).not.toHaveBeenCalledWith(expect.objectContaining({ slug: 'settings' }));
});
