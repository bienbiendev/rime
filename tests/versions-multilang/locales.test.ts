import { PARAMS } from '#lib/core/constants.js';
import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

type Headers = { cookie: string };

/** `infos` read in `locale`, as admin. */
const read = async (request: APIRequestContext, locale: string, headers: Headers) => {
  const response = await request.get(`${API_BASE_URL}/infos?locale=${locale}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

/**
 * A new version and the locales of the version it branches from. The default locale is `en`,
 * `infos` is a versioned area with a localized `title` and `email`.
 */
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

/**
 * `pages` shares its `attributes` group and its `sections` list between locales; the texts inside
 * the blocks are localized. A new version made in `en` keeps what that save changed in the shared
 * fields, in every locale.
 */
test('A new version keeps the shared fields and blocks of the save that made it', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/pages?locale=en`, {
    headers,
    data: {
      attributes: { title: 'Shared fields probe', slug: 'shared-fields-probe', isHome: false },
      sections: [
        { type: 'paragraph', text: 'EN p' },
        { type: 'image', legent: 'EN i' }
      ],
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  const [paragraph, image] = doc.sections;

  // The same rows, translated in French
  const translated = await request.patch(`${API_BASE_URL}/pages/${doc.id}?locale=fr`, {
    headers,
    data: {
      sections: [
        { ...paragraph, text: 'FR p' },
        { ...image, legent: 'FR i' }
      ]
    }
  });
  expect(translated.status()).toBe(200);

  // A save in `en` that makes a new version: a shared field changed, the blocks swapped
  const forked = await request.patch(
    `${API_BASE_URL}/pages/${doc.id}?locale=en&${PARAMS.FORK}=true`,
    {
      headers,
      data: {
        attributes: { ...doc.attributes, isHome: true },
        sections: [
          { type: 'image', legent: 'EN i' },
          { type: 'paragraph', text: 'EN p' }
        ]
      }
    }
  );
  expect(forked.status()).toBe(200);

  for (const locale of ['en', 'fr']) {
    const response = await request.get(
      `${API_BASE_URL}/pages/${doc.id}?locale=${locale}&${PARAMS.LATEST}=true`,
      { headers }
    );
    expect(response.status()).toBe(200);
    const { doc: latest } = await response.json();
    expect(latest.attributes.isHome).toBe(true);
    expect(latest.sections.map((block: { type: string }) => block.type)).toEqual([
      'image',
      'paragraph'
    ]);
  }

  await request.delete(`${API_BASE_URL}/pages/${doc.id}`, { headers });
});

/**
 * A `photo` block in the shared `sections` list holds a localized relation: each locale picks the
 * block's image. A block removed or moved in `en` leaves every other block its own `fr` image.
 */
test('A block removed or moved in one locale keeps the images of the others', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const base64 = await filePathToBase64(
    path.resolve(process.cwd(), 'tests/versions-multilang/landscape.jpg')
  );
  const medias: string[] = [];
  for (const alt of ['m1', 'm2', 'm3']) {
    const response = await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: { file: { base64, filename: `${alt}.jpg` }, alt }
    });
    expect(response.status()).toBe(200);
    medias.push((await response.json()).doc.id);
  }
  const [m1, m2, m3] = medias;

  // Blocks A, B and C: m1, m2, m3 in en
  const created = await request.post(`${API_BASE_URL}/pages?locale=en`, {
    headers,
    data: {
      attributes: { title: 'Photo probe', slug: 'photo-probe', isHome: false },
      sections: [m1, m2, m3].map((photo) => ({ type: 'photo', photo })),
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  const version = `${PARAMS.VERSION_ID}=${doc.versionId}`;
  const [a, b, c] = doc.sections;

  /** The id of each block of `sections`, with its image's id, read in `locale`. */
  const photos = async (locale: string) => {
    const response = await request.get(
      `${API_BASE_URL}/pages/${doc.id}?locale=${locale}&${version}`,
      { headers }
    );
    expect(response.status()).toBe(200);
    const { doc: read } = await response.json();
    return read.sections.map((block: any) => [block.id, block.photo[0]?.documentId]);
  };

  const save = async (locale: string, sections: object[]) => {
    const response = await request.patch(
      `${API_BASE_URL}/pages/${doc.id}?locale=${locale}&${version}`,
      { headers, data: { sections } }
    );
    expect(response.status()).toBe(200);
  };

  // The same blocks in fr: m2, m3, m1
  await save('fr', [
    { ...a, photo: m2 },
    { ...b, photo: m3 },
    { ...c, photo: m1 }
  ]);
  expect(await photos('fr')).toEqual([
    [a.id, m2],
    [b.id, m3],
    [c.id, m1]
  ]);

  // B removed in en: C keeps its own fr image
  await save('en', [a, c]);
  expect(await photos('en')).toEqual([
    [a.id, m1],
    [c.id, m3]
  ]);
  expect(await photos('fr')).toEqual([
    [a.id, m2],
    [c.id, m1]
  ]);

  // A and C swapped in en: each keeps its own fr image
  await save('en', [c, a]);
  expect(await photos('en')).toEqual([
    [c.id, m3],
    [a.id, m1]
  ]);
  expect(await photos('fr')).toEqual([
    [c.id, m1],
    [a.id, m2]
  ]);

  await request.delete(`${API_BASE_URL}/pages/${doc.id}`, { headers });
});
