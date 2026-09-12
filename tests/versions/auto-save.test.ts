import { PARAMS } from '$lib/core/constants';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const OTHER_EMAIL = 'autosaver@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const signInOther = signIn(OTHER_EMAIL, PASSWORD);

/**
 * Auto-save, driven over HTTP through the panel's form action — the only door to one.
 *
 * `news` opts in. Every write is checked back through the REST API, which never sees an
 * auto-saved row unless it is asked for by `versionId`.
 */

let newsId: string;
let publishedVersionId: string;
let adminAutoSaveId: string;
let otherAutoSaveId: string;
let adminId: string;
let otherId: string;

type Headers = { cookie: string };

/** The panel's `?/update` action, as the form posts it. */
const panelUpdate = (
  request: APIRequestContext,
  headers: Headers,
  params: Record<string, string>,
  form: Record<string, string>
) =>
  request.post(`${panelUrl('news', newsId)}?/update&${new URLSearchParams(params)}`, {
    headers: { ...headers, 'x-sveltekit-action': 'true' },
    form
  });

const readNews = async (request: APIRequestContext, headers: Headers, query = '') => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}${query}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

const versionsOf = async (request: APIRequestContext, headers: Headers) => {
  const response = await request.get(
    `${API_BASE_URL}/news--versions?where[ownerId][equals]=${newsId}&sort=-updatedAt`,
    { headers }
  );
  expect(response.status()).toBe(200);
  return (await response.json()).docs as {
    id: string;
    status: string;
    isAutoSave: boolean;
    attributes: { title: string };
    updatedBy: { id: string } | null;
  }[];
};

test('Should create a second admin and a published news', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const me = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: PASSWORD }
  });
  adminId = (await me.json()).user.id;

  const other = await request.post(`${API_BASE_URL}/staff`, {
    headers,
    data: { email: OTHER_EMAIL, name: 'Auto Saver', roles: ['admin'], password: PASSWORD }
  });
  expect(other.status()).toBe(200);
  otherId = (await other.json()).doc.id;

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Auto-saved news', slug: 'auto-saved-news' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  newsId = doc.id;
  publishedVersionId = doc.versionId;
});

test('An auto-save needs the version it starts from', async ({ request }) => {
  const response = await panelUpdate(
    request,
    await signInSuperAdmin(request),
    { [PARAMS.AUTO_SAVE]: 'true' },
    { 'attributes.title': 'nowhere' }
  );
  const body = await response.json();
  expect(body.type).toBe('failure');
  expect(body.status).toBe(400);
});

test('The first auto-save is a new draft row nobody reads by default', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const response = await panelUpdate(
    request,
    headers,
    { [PARAMS.AUTO_SAVE]: 'true', [PARAMS.VERSION_ID]: publishedVersionId },
    { 'attributes.title': 'Auto-saved news, typing' }
  );
  expect((await response.json()).type).toBe('success');

  const versions = await versionsOf(request, headers);
  expect(versions).toHaveLength(2);
  const autoSaved = versions.find((v) => v.isAutoSave)!;
  expect(autoSaved.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(autoSaved.attributes.title).toBe('Auto-saved news, typing');
  expect(autoSaved.updatedBy?.id).toBe(adminId);
  adminAutoSaveId = autoSaved.id;

  // Neither the published read nor the newest-row read sees it.
  const published = await readNews(request, headers);
  expect(published.attributes.title).toBe('Auto-saved news');
  const newest = await readNews(request, headers, `?${PARAMS.DRAFT}=true`);
  expect(newest.versionId).toBe(publishedVersionId);

  // Only its versionId does.
  const resumed = await readNews(request, headers, `?${PARAMS.VERSION_ID}=${adminAutoSaveId}`);
  expect(resumed.isAutoSave).toBe(true);
});

test('The next auto-save writes the same row in place', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const response = await panelUpdate(
    request,
    headers,
    { [PARAMS.AUTO_SAVE]: 'true', [PARAMS.VERSION_ID]: adminAutoSaveId },
    { 'attributes.title': 'Auto-saved news, still typing' }
  );
  expect((await response.json()).type).toBe('success');

  const versions = await versionsOf(request, headers);
  expect(versions).toHaveLength(2);
  const autoSaved = versions.find((v) => v.id === adminAutoSaveId)!;
  expect(autoSaved.isAutoSave).toBe(true);
  expect(autoSaved.attributes.title).toBe('Auto-saved news, still typing');
});

test('An auto-save stays a draft whatever status the body says', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const response = await panelUpdate(
    request,
    headers,
    { [PARAMS.AUTO_SAVE]: 'true', [PARAMS.VERSION_ID]: adminAutoSaveId },
    { status: VERSIONS_STATUS.PUBLISHED }
  );
  expect((await response.json()).type).toBe('success');

  const row = await readNews(request, headers, `?${PARAMS.VERSION_ID}=${adminAutoSaveId}`);
  expect(row.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(row.isAutoSave).toBe(true);
});

test('A second user gets their own auto-saved row', async ({ request }) => {
  const other = await signInOther(request);

  const response = await panelUpdate(
    request,
    other,
    { [PARAMS.AUTO_SAVE]: 'true', [PARAMS.VERSION_ID]: publishedVersionId },
    { 'attributes.title': 'Auto-saved news, by the other' }
  );
  expect((await response.json()).type).toBe('success');

  const versions = await versionsOf(request, await signInSuperAdmin(request));
  expect(versions).toHaveLength(3);
  otherAutoSaveId = versions.find((v) => v.isAutoSave && v.updatedBy?.id === otherId)!.id;
  expect(versions.find((v) => v.id === adminAutoSaveId)!.attributes.title).toBe(
    'Auto-saved news, still typing'
  );
});

test("Nobody writes or deletes somebody else's auto-save", async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const write = await request.patch(
    `${API_BASE_URL}/news/${newsId}?${PARAMS.VERSION_ID}=${otherAutoSaveId}`,
    { headers, data: { attributes: { title: 'not mine' } } }
  );
  expect(write.status()).toBe(401);

  const remove = await request.delete(`${API_BASE_URL}/news--versions/${otherAutoSaveId}`, {
    headers
  });
  expect(remove.status()).toBe(401);
});

test('Duplicating copies the newest real row, never an auto-save', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const duplicated = await request.post(`${API_BASE_URL}/news/${newsId}/duplicate`, { headers });
  expect(duplicated.status()).toBe(200);
  const { id } = await duplicated.json();

  const copy = await request
    .get(`${API_BASE_URL}/news/${id}?${PARAMS.DRAFT}=true`, { headers })
    .then((r) => r.json());
  expect(copy.doc.attributes.title).toBe('Auto-saved news');
  expect(copy.doc.isAutoSave).toBe(false);
});

test("A save from the panel promotes the row and retires the saver's other auto-saves", async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const response = await panelUpdate(
    request,
    headers,
    { [PARAMS.VERSION_ID]: adminAutoSaveId },
    { 'attributes.title': 'Auto-saved news, saved', status: VERSIONS_STATUS.PUBLISHED }
  );
  expect((await response.json()).type).toBe('success');

  const published = await readNews(request, headers);
  expect(published.versionId).toBe(adminAutoSaveId);
  expect(published.isAutoSave).toBe(false);
  expect(published.attributes.title).toBe('Auto-saved news, saved');

  const versions = await versionsOf(request, headers);
  // The first version, demoted; the promoted row; the other user's auto-save, untouched.
  expect(versions).toHaveLength(3);
  expect(versions.filter((v) => v.isAutoSave).map((v) => v.id)).toEqual([otherAutoSaveId]);
  expect(versions.find((v) => v.id === publishedVersionId)!.status).toBe(VERSIONS_STATUS.DRAFT);
});

test('An owner discards their own auto-save', async ({ request }) => {
  const other = await signInOther(request);

  const remove = await request.delete(`${API_BASE_URL}/news--versions/${otherAutoSaveId}`, {
    headers: other
  });
  expect(remove.status()).toBe(200);

  const versions = await versionsOf(request, await signInSuperAdmin(request));
  expect(versions).toHaveLength(2);
  expect(versions.some((v) => v.isAutoSave)).toBe(false);
});
