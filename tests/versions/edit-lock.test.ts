import { PARAMS } from '#lib/core/constants.js';
import { EDIT_LOCK_TTL_AFTER_CLOSE_MS } from '#lib/core/prototype/shared/metas/constant.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
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

/** The page's claim on the version: a POST to its lock, a release excepted. */
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
  await loginAs(page, email, PASSWORD);
  await page.goto(url);
  return { context, page };
}

/**
 * Whether the overlay is up, reloading until the answer settles.
 *
 * A tab that closes keeps its claim as a short lease, and the page only re-reads the lock on a
 * load — so a row somebody left a moment ago reads as held until the lease runs out, and a row
 * somebody just opened reads as free until their claim lands. Polling through reloads covers both.
 *
 * The overlay is drawn with the form, from the same load. A page without it claims the row as it
 * mounts, and answers once that claim has landed: whoever opens the row next finds it held.
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

let newsId: string;
let publishedVersionId: string;
let draftVersionId: string;

const versionUrl = (versionId: string) =>
  `${panelUrl('news', newsId)}?${PARAMS.VERSION_ID}=${versionId}`;

/**
 * Close a tab the way a real one closes.
 *
 * A closing tab hands its version back with a `pagehide` beacon, and a context Playwright tears
 * down never delivers one — the claim would stay for the whole TTL. The same release is sent
 * from here, with the page's cookies, for the version the page is on.
 */
async function leave({ context, page }: { context: BrowserContext; page: Page }) {
  const versionId = new URL(page.url()).searchParams.get(PARAMS.VERSION_ID);
  const query = versionId ? `${PARAMS.VERSION_ID}=${versionId}&release=true` : 'release=true';
  await page.request.post(`${API_BASE_URL}/news/${newsId}/lock?${query}`);
  await context.close();
}

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

/** A fresh news with a published version and a draft, so no earlier test's lease is on it. */
async function createNews(request: APIRequestContext) {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Locked news', slug: `locked-news-${Date.now()}` },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  newsId = doc.id;
  publishedVersionId = doc.versionId;

  const branched = await request.patch(`${API_BASE_URL}/news/${newsId}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Locked news, draft' } }
  });
  expect(branched.status()).toBe(200);

  const draft = await request
    .get(`${API_BASE_URL}/news/${newsId}?${PARAMS.LATEST}=true`, { headers })
    .then((r) => r.json());
  draftVersionId = draft.doc.versionId;
  expect(draftVersionId).not.toBe(publishedVersionId);
}

test('Should show the overlay to a second person on the same version', async ({
  browser,
  request
}) => {
  await createNews(request);
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(draftVersionId));
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(draftVersionId));
  await expectOverlay(editor.page, true);
  await expect(editor.page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);

  await leave(editor);
  await leave(admin);
});

test('Should not lock one version because somebody holds another', async ({ browser, request }) => {
  await createNews(request);
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  await expectOverlay(admin.page, false);

  // A different row of the same document: nobody is in it.
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(draftVersionId));
  await expectOverlay(editor.page, false);

  // The row the admin is in: held.
  await editor.page.goto(versionUrl(publishedVersionId));
  await expectOverlay(editor.page, true);
  await expect(editor.page.locator(OVERLAY)).toContainText(ADMIN_EMAIL);

  await leave(editor);
  await leave(admin);
});

test('Should open the newest real version by default, and lock that one', async ({
  browser,
  request
}) => {
  await createNews(request);
  // No versionId in the URL: the panel loads the newest row, which is the draft.
  const admin = await openAs(browser, ADMIN_EMAIL, panelUrl('news', newsId));
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(draftVersionId));
  await expectOverlay(editor.page, true);

  await editor.page.goto(versionUrl(publishedVersionId));
  await expectOverlay(editor.page, false);

  await leave(editor);
  await leave(admin);
});

test('Should hand a version over on Take control, and leave its authorship alone', async ({
  browser,
  request
}) => {
  await createNews(request);
  const headers = await signInSuperAdmin(request);
  const read = async () => {
    const response = await request.get(
      `${API_BASE_URL}/news/${newsId}?${PARAMS.VERSION_ID}=${publishedVersionId}`,
      { headers }
    );
    expect(response.status()).toBe(200);
    return (await response.json()).doc;
  };
  const before = await read();

  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  await expectOverlay(admin.page, false);

  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(publishedVersionId));
  await expectOverlay(editor.page, true);

  // Take control forces the claim past the admin's, then reloads onto a version it now holds.
  const reloaded = editor.page.waitForEvent('load');
  await editor.page.locator(OVERLAY).getByRole('button', { name: 'Take control' }).click();
  await reloaded;
  await expectOverlay(editor.page, false);
  // The admin's page hears the claim and shows the overlay without a reload
  await expect(admin.page.locator(OVERLAY)).toContainText(LOCK_EDITOR_EMAIL);

  await leave(editor);
  await leave(admin);

  // The claims wrote the lock columns only: the version still reads as the admin wrote it
  const after = await read();
  expect(after.updatedAt).toEqual(before.updatedAt);
  expect(after.updatedBy).toEqual(before.updatedBy);
  expect(after.updatedBy?.email).toBe(ADMIN_EMAIL);
});

test('Should release a version when its holder leaves', async ({ browser, request }) => {
  await createNews(request);
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  await expectOverlay(admin.page, false);
  // The admin leaves the document: the page's own `pagehide` sends the release
  await admin.page.goto(panelUrl());

  // Free again once the lease a closing tab keeps has run out.
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(publishedVersionId));
  await expectOverlay(editor.page, false);

  await leave(editor);
  await leave(admin);
});

test('An auto-save moves the lock onto the new row', async ({ browser, request }) => {
  await createNews(request);
  const admin = await openAs(browser, ADMIN_EMAIL, versionUrl(publishedVersionId));
  await expectOverlay(admin.page, false);

  const saved = admin.page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes(`${PARAMS.AUTO_SAVE}=true`)
  );
  await admin.page.locator('input[name="attributes.title"]').fill('Locked while typing');
  expect((await saved).status()).toBe(200);
  await admin.page.waitForURL((url) => {
    const versionId = url.searchParams.get(PARAMS.VERSION_ID);
    return !!versionId && versionId !== publishedVersionId;
  });
  const autoSaveId = new URL(admin.page.url()).searchParams.get(PARAMS.VERSION_ID)!;

  // The row being typed on is held; the row it branched from was handed back.
  const editor = await openAs(browser, LOCK_EDITOR_EMAIL, versionUrl(autoSaveId));
  await expectOverlay(editor.page, true);
  await editor.page.goto(versionUrl(publishedVersionId));
  await expectOverlay(editor.page, false);

  await leave(editor);
  await leave(admin);
});
