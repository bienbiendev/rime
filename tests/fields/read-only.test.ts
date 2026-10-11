import test, { expect } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const EDITOR_EMAIL = 'ro-editor@email.com';

/**
 * A `bulletins` document opened by an editor, who may read it but not update it: no control
 * changes the value, and the live editor does not open.
 */

// The tests open the bulletin and sign in the editor the first test creates: one failing skips the
// rest
test.describe.configure({ mode: 'serial' });

let documentUrl: string;

test('Should create a bulletin and an editor', async ({ request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const created = await request.post(`${API_BASE_URL}/bulletins`, {
    headers,
    data: { title: 'Weekly', topics: ['news', 'events'] }
  });
  expect(created.status()).toBe(200);
  documentUrl = panelUrl('bulletins', (await created.json()).doc.id);

  const editor = await request.post(`${API_BASE_URL}/staff`, {
    headers,
    data: { email: EDITOR_EMAIL, name: 'RO Editor', roles: ['editor'], password: PASSWORD }
  });
  expect(editor.status()).toBe(200);
});

test('Should keep a select value in a read-only document', async ({ page }) => {
  await loginAs(page, EDITOR_EMAIL, PASSWORD);
  await page.goto(documentUrl);

  const tags = page.locator('.rz-select__option .rz-tag');
  await expect(tags).toHaveCount(2);
  const remove = tags.first().locator('.rz-tag__button');
  await expect(remove).toBeDisabled();
  await remove.click({ force: true });
  await expect(tags).toHaveCount(2);
});

test('Should not open the live editor from a read-only document', async ({ page }) => {
  await loginAs(page, EDITOR_EMAIL, PASSWORD);
  await page.goto(documentUrl);

  const live = page.locator('.rz-button-live');
  await expect(live).toHaveAttribute('aria-disabled', 'true');
  await expect(live).not.toHaveAttribute('href');

  // An admin, who may update it, gets the link
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl);
  await expect(page.locator('.rz-button-live')).toHaveAttribute('href', /.+/);
});
