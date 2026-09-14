import { PARAMS } from '$lib/core/constants';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, {
  expect,
  request as anonymous,
  type APIRequestContext,
  type Page
} from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * What a draft config answers on the paths the panel never takes: publishing through a
 * new-version write, updating a document nobody has published yet, reading drafts without being
 * staff, and what the form is told when an action fails.
 */

type Headers = { cookie: string };
type Row = { id: string; status: string; attributes: { title: string } };

const createNews = async (
  request: APIRequestContext,
  headers: Headers,
  title: string,
  status?: string
) => {
  const response = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
      ...(status ? { status } : {})
    }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc as Row & { id: string; versionId: string };
};

const versionsOf = async (request: APIRequestContext, headers: Headers, id: string) => {
  const response = await request.get(
    `${API_BASE_URL}/news--versions?where[ownerId][equals]=${id}&sort=-updatedAt`,
    { headers }
  );
  expect(response.status()).toBe(200);
  return (await response.json()).docs as Row[];
};

const readTitle = async (request: APIRequestContext, url: string, headers?: Headers) => {
  const response = await request.get(url, headers ? { headers } : {});
  expect(response.status()).toBe(200);
  const body = await response.json();
  return (body.doc ?? body.docs[0]).attributes.title as string;
};

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

test('Publishing through a new-version write leaves one published version', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const doc = await createNews(request, headers, 'Publish by branching', VERSIONS_STATUS.PUBLISHED);

  const response = await request.patch(`${API_BASE_URL}/news/${doc.id}?${PARAMS.FORK}=true`, {
    headers,
    data: {
      status: VERSIONS_STATUS.PUBLISHED,
      attributes: { title: 'Publish by branching, again' }
    }
  });
  expect(response.status()).toBe(200);

  const rows = await versionsOf(request, headers, doc.id);
  expect(rows).toHaveLength(2);
  const published = rows.filter((row) => row.status === VERSIONS_STATUS.PUBLISHED);
  expect(published.map((row) => row.attributes.title)).toEqual(['Publish by branching, again']);
  expect(await readTitle(request, `${API_BASE_URL}/news/${doc.id}`)).toBe(
    'Publish by branching, again'
  );
});

test('A document nobody has published yet is written through latest', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const doc = await createNews(request, headers, 'Never published');
  expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);

  // An update selects the published row like a read does, and there is none.
  const published = await request.patch(`${API_BASE_URL}/news/${doc.id}`, {
    headers,
    data: { attributes: { title: 'nowhere' } }
  });
  expect(published.status()).toBe(404);

  // `latest` selects the newest row, and it is written in place.
  const written = await request.patch(`${API_BASE_URL}/news/${doc.id}?${PARAMS.LATEST}=true`, {
    headers,
    data: { attributes: { title: 'Never published, edited' } }
  });
  expect(written.status()).toBe(200);
  let rows = await versionsOf(request, headers, doc.id);
  expect(rows).toHaveLength(1);
  expect(rows[0].attributes.title).toBe('Never published, edited');
  expect(rows[0].status).toBe(VERSIONS_STATUS.DRAFT);

  // And a fork branches a new draft from it.
  const branched = await request.patch(
    `${API_BASE_URL}/news/${doc.id}?${PARAMS.LATEST}=true&${PARAMS.FORK}=true`,
    { headers, data: { attributes: { title: 'Never published, branched' } } }
  );
  expect(branched.status()).toBe(200);
  rows = await versionsOf(request, headers, doc.id);
  expect(rows).toHaveLength(2);
  expect(rows[0].attributes.title).toBe('Never published, branched');

  // A document that does not exist is still not found.
  const missing = await request.patch(`${API_BASE_URL}/news/00000000-0000-0000-0000-000000000000`, {
    headers,
    data: { attributes: { title: 'nowhere' } }
  });
  expect(missing.status()).toBe(404);
});

test('Drafts are staff business: anybody else reads the published version', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const doc = await createNews(request, headers, 'Public news', VERSIONS_STATUS.PUBLISHED);
  const drafted = await request.patch(`${API_BASE_URL}/news/${doc.id}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Public news, drafted' } }
  });
  expect(drafted.status()).toBe(200);
  const draftId = (await versionsOf(request, headers, doc.id)).find(
    (row) => row.status === VERSIONS_STATUS.DRAFT
  )!.id;

  // `news` is readable by anyone. `latest` and `versionId` from anyone read as absent. A fresh
  // request context: signing in above left the shared one with the admin's cookie.
  const anon = await anonymous.newContext();
  const byId = `${API_BASE_URL}/news/${doc.id}`;
  expect(await readTitle(anon, `${byId}?${PARAMS.LATEST}=true`)).toBe('Public news');
  expect(await readTitle(anon, `${byId}?${PARAMS.VERSION_ID}=${draftId}`)).toBe('Public news');
  expect(
    await readTitle(anon, `${API_BASE_URL}/news?${PARAMS.LATEST}=true&where[id][equals]=${doc.id}`)
  ).toBe('Public news');
  await anon.dispose();

  // Staff read what they asked for.
  expect(await readTitle(request, `${byId}?${PARAMS.LATEST}=true`, headers)).toBe(
    'Public news, drafted'
  );
  expect(await readTitle(request, `${byId}?${PARAMS.VERSION_ID}=${draftId}`, headers)).toBe(
    'Public news, drafted'
  );
});

test("An area's save in a new draft answers like a collection's", async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const response = await request.post(`${panelUrl('settings')}?/update&${PARAMS.FORK}=true`, {
    headers: { ...headers, 'x-sveltekit-action': 'true' },
    form: { title: 'Settings, drafted' }
  });
  expect((await response.json()).type).toBe('success');

  const read = await request.get(`${API_BASE_URL}/settings?${PARAMS.LATEST}=true`, { headers });
  expect(read.status()).toBe(200);
  const { doc } = await read.json();
  expect(doc.title).toBe('Settings, drafted');
  expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
});

test('A save the server refuses says so in the form', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const doc = await createNews(request, headers, 'Refused save', VERSIONS_STATUS.PUBLISHED);
  const drafted = await request.patch(`${API_BASE_URL}/news/${doc.id}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Refused save, draft' } }
  });
  expect(drafted.status()).toBe(200);
  const draftId = (await versionsOf(request, headers, doc.id)).find(
    (row) => row.status === VERSIONS_STATUS.DRAFT
  )!.id;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('news', doc.id)}?${PARAMS.VERSION_ID}=${draftId}`);
  await page.waitForLoadState('networkidle');

  // The row goes away under the form; its save is refused with a 404, and the form says so.
  const removed = await request.delete(`${API_BASE_URL}/news--versions/${draftId}`, { headers });
  expect(removed.status()).toBe(200);

  await page.locator('input[name="attributes.title"]').fill('Refused save, typed');
  await page.locator('button[data-submit]').click();
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
});
