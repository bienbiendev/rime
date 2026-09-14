import { filePathToBase64 } from '$lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type Page } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Upload directories from the panel: a folder is created through the grid's context menu.
 *
 * The directories collection writes its own `id` (`parent:name`) as the name is typed, so the
 * create form must still post as a create once the id is there.
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

test('The panel create action makes a directory', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const response = await request.post(`${panelUrl('medias-directories', 'create')}?/create`, {
    headers: { ...headers, 'x-sveltekit-action': 'true' },
    form: { id: 'root:from-action', name: 'from-action', parent: 'root' }
  });
  expect((await response.json()).type).toBe('success');

  const read = await request.get(`${API_BASE_URL}/medias-directories/root:from-action`, {
    headers
  });
  expect(read.status()).toBe(200);
  expect((await read.json()).doc.name).toBe('from-action');
});

test('A folder is created from the grid', async ({ page, request }) => {
  // The grid, and its context menu, only show once the collection has a document.
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg'));
  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: 'leaves.jpg' }, alt: 'leaves' }
  });
  expect(uploaded.status()).toBe(200);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('medias'));
  await page.waitForLoadState('networkidle');

  // The listing opens as a list; the context menu belongs to the grid.
  await page.locator('.rz-header-display-mode button').nth(1).click();
  await expect(page.locator('.rz-page-collection__grid')).toBeVisible();

  // The trigger sits behind the grid's items, so the event is dispatched rather than clicked.
  await page
    .locator('.rz-collection-grid__context-menu-trigger')
    .dispatchEvent('contextmenu', { clientX: 20, clientY: 20 });
  await page.getByRole('menuitem', { name: 'New folder' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('from-grid');

  // The create action, on the create route, whatever the form holds as id by now.
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/medias-directories/')
  );
  await dialog.getByRole('button', { name: 'Create' }).click();
  const response = await created;
  expect(new URL(response.url()).pathname).toBe(
    new URL(panelUrl('medias-directories', 'create')).pathname
  );
  expect(response.status()).toBe(200);

  await expect(page.locator('.rz-folder', { hasText: 'from-grid' })).toBeVisible();

  const read = await request.get(`${API_BASE_URL}/medias-directories/root:from-grid`, {
    headers
  });
  expect(read.status()).toBe(200);
  expect((await read.json()).doc.parent).toBe('root');
});
