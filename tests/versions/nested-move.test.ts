import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * A move in the tree of `pages`, a nested collection, that the server refuses: the panel says so
 * and shows the stored order again.
 */

const titles = (page: Page) => page.locator('.rz-collection-node__title').allTextContents();

test('A refused move shows an error and keeps the stored order', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  for (const title of ['Move A', 'Move B']) {
    const created = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title, slug: title.toLowerCase().replace(' ', '-') } }
    });
    expect(created.status()).toBe(200);
  }

  await page.addInitScript(() =>
    localStorage.setItem('collection.pages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));
  await expect.poll(() => titles(page)).toEqual(expect.arrayContaining(['Move A', 'Move B']));
  const before = await titles(page);
  // The lower of the two goes above the other
  const [upper, lower] = before.filter((title) => title.startsWith('Move '));

  // Every PATCH of a page is refused
  await page.route(
    (url) => url.pathname.startsWith('/api/pages/'),
    (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 403, body: '{}' })
        : route.continue()
  );

  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  await row(lower)
    .locator('.rz-collection-node__grip')
    .dragTo(row(upper), { targetPosition: { x: 20, y: 2 } });

  await expect(page.getByText('An error occurred')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(before);
});
