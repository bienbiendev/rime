import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Locales on a read and on a write. The default locale is `fr`.
 *
 * A create writes one locale. A read in another falls back field by field, requested locale
 * first, then the default, then the rest — for localized values only: a localized blocks field
 * is the blocks written in that locale, or none. A write in one locale changes nothing in
 * another.
 */

type Headers = { cookie: string };

const read = async (request: APIRequestContext, id: string, locale: string, headers: Headers) => {
  const response = await request.get(`${API_BASE_URL}/pages/${id}?locale=${locale}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

let pageId: string;
let frBefore: { attributes: unknown; layout: unknown; seo: unknown };

test('A create writes one locale, and a read in another falls back field by field', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: 'Page en français', slug: 'page-en-francais' },
      seo: { metaTitle: 'Meta FR' },
      layout: { components: [{ type: 'paragraph', text: 'Paragraphe' }] }
    }
  });
  expect(created.status()).toBe(200);
  pageId = (await created.json()).doc.id;

  // Values fall back; the localized blocks field does not.
  const en = await read(request, pageId, 'en', headers);
  expect(en.locale).toBe('en');
  expect(en.attributes.title).toBe('Page en français');
  expect(en.seo.metaTitle).toBe('Meta FR');
  expect(en.layout.components).toHaveLength(0);

  const fr = await read(request, pageId, 'fr', headers);
  expect(fr.layout.components).toHaveLength(1);
  frBefore = { attributes: fr.attributes, layout: fr.layout, seo: fr.seo };
});

test('A field written in EN is EN; the others still fall back', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const written = await request.patch(`${API_BASE_URL}/pages/${pageId}?locale=en`, {
    headers,
    data: { attributes: { title: 'Page in English' } }
  });
  expect(written.status()).toBe(200);

  const en = await read(request, pageId, 'en', headers);
  expect(en.attributes.title).toBe('Page in English');
  expect(en.attributes.slug).toBe('page-en-francais');
  expect(en.seo.metaTitle).toBe('Meta FR');
});

test('Writing EN, blocks included, changes nothing in FR', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // The whole merged EN document written back, as a client that reads then writes would.
  const en = await read(request, pageId, 'en', headers);
  const written = await request.patch(`${API_BASE_URL}/pages/${pageId}?locale=en`, {
    headers,
    data: {
      attributes: { ...en.attributes, title: 'Page in English, again' },
      seo: en.seo,
      layout: {
        components: [
          { type: 'paragraph', text: 'Paragraph' },
          { type: 'slider', image: 'en' }
        ]
      }
    }
  });
  expect(written.status()).toBe(200);

  const fr = await read(request, pageId, 'fr', headers);
  expect({ attributes: fr.attributes, layout: fr.layout, seo: fr.seo }).toEqual(frBefore);

  const enAfter = await read(request, pageId, 'en', headers);
  expect(enAfter.attributes.title).toBe('Page in English, again');
  expect(enAfter.layout.components).toHaveLength(2);
  // The write landed in EN: its own rows now hold what the fallback used to show.
  expect(enAfter.seo.metaTitle).toBe('Meta FR');
});
