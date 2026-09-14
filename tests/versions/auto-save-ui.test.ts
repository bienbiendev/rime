import { PARAMS } from '$lib/core/constants';
import { AUTO_SAVE_DELAY_MS, VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const OTHER_EMAIL = 'typist@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const signInOther = signIn(OTHER_EMAIL, PASSWORD);

const TITLE = 'input[name="attributes.title"]';
const SAVE = 'button[data-submit]';
const OWN_BANNER = '[data-auto-save="own"]';
const OTHER_BANNER = '[data-auto-save="other"]';
const ANY_BANNER = '[data-auto-save]';
const OWN_VERSION_ROW = '[data-version-auto-save="own"]';
const HISTORY = '.rz-document-versions';

/**
 * Auto-save in the browser, on `news`.
 *
 * Typing lands in a row of the user's own after a quiet moment; reopening the document offers
 * to resume or discard it; saving turns it into a version. Every step is checked back through
 * the REST API, which never shows an auto-saved row unless asked for it by `versionId`.
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

/** The version history, from the settings menu. */
async function openHistory(page: Page) {
  await page.locator('button[aria-haspopup="menu"]').first().click();
  await page.getByRole('menuitem', { name: 'Versions history' }).click();
  await expect(page.locator(HISTORY)).toBeVisible();
}

const isAutoSavePost = (response: import('@playwright/test').Response) =>
  response.request().method() === 'POST' && response.url().includes(`${PARAMS.AUTO_SAVE}=true`);

const isSavePost = (response: import('@playwright/test').Response) =>
  response.request().method() === 'POST' &&
  response.url().includes('/update') &&
  !response.url().includes(`${PARAMS.AUTO_SAVE}=true`);

let newsId: string;
let publishedVersionId: string;
let autoSaveId: string;
let otherAutoSaveId: string;

const documentUrl = (versionId?: string) =>
  versionId
    ? `${panelUrl('news', newsId)}?${PARAMS.VERSION_ID}=${versionId}`
    : panelUrl('news', newsId);

const versionsOf = async (request: APIRequestContext) => {
  const response = await request.get(
    `${API_BASE_URL}/news--versions?where[ownerId][equals]=${newsId}&sort=-updatedAt`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(response.status()).toBe(200);
  return (await response.json()).docs as {
    id: string;
    status: string;
    isAutoSave: boolean;
    attributes: { title: string };
  }[];
};

const readNews = async (request: APIRequestContext, query = '') => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}${query}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

test('Should create a published news and a second admin', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Typed news', slug: 'typed-news' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  newsId = doc.id;
  publishedVersionId = doc.versionId;

  const other = await request.post(`${API_BASE_URL}/staff`, {
    headers,
    data: { email: OTHER_EMAIL, name: 'Typist', roles: ['admin'], password: PASSWORD }
  });
  expect(other.status()).toBe(200);
});

test('Typing auto-saves into a row of its own', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');

  const saved = page.waitForResponse(isAutoSavePost);
  await page.locator(TITLE).fill('Typed news, typing');
  expect((await saved).status()).toBe(200);

  // The URL now names the auto-saved row, without a reload.
  await page.waitForURL((url) => {
    const versionId = url.searchParams.get(PARAMS.VERSION_ID);
    return !!versionId && versionId !== publishedVersionId;
  });
  await expect(page.locator('[data-auto-save-state="saved"]')).toBeVisible();
  await expect(page.locator(TITLE)).toHaveValue('Typed news, typing');

  const versions = await versionsOf(request);
  expect(versions).toHaveLength(2);
  const autoSaved = versions.find((v) => v.isAutoSave)!;
  expect(autoSaved.attributes.title).toBe('Typed news, typing');
  // Branched from the published version, it reads published: saving it keeps the document so.
  expect(autoSaved.status).toBe(VERSIONS_STATUS.PUBLISHED);
  autoSaveId = autoSaved.id;
  expect(new URL(page.url()).searchParams.get(PARAMS.VERSION_ID)).toBe(autoSaveId);

  // The published document did not move.
  const published = await readNews(request);
  expect(published.attributes.title).toBe('Typed news');
  expect(published.versionId).toBe(publishedVersionId);
});

test('Reopening the document offers to resume', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');

  // The real row is on screen, the auto-save is offered.
  await expect(page.locator(TITLE)).toHaveValue('Typed news');
  await expect(page.locator(OWN_BANNER)).toBeVisible();

  await page.locator(OWN_BANNER).getByRole('link', { name: 'Resume' }).click();
  await page.waitForURL(new RegExp(`versionId=${autoSaveId}`));
  await page.waitForLoadState('networkidle');

  // On the row itself there is nothing newer to announce.
  await expect(page.locator(TITLE)).toHaveValue('Typed news, typing');
  await expect(page.locator('[data-auto-save-state]')).toContainText('Auto-saved');
  await expect(page.locator(ANY_BANNER)).toHaveCount(0);
});

test('Auto-saving with the history open lists the row, and leaving still offers to resume', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(publishedVersionId));
  await page.waitForLoadState('networkidle');
  await openHistory(page);

  const saved = page.waitForResponse(isAutoSavePost);
  await page.locator(TITLE).fill('Typed news, typed from the history');
  expect((await saved).status()).toBe(200);

  // The history re-reads: the row is there as the user's own and marked as the one on screen,
  // without a reload.
  await expect(page.locator(OWN_VERSION_ROW)).toHaveCount(1);
  await expect(page.locator('.rz-document-versions__list-item--active')).toHaveAttribute(
    'data-version-auto-save',
    'own'
  );

  // One auto-save per user and document: this one replaced the previous.
  const autoSaved = (await versionsOf(request)).filter((v) => v.isAutoSave);
  expect(autoSaved).toHaveLength(1);
  expect(autoSaved[0].id).not.toBe(autoSaveId);
  autoSaveId = autoSaved[0].id;

  // Back on the document, the banner offers the row.
  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OWN_BANNER)).toBeVisible();
});

test('Saving the resumed row turns it into a version', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(autoSaveId));
  await page.waitForLoadState('networkidle');

  // Nothing changed since the auto-save, and Save is still on: it is the promotion.
  await expect(page.locator(SAVE)).toBeEnabled();
  const saved = page.waitForResponse(isSavePost);
  await page.locator(SAVE).click();
  expect((await saved).status()).toBe(200);

  await expect(page.locator(ANY_BANNER)).toHaveCount(0);
  await expect(page.locator('[data-auto-save-state]')).toHaveCount(0);

  const row = await readNews(request, `?${PARAMS.VERSION_ID}=${autoSaveId}`);
  expect(row.isAutoSave).toBe(false);
  expect(row.attributes.title).toBe('Typed news, typed from the history');
  expect((await versionsOf(request)).some((one) => one.isAutoSave)).toBe(false);

  // It was typed over the published version, so it is the published version now, and the only one.
  const published = await readNews(request);
  expect(published.versionId).toBe(autoSaveId);
  expect(published.status).toBe(VERSIONS_STATUS.PUBLISHED);
  const publishedRows = (await versionsOf(request)).filter(
    (v) => v.status === VERSIONS_STATUS.PUBLISHED
  );
  expect(publishedRows.map((v) => v.id)).toEqual([autoSaveId]);

  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OWN_BANNER)).toHaveCount(0);
});

test('Closing the banner keeps the row', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');

  const saved = page.waitForResponse(isAutoSavePost);
  await page.locator(TITLE).fill('Typed news, again');
  expect((await saved).status()).toBe(200);

  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OWN_BANNER)).toBeVisible();

  // Closed for this visit only: the row is still there, and so is the offer on the next load.
  await page.locator(OWN_BANNER).getByRole('button', { name: 'Close' }).click();
  await expect(page.locator(OWN_BANNER)).toHaveCount(0);
  expect((await versionsOf(request)).filter((v) => v.isAutoSave)).toHaveLength(1);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OWN_BANNER)).toBeVisible();

  // Deleting it is done from the version history.
  const rowId = (await versionsOf(request)).find((v) => v.isAutoSave)!.id;
  const remove = await request.delete(`${API_BASE_URL}/news--versions/${rowId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(remove.status()).toBe(200);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OWN_BANNER)).toHaveCount(0);
});

test('Changing the status is not typing: no auto-save follows', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  // The published version is the one promoted above.
  await page.goto(documentUrl(autoSaveId));
  await page.waitForLoadState('networkidle');
  const before = (await versionsOf(request)).length;

  await page.getByRole('button', { name: 'Published' }).click();
  await page.locator('label[for="document.draft"]').click();
  const changed = page.waitForResponse((response) => response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Validate' }).click();
  expect((await changed).status()).toBe(200);

  // Longer than the auto-save delay: nothing followed the status change.
  await page.waitForTimeout(AUTO_SAVE_DELAY_MS * 2);
  const versions = await versionsOf(request);
  expect(versions).toHaveLength(before);
  expect(versions.some((v) => v.isAutoSave)).toBe(false);
  expect((await readNews(request, `?${PARAMS.VERSION_ID}=${autoSaveId}`)).status).toBe(
    VERSIONS_STATUS.DRAFT
  );
});

test("Somebody else's auto-save is announced, and editable when opened", async ({
  page,
  request
}) => {
  const other = await signInOther(request);
  const response = await request.post(
    `${panelUrl('news', newsId)}?/update&${PARAMS.AUTO_SAVE}=true&${PARAMS.VERSION_ID}=${autoSaveId}`,
    {
      headers: { ...other, 'x-sveltekit-action': 'true' },
      form: { 'attributes.title': 'Typed news, by the typist' }
    }
  );
  expect((await response.json()).type).toBe('success');
  otherAutoSaveId = (await versionsOf(request)).find((v) => v.isAutoSave)!.id;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl());
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OTHER_BANNER)).toBeVisible();
  await expect(page.locator(OTHER_BANNER)).toContainText('Typist');
  await expect(page.locator(OWN_BANNER)).toHaveCount(0);

  await page.goto(documentUrl(otherAutoSaveId));
  await page.waitForLoadState('networkidle');
  await expect(page.locator(TITLE)).toHaveValue('Typed news, by the typist');
  await expect(page.locator(TITLE)).toBeEnabled();
  await expect(page.locator(SAVE)).toBeEnabled();
});

test('The versions history labels the auto-saved row', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(autoSaveId));
  await page.waitForLoadState('networkidle');
  await openHistory(page);

  const row = page.locator('[data-version-auto-save="other"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Typist');
  await expect(page.locator('[data-version-auto-save="own"]')).toHaveCount(0);
});

test('Deleting a version from the settings keeps the document', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(autoSaveId));
  await page.waitForLoadState('networkidle');
  const before = (await versionsOf(request)).length;

  await page.locator('button[aria-haspopup="menu"]').first().click();
  await page.getByRole('menuitem', { name: 'Delete this version' }).click();
  const removed = page.waitForResponse((response) => response.request().method() === 'DELETE');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  expect((await removed).status()).toBe(200);

  // The row on screen is gone, so the page lands on the newest one.
  await page.waitForURL((url) => !url.searchParams.get(PARAMS.VERSION_ID));
  const versions = await versionsOf(request);
  expect(versions).toHaveLength(before - 1);
  expect(versions.some((v) => v.id === autoSaveId)).toBe(false);
  expect((await readNews(request, `?${PARAMS.LATEST}=true`)).id).toBe(newsId);
});

test('The last version of a document cannot be deleted', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Single version', slug: 'single-version' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  const { doc } = await created.json();

  // The menu says so, and the server refuses regardless.
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('news', doc.id)}?${PARAMS.VERSION_ID}=${doc.versionId}`);
  await page.waitForLoadState('networkidle');
  await page.locator('button[aria-haspopup="menu"]').first().click();
  await expect(page.getByRole('menuitem', { name: 'Delete this version' })).toBeDisabled();

  const response = await request.delete(`${API_BASE_URL}/news--versions/${doc.versionId}`, {
    headers
  });
  expect(response.status()).toBe(400);
});

test('Only an auto-save newer than the row on screen is announced', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Newer or not', slug: 'newer-or-not' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  const doc = (await created.json()).doc;
  const rowsOf = async () =>
    (
      await request
        .get(`${API_BASE_URL}/news--versions?where[ownerId][equals]=${doc.id}`, { headers })
        .then((r) => r.json())
    ).docs as { isAutoSave: boolean }[];

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('news', doc.id)}`);
  await page.waitForLoadState('networkidle');

  // Typing lands in an auto-save, which is then the row on screen: nothing to announce.
  const saved = page.waitForResponse(isAutoSavePost);
  await page.locator(TITLE).fill('Newer or not, typing');
  expect((await saved).status()).toBe(200);
  await page.waitForURL((url) => !!url.searchParams.get(PARAMS.VERSION_ID));
  await expect(page.locator(ANY_BANNER)).toHaveCount(0);

  // Back on the published row, the auto-save is newer: announced.
  await page.goto(`${panelUrl('news', doc.id)}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(OWN_BANNER)).toBeVisible();

  // The published row is written after it: the auto-save is older, and stays out of the way.
  const written = await request.patch(
    `${API_BASE_URL}/news/${doc.id}?${PARAMS.VERSION_ID}=${doc.versionId}`,
    { headers, data: { attributes: { title: 'Newer or not, written since' } } }
  );
  expect(written.status()).toBe(200);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator(TITLE)).toHaveValue('Newer or not, written since');
  await expect(page.locator(ANY_BANNER)).toHaveCount(0);
  expect((await rowsOf()).filter((row) => row.isAutoSave)).toHaveLength(1);
});
