import { PARAMS } from '$lib/core/constants';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const HISTORY = '.rz-document-versions';
const LIST_ITEM = '.rz-document-versions__list-item';
const ACTIVE_LINK = '.rz-document-versions__list-item--active a';
const TITLE = 'input[name="attributes.title"]';
const SAVE = 'button[data-submit]';

/**
 * The version history, opened from the document's settings menu.
 *
 * Picking a version loads that row into the form on the same page; saving writes that row and no
 * other. The rows are created over the API so each test starts from a known history, and read
 * back over it so what the browser did is checked against what is stored.
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

/** The history stays open across picks; a reload closes it. */
async function openHistory(page: Page) {
  if (await page.locator(HISTORY).count()) return;
  await page.locator('button[aria-haspopup="menu"]').first().click();
  await page.getByRole('menuitem', { name: 'Versions history' }).click();
  await expect(page.locator(HISTORY)).toBeVisible();
}

/** The form's own POST to `?/update`, as opposed to the loads that follow it. */
const waitForSave = (page: Page) =>
  page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );

let newsId: string;
let publishedVersionId: string;
let draftVersionId: string;

const documentUrl = (versionId: string) =>
  `${panelUrl('news', newsId)}?${PARAMS.VERSION_ID}=${versionId}`;

const read = async (request: import('@playwright/test').APIRequestContext, query = '') => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}${query}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

test('Should create a news with a published version and a draft', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Versioned news', slug: 'versioned-news' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  newsId = doc.id;
  publishedVersionId = doc.versionId;

  const branched = await request.patch(`${API_BASE_URL}/news/${newsId}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Versioned news, draft' } }
  });
  expect(branched.status()).toBe(200);

  const draft = await read(request, `?${PARAMS.LATEST}=true`);
  draftVersionId = draft.versionId;
  expect(draftVersionId).not.toBe(publishedVersionId);
});

test('Should list both versions and mark the one on screen', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  await page.waitForLoadState('networkidle');
  await expect(page.locator(HISTORY)).toHaveCount(0);
  await openHistory(page);

  await expect(page.locator(LIST_ITEM)).toHaveCount(2);
  await expect(page.locator(ACTIVE_LINK)).toHaveCount(1);
  await expect(page.locator(ACTIVE_LINK)).toHaveAttribute('href', new RegExp(draftVersionId));
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, draft');
});

test('Should save a draft in place, leaving the published version alone', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  await page.waitForLoadState('networkidle');

  await page.locator(TITLE).fill('Versioned news, draft edited');
  const saved = waitForSave(page);
  await page.locator(SAVE).click();
  expect((await saved).status()).toBe(200);

  // Same row, same history: nothing was added.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, draft edited');
  await openHistory(page);
  await expect(page.locator(LIST_ITEM)).toHaveCount(2);

  const draft = await read(request, `?${PARAMS.VERSION_ID}=${draftVersionId}`);
  expect(draft.attributes.title).toBe('Versioned news, draft edited');
  expect(draft.status).toBe(VERSIONS_STATUS.DRAFT);

  const published = await read(request);
  expect(published.attributes.title).toBe('Versioned news');
  expect(published.status).toBe(VERSIONS_STATUS.PUBLISHED);
});

test('Should load the version picked in the history, and keep it open', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  await page.waitForLoadState('networkidle');
  await openHistory(page);

  await page.locator(`${LIST_ITEM} a[href*="${publishedVersionId}"]`).click();
  await page.waitForURL(new RegExp(`versionId=${publishedVersionId}`));
  await page.waitForLoadState('networkidle');

  await expect(page.locator(TITLE)).toHaveValue('Versioned news');
  await expect(page.locator(HISTORY)).toBeVisible();
  await expect(page.locator(ACTIVE_LINK)).toHaveAttribute('href', new RegExp(publishedVersionId));
});

test('Should save the published version as published, leaving the draft alone', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(publishedVersionId));
  await page.waitForLoadState('networkidle');

  await page.locator(TITLE).fill('Versioned news, edited');
  const saved = waitForSave(page);
  await page.locator(SAVE).click();
  expect((await saved).status()).toBe(200);

  const published = await read(request);
  expect(published.versionId).toBe(publishedVersionId);
  expect(published.attributes.title).toBe('Versioned news, edited');
  expect(published.status).toBe(VERSIONS_STATUS.PUBLISHED);

  const draft = await read(request, `?${PARAMS.VERSION_ID}=${draftVersionId}`);
  expect(draft.attributes.title).toBe('Versioned news, draft edited');
  expect(draft.status).toBe(VERSIONS_STATUS.DRAFT);
});

test('Should branch a new draft from the published version and land on it', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(publishedVersionId));
  await page.waitForLoadState('networkidle');

  await page.locator(TITLE).fill('Versioned news, third');
  await page.locator('button[aria-haspopup="menu"]').first().click();
  await page.getByRole('menuitem', { name: 'Save in a new draft' }).click();

  // The action answers with a redirect to the new row on this same page.
  await page.waitForURL((url) => {
    const versionId = url.searchParams.get(PARAMS.VERSION_ID);
    return !!versionId && versionId !== publishedVersionId && versionId !== draftVersionId;
  });
  await page.waitForLoadState('networkidle');

  await openHistory(page);
  await expect(page.locator(LIST_ITEM)).toHaveCount(3);
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, third');

  const newVersionId = new URL(page.url()).searchParams.get(PARAMS.VERSION_ID)!;
  const branched = await read(request, `?${PARAMS.VERSION_ID}=${newVersionId}`);
  expect(branched.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(branched.attributes.title).toBe('Versioned news, third');

  const published = await read(request);
  expect(published.versionId).toBe(publishedVersionId);
  expect(published.attributes.title).toBe('Versioned news, edited');
});

test('Should close the history and stay on the version', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  await page.waitForLoadState('networkidle');
  await openHistory(page);

  await page.locator(HISTORY).getByRole('button', { name: 'Close' }).click();

  await expect(page.locator(HISTORY)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get(PARAMS.VERSION_ID)).toBe(draftVersionId);
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, draft edited');
});
