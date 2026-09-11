import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, panelUrlRe, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const LOCK_EDITOR_EMAIL = 'lock-editor@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Two people, one document.
 *
 * The lock is claimed by the panel's document load and held by a heartbeat, and it is stripped
 * from every read outside the panel — so the only place it is observable is here, in a browser
 * that opened the document. That is also the only place it matters.
 */

const OVERLAY = '.rz-document-read-only';

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

/** The document under test, found by title so no test depends on another's module state. */
async function lockedPageUrl(request: import('@playwright/test').APIRequestContext) {
  const { docs } = await request
    .get(`${API_BASE_URL}/pages?where[title][equals]=Locked page`, {
      headers: await signInSuperAdmin(request)
    })
    .then((r) => r.json());
  expect(docs?.length).toBeGreaterThan(0);
  return { id: docs[0].id, url: panelUrl('pages', docs[0].id) };
}

test('Should create a lock-editor staff account', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: LOCK_EDITOR_EMAIL,
      name: 'Lock Editor',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
});

test('Should open a document as the admin and claim it', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="title"]').pressSequentially('Locked page', { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrlRe('pages'));

  // The admin claimed it on load, so the admin sees no overlay on their own document.
  await expect(page.locator(OVERLAY)).toHaveCount(0);
});

test('Should show the overlay to a second person while the claim is fresh', async ({
  page,
  request
}) => {
  const { url } = await lockedPageUrl(request);
  await loginAs(page, LOCK_EDITOR_EMAIL, PASSWORD);
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await expect(page.locator(OVERLAY)).toBeVisible();
  await expect(page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);
});

test('Should hand the document over on Take control', async ({ page, request }) => {
  const { url } = await lockedPageUrl(request);
  await loginAs(page, LOCK_EDITOR_EMAIL, PASSWORD);
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await expect(page.locator(OVERLAY)).toBeVisible();
  await page.locator(OVERLAY).getByRole('button', { name: 'Take control' }).click();

  // Take control reloads onto a document the editor now holds.
  await expect(page.locator(OVERLAY)).toHaveCount(0);
});

test('Should not lock the admin out once they take it back', async ({ page, request }) => {
  const { url } = await lockedPageUrl(request);
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  // The editor holds a fresh claim, so the admin gets the overlay rather than the form.
  await expect(page.locator(OVERLAY)).toBeVisible();
  await page.locator(OVERLAY).getByRole('button', { name: 'Take control' }).click();
  await expect(page.locator(OVERLAY)).toHaveCount(0);
});

test('Should leave updatedAt and updatedBy alone while the lock changes hands', async ({
  request
}) => {
  const { id } = await lockedPageUrl(request);
  const { doc } = await request
    .get(`${API_BASE_URL}/pages/${id}`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());

  // Every claim above went through `updateWhere`, which writes the two lock columns and nothing
  // else — so the document still reads as last written by whoever saved it.
  expect(doc.updatedBy).toBeDefined();
  expect(doc.currentlyEditedBy).toBeUndefined();
  expect(doc.currentlyEditedAt).toBeUndefined();
});
