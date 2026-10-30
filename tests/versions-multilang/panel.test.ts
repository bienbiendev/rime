import { PARAMS } from '#lib/core/constants.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const TITLE = 'input[name="attributes.title"]';

/**
 * The panel on `news`, localized with drafts; the default locale is `en`.
 */

/** A new draft row of the news `id`, copied from the published one, with an English title. */
async function forkDraft(request: APIRequestContext, id: string, title: string) {
  const response = await request.patch(`${API_BASE_URL}/news/${id}?${PARAMS.FORK}=true`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { title } }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.versionId as string;
}

test('Import from default locale copies the row on screen and the save writes that row', async ({
  page,
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Import v1', slug: `import-row-${Date.now()}` },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const id = (await created.json()).doc.id as string;
  // Two drafts: v2, the row opened, then v3, the newest
  const v2 = await forkDraft(request, id, 'Import v2');
  const v3 = await forkDraft(request, id, 'Import v3');

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('news', id)}?${PARAMS.VERSION_ID}=${v2}`);
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('menuitem', { name: 'Français' }).click();
  await expect(page.getByRole('button', { name: 'Français' })).toBeVisible();

  await page.getByRole('button', { name: 'Document actions' }).click();
  await page.getByRole('menuitem', { name: 'Import data from en' }).click();
  await expect(page.locator(TITLE)).toHaveValue('Import v2');

  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );
  await page.locator('button[data-submit]').click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  expect(new URL(response.url()).searchParams.get(PARAMS.VERSION_ID)).toBe(v2);

  const read = (versionId: string) =>
    request
      .get(`${API_BASE_URL}/news/${id}?${PARAMS.VERSION_ID}=${versionId}&locale=fr`, { headers })
      .then((r) => r.json())
      .then((r) => r.doc);
  expect((await read(v2)).attributes.title).toBe('Import v2');
  expect((await read(v3)).attributes.title).not.toBe('Import v2');
});
