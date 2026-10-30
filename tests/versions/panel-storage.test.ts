import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * What the panel keeps in the browser's storage shows from the first render: the navigation
 * group `content`, and the display of `pages`. Where the browser blocks storage, the panel
 * works with the defaults.
 */

/** The navigation group `content`. */
const contentGroup = (page: Page) => page.locator('.rz-nav-group', { hasText: 'content' });

test('A folded navigation group shows folded after a reload, with no animation', async ({
  page
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));

  const label = contentGroup(page).locator('.rz-nav-group__label');
  await label.click();
  await expect(label).toHaveAttribute('aria-expanded', 'false');

  await page.reload();
  await expect(label).toHaveAttribute('aria-expanded', 'false');
  const running = await contentGroup(page)
    .locator('.rz-nav-group__content')
    .evaluate((content) => content.getAnimations().length);
  expect(running).toBe(0);
});

test('A list stored as a tree shows the tree without a list first', async ({ page, request }) => {
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { title: 'Stored tree', slug: 'stored-tree' } }
  });
  expect(created.status()).toBe(200);

  await page.addInitScript(() => {
    localStorage.setItem('collection.pages.display', 'display_nested');
    // Notes any list row the page renders, however briefly
    new MutationObserver(() => {
      if (document.querySelector('.rz-list-row')) {
        document.documentElement.dataset.listRowSeen = '';
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));

  await expect(page.locator('.rz-collection-node__row').first()).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-list-row-seen');
});

test('With storage blocked, the panel shows its defaults and a fold holds for the visit', async ({
  page,
  request
}) => {
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { title: 'No storage', slug: 'no-storage' } }
  });
  expect(created.status()).toBe(200);
  const id = (await created.json()).doc.id as string;

  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      }
    });
  });
  await loginAs(page, ADMIN_EMAIL, PASSWORD);

  await page.goto(panelUrl('pages'));
  await expect(page.locator('.rz-list-row').first()).toBeVisible();
  const label = contentGroup(page).locator('.rz-nav-group__label');
  await label.click();
  await expect(label).toHaveAttribute('aria-expanded', 'false');

  await page.goto(panelUrl('pages', id));
  await expect(
    page.locator('.rz-group-field__trigger').filter({ hasText: 'Attributes' })
  ).toBeVisible();
  expect(errors).toEqual([]);
});
