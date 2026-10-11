import { EDIT_LOCK_TTL_AFTER_CLOSE_MS } from '#lib/core/prototype/shared/metas/constant.js';
import test, {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type Response
} from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const LOCK_EDITOR_EMAIL = 'lock-editor@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const DOCUMENT = 'form.rz-document';
const OVERLAY = '.rz-document-read-only';

/** The page's claim on the document: a POST to its lock, a release excepted. */
const isClaim = (response: Response) => {
  const url = new URL(response.url());
  return (
    response.request().method() === 'POST' &&
    url.pathname.endsWith('/lock') &&
    !url.searchParams.has('release')
  );
};

// A closed tab keeps its claim for EDIT_LOCK_TTL_AFTER_CLOSE_MS; the release check waits it out.
// Every test signs in the lock-editor the first one creates: one failing skips the rest.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

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
  await loginAs(page, email, PASSWORD);
  await page.goto(url);
  return { context, page };
}

/**
 * Whether the overlay is up, reloading until the answer settles.
 *
 * A tab that closes keeps its claim as a short lease, and the page only re-reads the lock on a
 * load — so a document somebody left a moment ago reads as held until the lease runs out, and one
 * somebody just opened reads as free until their claim lands. Polling through reloads covers both.
 *
 * The overlay is drawn with the form, from the same load. A page without it claims the document
 * as it mounts, and answers once that claim has landed: whoever opens the document next finds it
 * held.
 */
async function expectOverlay(page: Page, visible: boolean) {
  await expect
    .poll(
      async () => {
        // Caught: a page under the overlay sends no claim, and this wait is dropped.
        const claimed = page.waitForResponse(isClaim).catch(() => null);
        await page.reload();
        await expect(page.locator(DOCUMENT)).toBeVisible();
        const shown = await page.locator(OVERLAY).count();
        if (!shown) {
          await claimed;
        }
        return shown;
      },
      { timeout: EDIT_LOCK_TTL_AFTER_CLOSE_MS * 2, intervals: [500, 1000, 2000] }
    )
    .toBe(visible ? 1 : 0);
}

/**
 * Close a tab the way a real one closes.
 *
 * A closing tab hands the document back with a `pagehide` beacon, and a context Playwright tears
 * down never delivers one — the claim would stay for the whole TTL. The same release is sent from
 * here, with the page's cookies.
 */
async function leave({ context, page }: { context: BrowserContext; page: Page }, id: string) {
  await page.request.post(`${API_BASE_URL}/pages/${id}/lock?release=true`);
  await context.close();
}

/**
 * A fresh page for one test, so no earlier test's lease is on it.
 *
 * The slug is set: an empty one fills itself from the title when the document opens, which leaves
 * the form with a change.
 */
async function createLockedPage(request: APIRequestContext) {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Locked page', slug: `locked-page-${Date.now()}` }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  return { id: doc.id as string, url: panelUrl('pages', doc.id), created: doc };
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

test('Should show the overlay to a second person while the first holds it', async ({
  browser,
  request
}) => {
  const { id, url } = await createLockedPage(request);

  // The admin opens it and stays there — the claim is made by the load and held by the heartbeat.
  const admin = await openAs(browser, ADMIN_EMAIL, url);
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, url);
  await expectOverlay(editor.page, true);
  await expect(editor.page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);

  await leave(editor, id);
  await leave(admin, id);
});

test('Should hand the document over on Take control, and leave its authorship alone', async ({
  browser,
  request
}) => {
  const { id, url, created } = await createLockedPage(request);

  const admin = await openAs(browser, ADMIN_EMAIL, url);
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, url);
  await expectOverlay(editor.page, true);

  // Take control forces the claim past the admin's, then reloads onto a document it now holds.
  const reloaded = editor.page.waitForEvent('load');
  await editor.page.locator(OVERLAY).getByRole('button', { name: 'Take control' }).click();
  await reloaded;
  await expectOverlay(editor.page, false);
  // The admin's page hears the claim and shows the overlay without a reload
  await expect(admin.page.locator(OVERLAY)).toContainText(LOCK_EDITOR_EMAIL);

  await leave(editor, id);
  await leave(admin, id);

  // The claims wrote the lock columns only: the document still reads as the admin created it
  const response = await request.get(`${API_BASE_URL}/pages/${id}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.updatedAt).toEqual(created.updatedAt);
  expect(doc.updatedBy).toEqual(created.updatedBy);
  expect(doc.updatedBy?.email).toBe(ADMIN_EMAIL);
});

test('Should release the document when its holder leaves', async ({ browser, request }) => {
  const { id, url } = await createLockedPage(request);

  const admin = await openAs(browser, ADMIN_EMAIL, url);
  await expectOverlay(admin.page, false);

  // While the admin holds it, the editor gets the overlay
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, url);
  await expectOverlay(editor.page, true);

  // The admin leaves the document: the page's own `pagehide` sends the release
  await admin.page.goto(panelUrl());

  // Free again once the lease a closing tab keeps has run out — long before the TTL.
  await expectOverlay(editor.page, false);

  await leave(editor, id);
  await leave(admin, id);
});
