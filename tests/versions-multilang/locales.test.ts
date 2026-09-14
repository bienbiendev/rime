import { PARAMS } from '$lib/core/constants';
import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * A new version and the locales of the version it branches from. The default locale is `en`,
 * `infos` is a versioned area with a localized `title` and `email`.
 */

type Headers = { cookie: string };

const read = async (request: APIRequestContext, locale: string, headers: Headers) => {
  const response = await request.get(`${API_BASE_URL}/infos?locale=${locale}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

test('A new version carries the translations its original has', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // One version, translated in three locales — the German email left empty.
  const { versionId } = await read(request, 'en', headers);
  for (const [locale, data] of [
    ['en', { title: 'Infos', email: 'hello@infos.com' }],
    ['fr', { title: 'Infos en français', email: 'bonjour@infos.fr' }],
    ['de', { title: 'Infos auf Deutsch', email: '' }]
  ] as const) {
    const response = await request.patch(
      `${API_BASE_URL}/infos?locale=${locale}&${PARAMS.VERSION_ID}=${versionId}`,
      { headers, data }
    );
    expect(response.status()).toBe(200);
  }

  // A save in `en` makes a new version.
  const saved = await request.patch(`${API_BASE_URL}/infos?locale=en`, {
    headers,
    data: { title: 'Infos, again' }
  });
  expect(saved.status()).toBe(200);
  const en = await read(request, 'en', headers);
  expect(en.versionId).not.toBe(versionId);
  expect(en.title).toBe('Infos, again');

  // The new version reads French in French and German in German, as the original did.
  const fr = await read(request, 'fr', headers);
  expect(fr.versionId).toBe(en.versionId);
  expect(fr.title).toBe('Infos en français');
  expect(fr.email).toBe('bonjour@infos.fr');

  const de = await read(request, 'de', headers);
  expect(de.versionId).toBe(en.versionId);
  expect(de.title).toBe('Infos auf Deutsch');
  // Empty in German, on the original and so on the copy: read from the default locale.
  expect(de.email).toBe('hello@infos.com');
});
