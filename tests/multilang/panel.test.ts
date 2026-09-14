import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const TITLE = 'input[name="attributes.title"]';

/**
 * The panel's language switcher on a document with unsaved changes.
 *
 * `pages` does not auto-save, so a switch with something typed asks first. Confirming drops the
 * typing and reloads in the other locale; cancelling keeps both the typing and the locale.
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

let pageId: string;

test('Should create a page', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { title: 'Page à traduire', slug: 'page-a-traduire' } }
  });
  expect(response.status()).toBe(200);
  pageId = (await response.json()).doc.id;
});

test('Switching locale with unsaved changes asks first', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', pageId));
  await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: 'attributes' }).click();
  await expect(page.locator(TITLE)).toHaveValue('Page à traduire');

  await page.locator(TITLE).fill('Page à traduire, modifiée');
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();

  // Cancel: the typing and the locale stay.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button').nth(1).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(TITLE)).toHaveValue('Page à traduire, modifiée');
  await expect(page.getByRole('button', { name: 'Français' })).toBeVisible();

  // Confirm: the page reloads in English, the typing is gone.
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button').first().click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await page.getByRole('tab', { name: 'attributes' }).click();
  await expect(page.locator(TITLE)).not.toHaveValue('Page à traduire, modifiée');
});
