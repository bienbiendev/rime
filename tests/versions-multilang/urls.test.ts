import { PARAMS } from '$lib/core/constants';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

// Pages: nested, versions with drafts, fr, en and de (en by default).
// $url: ({ path, locale }) => `${origin}/${locale}/${path.join('/')}`

const BASE = process.env.PUBLIC_RIME_URL;
const signInSuperAdmin = signIn(
  process.env.TESTS_ADMIN_EMAIL || 'admin@email.com',
  process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A'
);

/**
 * How long moving a page with 50 descendants may take, in 3 locales, on the dev server the suite
 * runs: about four times the 100 ms it takes on a laptop, so a slower machine does not fail it.
 */
const MOVE_LIMIT_MS = Number(process.env.TESTS_MOVE_LIMIT_MS || 400);

test.describe.configure({ mode: 'serial' });

let headers: { cookie: string };
const ids: Record<string, string> = {};

const create = async (
  request: APIRequestContext,
  args: { title: string; slug: string; parent?: string; status?: string }
) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: args.title, slug: args.slug },
      _parent: args.parent ?? null,
      status: args.status ?? VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  ids[args.slug] = doc.id;
  return doc;
};

const read = async (request: APIRequestContext, id: string, query = '') =>
  (await (await request.get(`${API_BASE_URL}/pages/${id}${query}`, { headers })).json()).doc;

const findBy = async (
  request: APIRequestContext,
  member: 'url' | '_urlPath',
  value: string,
  query = ''
) => {
  const url = `${API_BASE_URL}/pages?where[${member}][equals]=${encodeURIComponent(value)}${query}`;
  return (await (await request.get(url, { headers })).json()).docs.map(
    (doc: { id: string }) => doc.id
  );
};

test('A new page gets its address in every locale', async ({ request }) => {
  headers = await signInSuperAdmin(request);
  await create(request, { title: 'Company', slug: 'company' });
  const services = await create(request, { title: 'Services', slug: 'services' });

  expect(services.url).toBe(`${BASE}/en/services`);
  expect(services._slug).toBe('services');
  expect(services._urlPath).toBe('services');
  expect((await read(request, services.id, '?locale=fr')).url).toBe(`${BASE}/fr/services`);
});

test('A tree of 50 pages under Services', async ({ request }) => {
  for (let i = 0; i < 5; i++) {
    await create(request, { title: `S${i}`, slug: `s${i}`, parent: ids.services });
    for (let j = 0; j < 3; j++) {
      await create(request, { title: `S${i}-${j}`, slug: `s${i}-${j}`, parent: ids[`s${i}`] });
      for (let k = 0; k < 2; k++) {
        await create(request, {
          title: `S${i}-${j}-${k}`,
          slug: `s${i}-${j}-${k}`,
          parent: ids[`s${i}-${j}`]
        });
      }
    }
  }

  const grandchild = await read(request, ids['s4-2-1']);
  expect(grandchild.url).toBe(`${BASE}/en/services/s4/s4-2/s4-2-1`);
});

test(`Moving a page with 50 descendants takes under ${MOVE_LIMIT_MS} ms and carries them`, async ({
  request
}) => {
  const start = performance.now();
  const response = await request.patch(`${API_BASE_URL}/pages/${ids.services}`, {
    headers,
    data: { _parent: ids.company }
  });
  const elapsed = performance.now() - start;
  expect(response.status()).toBe(200);
  console.log(`moved a page with 50 descendants in ${Math.round(elapsed)} ms`);
  expect(elapsed).toBeLessThan(MOVE_LIMIT_MS);

  const path = 'company/services/s4/s4-2/s4-2-1';
  const grandchild = await read(request, ids['s4-2-1']);
  expect(grandchild.url).toBe(`${BASE}/en/${path}`);
  expect(grandchild._urlPath).toBe(path);

  for (const locale of ['fr', 'en']) {
    const url = `${BASE}/${locale}/${path}`;
    expect(await findBy(request, 'url', url, `&locale=${locale}`)).toEqual([ids['s4-2-1']]);
    expect(await findBy(request, 'url', url, `&locale=${locale}&${PARAMS.LATEST}=true`)).toEqual([
      ids['s4-2-1']
    ]);
  }
  expect(await findBy(request, '_urlPath', path)).toEqual([ids['s4-2-1']]);
});

test('Changing a slug moves the subtree in that locale only', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${ids.services}/slug?locale=fr`, {
    headers,
    data: { slug: 'Offres' }
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).url).toBe(`${BASE}/fr/company/offres`);

  expect((await read(request, ids['s4-2-1'], '?locale=fr')).url).toBe(
    `${BASE}/fr/company/offres/s4/s4-2/s4-2-1`
  );
  expect((await read(request, ids['s4-2-1'], '?locale=en')).url).toBe(
    `${BASE}/en/company/services/s4/s4-2/s4-2-1`
  );
});

test('A slug a sibling holds is refused; a new page takes the next free one', async ({
  request
}) => {
  const refused = await request.patch(`${API_BASE_URL}/pages/${ids.s0}/slug`, {
    headers,
    data: { slug: 's1' }
  });
  expect(refused.status()).toBe(400);

  const twin = await create(request, { title: 'Another S0', slug: 's0', parent: ids.services });
  expect(twin._slug).toBe('s0-2');
  expect(twin.url).toBe(`${BASE}/en/company/services/s0-2`);
});

test('A draft carries its page url; the slug changes on the published page only', async ({
  request
}) => {
  const fork = await request.patch(`${API_BASE_URL}/pages/${ids.s1}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'S1, reworded' } }
  });
  expect(fork.status()).toBe(200);
  const published = await read(request, ids.s1);
  const draft = await read(request, ids.s1, `?${PARAMS.LATEST}=true`);
  expect(draft.attributes.title).toBe('S1, reworded');
  expect(draft.url).toBe(published.url);

  const unpublished = await create(request, {
    title: 'Not yet',
    slug: 'not-yet',
    parent: ids.services,
    status: VERSIONS_STATUS.DRAFT
  });
  const refused = await request.patch(`${API_BASE_URL}/pages/${unpublished.id}/slug`, {
    headers,
    data: { slug: 'soon' }
  });
  expect(refused.status()).toBe(400);
});

test('A published child of a page never published is found; its parent is not', async ({
  request,
  playwright
}) => {
  const hidden = await create(request, {
    title: 'Hidden',
    slug: 'hidden',
    status: VERSIONS_STATUS.DRAFT
  });
  const shown = await create(request, { title: 'Shown', slug: 'shown', parent: hidden.id });
  expect(shown.url).toBe(`${BASE}/en/hidden/shown`);

  const visitor = await playwright.request.newContext();
  const lookup = async (url: string) =>
    (
      await (
        await visitor.get(`${API_BASE_URL}/pages?where[url][equals]=${encodeURIComponent(url)}`)
      ).json()
    ).docs.length;
  expect(await lookup(`${BASE}/en/hidden/shown`)).toBe(1);
  expect(await lookup(`${BASE}/en/hidden`)).toBe(0);
  await visitor.dispose();
});

test('Deleting a page puts its children at the top level, with their urls', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/pages/${ids.s4}`, { headers });
  expect(response.status()).toBe(200);

  const child = await read(request, ids['s4-2']);
  expect(child._parent ?? null).toBe(null);
  expect(child.url).toBe(`${BASE}/en/s4-2`);
  expect((await read(request, ids['s4-2-1'])).url).toBe(`${BASE}/en/s4-2/s4-2-1`);
});
