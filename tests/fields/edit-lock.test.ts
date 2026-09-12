import { EDIT_LOCK_TTL_AFTER_CLOSE_MS } from '$lib/core/prototype/shared/metas/constant';
import test, { expect, type Browser, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, panelUrlRe, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const LOCK_EDITOR_EMAIL = 'lock-editor@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const OVERLAY = '.rz-document-read-only';

// A closed tab keeps its claim for EDIT_LOCK_TTL_AFTER_CLOSE_MS, and the checks below wait it out.
test.describe.configure({ timeout: 90_000 });

/**
 * Two people, one document.
 *
 * **Two browser contexts, both open at once**, because that is the only arrangement the lock is
 * about. One tab that opens the document and then navigates away has released it on the way out —
 * correctly — so a single-context test can never see an overlay, whatever the lock does.
 *
 * The lock is also panel-only in practice: it is claimed by the document load, held by a heartbeat
 * and read from the page, so a browser that has the document open is the only place it is visible.
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

/**
 * Whether the overlay is up, reloading until the answer settles.
 *
 * A tab that closes keeps its claim as a short lease, and the page only re-reads the lock on a
 * load — so a document somebody left a moment ago reads as held until the lease runs out, and one
 * somebody just opened reads as free until their claim lands. Polling through reloads covers both.
 */
async function expectOverlay(page: Page, visible: boolean) {
  await expect
    .poll(
      async () => {
        await page.reload();
        await page.waitForLoadState('networkidle');
        return page.locator(OVERLAY).count();
      },
      { timeout: EDIT_LOCK_TTL_AFTER_CLOSE_MS * 2, intervals: [500, 1000, 2000] }
    )
    .toBe(visible ? 1 : 0);
}

/** The document under test, found by title so no test depends on another's module state. */
async function lockedPage(request: import('@playwright/test').APIRequestContext) {
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

test('Should create the document under test', async ({ page }) => {
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(ADMIN_EMAIL, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());

  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="title"]').pressSequentially('Locked page', { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrlRe('pages'));
});

test('Should show the overlay to a second person while the first holds it', async ({
  browser,
  request
}) => {
  const { url } = await lockedPage(request);

  // The admin opens it and stays there — the claim is made by the load and held by the heartbeat.
  const admin = await openAs(browser, ADMIN_EMAIL, url);
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, url);
  await expectOverlay(editor.page, true);
  await expect(editor.page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);

  await editor.context.close();
  await admin.context.close();
});

test('Should hand the document over on Take control', async ({ browser, request }) => {
  const { url } = await lockedPage(request);

  const admin = await openAs(browser, ADMIN_EMAIL, url);
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, url);
  await expectOverlay(editor.page, true);
  await editor.page.locator(OVERLAY).getByRole('button', { name: 'Take control' }).click();

  // Take control forces the claim past the admin's, then reloads onto a document it now holds.
  await editor.page.waitForLoadState('networkidle');
  await expectOverlay(editor.page, false);

  await editor.context.close();
  await admin.context.close();
});

test('Should release the document when its holder leaves', async ({ browser, request }) => {
  const { url } = await lockedPage(request);

  const admin = await openAs(browser, ADMIN_EMAIL, url);
  await expectOverlay(admin.page, false);
  await admin.context.close();

  // Free again once the lease a closing tab keeps has run out — long before the TTL.
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, url);
  await expectOverlay(editor.page, false);

  await editor.context.close();
});

test('Should leave updatedAt and updatedBy alone while the lock changes hands', async ({
  request
}) => {
  const { id } = await lockedPage(request);
  const headers = await signInSuperAdmin(request);

  const { doc } = await request
    .get(`${API_BASE_URL}/pages/${id}`, { headers })
    .then((r) => r.json());

  // Every claim above went through `updateWhere`, which writes the two lock columns and nothing
  // else — so the document still reads as last written by whoever saved it.
  expect(doc.updatedBy).toBeDefined();
  expect(doc.createdBy).toBeDefined();
});
