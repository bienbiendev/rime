import { describe, expect, it } from 'vitest';
import { areaApi } from './area/api.server.js';
import { collectionApi } from './collection/api.server.js';

/** A request with the API cache on, whose cache records the keys it is asked for. */
const requestIn = (locale: string) => {
  const keys: any[] = [];
  const event = {
    locals: {
      locale,
      cacheEnabled: true,
      rime: {
        cache: {
          createKey: (operation: string, key: object) => ({ operation, ...key }),
          get: async (key: object) => {
            keys.push(key);
            return [];
          }
        }
      }
    }
  } as any;
  return { event, keys };
};

const config = { slug: 'pages' } as any;

describe('the API cache key', () => {
  it("holds the request's locale when the read names none", async () => {
    for (const locale of ['fr', 'en']) {
      const { event, keys } = requestIn(locale);
      const pages = collectionApi({ config, event, defaultLocale: 'fr' });
      await pages.find();
      await pages.findById({ id: '1' });
      await areaApi({ config: { slug: 'settings' } as any, event, defaultLocale: 'fr' }).find();
      expect(keys.map((key) => key.locale)).toEqual([locale, locale, locale]);
    }
  });

  it('holds the locale the read names', async () => {
    const { event, keys } = requestIn('fr');
    await collectionApi({ config, event, defaultLocale: 'fr' }).find({ locale: 'en' });
    expect(keys[0].locale).toBe('en');
  });

  it('holds who is asking', async () => {
    const { event, keys } = requestIn('fr');
    event.locals.user = { id: 'u1', email: 'a@b.c', roles: ['editor'] };
    await collectionApi({ config, event, defaultLocale: 'fr' }).find();
    expect(keys[0]).toMatchObject({ slug: 'pages', userId: 'u1', userRoles: ['editor'] });
  });

  it('tells apart two api keys with the same roles, which have no email', async () => {
    const keyFor = async (id: string) => {
      const { event, keys } = requestIn('fr');
      event.locals.user = { id, email: '', roles: ['reports'], isStaff: false };
      await collectionApi({ config, event, defaultLocale: 'fr' }).find();
      return keys[0];
    };
    expect(await keyFor('app1')).not.toEqual(await keyFor('app2'));
  });

  it('is not used by rime itself, nor with the cache off', async () => {
    // Past the cache, the read reaches for a database this request does not have
    const attempt = async (read: () => Promise<unknown>) => {
      try {
        await read();
      } catch {
        // the read itself is not under test
      }
    };

    const { event, keys } = requestIn('fr');
    await attempt(() => collectionApi({ config, event, defaultLocale: 'fr' }).system().find());
    event.locals.cacheEnabled = false;
    await attempt(() => collectionApi({ config, event, defaultLocale: 'fr' }).find());
    expect(keys).toEqual([]);
  });
});
