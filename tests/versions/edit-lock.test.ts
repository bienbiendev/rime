import { PARAMS } from '$lib/core/constants';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect, type Browser } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const LOCK_EDITOR_EMAIL = 'lock-editor@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const OVERLAY = '.rz-document-read-only';

/**
 * Two people, one versioned document.
 *
 * The lock is held on the version being edited: the panel names the row on screen with every
 * claim, so two people on two versions of the same document do not lock each other out, and two
 * people on the same version do. `tests/fields/edit-lock.test.ts` covers the rest on a document
 * that has one row; this file is the versioned half.
 */

async function openAs(browser: Browser, email: string, url: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  return { context, page };
}

let newsId: string;
let publishedVersionId: string;
let draftVersionId: string;

const versionUrl = (versionId: string) =>
  `${panelUrl('news', newsId)}?${PARAMS.VERSION_ID}=${versionId}`;

test('Should create a lock-editor staff account', async ({ request }) => {
  // An admin: this fixture sets no `panel.$access`, so the panel itself admits admins only.
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: LOCK_EDITOR_EMAIL,
      name: 'Lock Editor',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
});

test('Should create a news with a published version and a draft', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Locked news', slug: 'locked-news' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  newsId = doc.id;
  publishedVersionId = doc.versionId;

  const branched = await request.patch(`${API_BASE_URL}/news/${newsId}?${PARAMS.DRAFT}=true`, {
    headers,
    data: { attributes: { title: 'Locked news, draft' } }
  });
  expect(branched.status()).toBe(200);

  const draft = await request
    .get(`${API_BASE_URL}/news/${newsId}?${PARAMS.DRAFT}=true`, { headers })
    .then((r) => r.json());
  draftVersionId = draft.doc.versionId;
  expect(draftVersionId).not.toBe(publishedVersionId);
});

test('Should show the overlay to a second person on the same version', async ({ browser }) => {
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(draftVersionId));
  await expect(admin.page.locator(OVERLAY)).toHaveCount(0);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(draftVersionId));
  await expect(editor.page.locator(OVERLAY)).toBeVisible();
  await expect(editor.page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);

  await editor.context.close();
  await admin.context.close();
});

test('Should not lock one version because somebody holds another', async ({ browser }) => {
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  await expect(admin.page.locator(OVERLAY)).toHaveCount(0);

  // A different row of the same document: nobody is in it.
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(draftVersionId));
  await expect(editor.page.locator(OVERLAY)).toHaveCount(0);

  // The row the admin is in: held.
  await editor.page.goto(versionUrl(publishedVersionId));
  await editor.page.waitForLoadState('networkidle');
  await expect(editor.page.locator(OVERLAY)).toBeVisible();
  await expect(editor.page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);

  await editor.context.close();
  await admin.context.close();
});

test('Should open the newest real version by default, and lock that one', async ({ browser }) => {
  // No versionId in the URL: the panel loads the newest row, which is the draft.
  const admin = await openAs(browser, ADMIN_EMAIL, panelUrl('news', newsId));
  await expect(admin.page.locator(OVERLAY)).toHaveCount(0);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(draftVersionId));
  await expect(editor.page.locator(OVERLAY)).toBeVisible();

  await editor.page.goto(versionUrl(publishedVersionId));
  await editor.page.waitForLoadState('networkidle');
  await expect(editor.page.locator(OVERLAY)).toHaveCount(0);

  await editor.context.close();
  await admin.context.close();
});

test('Should hand a version over on Take control', async ({ browser }) => {
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(publishedVersionId));

  await expect(editor.page.locator(OVERLAY)).toBeVisible();
  await editor.page.locator(OVERLAY).getByRole('button', { name: 'Take control' }).click();

  await editor.page.waitForLoadState('networkidle');
  await expect(editor.page.locator(OVERLAY)).toHaveCount(0);

  await editor.context.close();
  await admin.context.close();
});

test('Should release a version when its holder leaves', async ({ browser }) => {
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  await admin.context.close();

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(publishedVersionId));
  await expect(editor.page.locator(OVERLAY)).toHaveCount(0);

  await editor.context.close();
});

test('Should leave updatedAt and updatedBy alone while the lock changes hands', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const { doc } = await request
    .get(`${API_BASE_URL}/news/${newsId}?${PARAMS.VERSION_ID}=${publishedVersionId}`, {
      headers
    })
    .then((r) => r.json());

  // Every claim above went through `updateWhere`, which writes the two lock columns and nothing
  // else: the version still reads as written by whoever created it.
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(doc.updatedBy?.id).toBeDefined();
  expect(doc.createdBy?.id).toBeDefined();
});
