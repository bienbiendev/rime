import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Upload directories from the panel: a folder is created through the grid's context menu.
 *
 * The directories collection writes its own `id` (`parent:name`) as the name is typed, so the
 * create form must still post as a create once the id is there.
 */

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

  // The listing opens as a list; the context menu belongs to the grid.
  await page
    .locator('.rz-header-display-mode')
    .getByRole('button', { name: 'Show as a grid' })
    .click();
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

test('The new-folder dialog opens empty after a folder is created', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg'));
  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: 'leaves.jpg' }, alt: 'leaves' }
  });
  expect(uploaded.status()).toBe(200);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('medias'));
  await page
    .locator('.rz-header-display-mode')
    .getByRole('button', { name: 'Show as a grid' })
    .click();
  await expect(page.locator('.rz-page-collection__grid')).toBeVisible();

  const openDialog = async () => {
    await page
      .locator('.rz-collection-grid__context-menu-trigger')
      .dispatchEvent('contextmenu', { clientX: 20, clientY: 20 });
    await page.getByRole('menuitem', { name: 'New folder' }).click();
    return page.getByRole('dialog');
  };

  const first = await openDialog();
  await first.locator('input[name="name"]').fill('first-in-a-row');
  await first.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('.rz-folder', { hasText: 'first-in-a-row' })).toBeVisible();
  await expect(first).toBeHidden();

  const second = await openDialog();
  await expect(second.locator('input[name="name"]')).toHaveValue('');
  await expect(second.getByRole('button', { name: 'Create' })).toBeDisabled();
});

test('A renamed folder shows its new name and opens its new path', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg'));
  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: 'leaves.jpg' }, alt: 'leaves' }
  });
  expect(uploaded.status()).toBe(200);
  const created = await request.post(`${API_BASE_URL}/medias-directories`, {
    headers,
    data: { id: 'root:rename-me', name: 'rename-me', parent: 'root' }
  });
  expect(created.status()).toBe(200);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('medias'));
  await page
    .locator('.rz-header-display-mode')
    .getByRole('button', { name: 'Show as a grid' })
    .click();
  await expect(page.locator('.rz-page-collection__grid')).toBeVisible();

  await page.locator('.rz-folder', { hasText: 'rename-me' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('renamed');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  const renamed = page.locator('.rz-folder', { hasText: 'renamed' });
  await expect(renamed).toBeVisible();
  await expect(page.locator('.rz-folder', { hasText: 'rename-me' })).toHaveCount(0);
  await renamed.click();
  await page.waitForURL((url) => url.searchParams.get('uploadPath') === 'root:renamed');
});

/**
 * A folder moves the way the panel drops it on another: a PATCH of its `id`. Its sub-folders
 * follow, and so do the files in them.
 */
test('Moving a folder moves its sub-folders and the files in them', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // A media in root:move-a:sub, which creates both folders
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg'));
  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: 'leaves.jpg' }, alt: 'moved', _path: 'root:move-a:sub' }
  });
  expect(uploaded.status()).toBe(200);
  const media = (await uploaded.json()).doc;
  expect(media._path).toBe('root:move-a:sub');

  const target = await request.post(`${API_BASE_URL}/medias-directories`, {
    headers,
    data: { id: 'root:move-b', name: 'move-b', parent: 'root' }
  });
  expect(target.status()).toBe(200);

  const moved = await request.patch(`${API_BASE_URL}/medias-directories/root:move-a`, {
    headers,
    data: { id: 'root:move-b:move-a' }
  });
  expect(moved.status()).toBe(200);

  const folder = (id: string) =>
    request.get(`${API_BASE_URL}/medias-directories/${id}`, { headers });
  expect((await folder('root:move-a')).status()).toBe(404);
  expect((await folder('root:move-a:sub')).status()).toBe(404);
  const sub = await folder('root:move-b:move-a:sub');
  expect(sub.status()).toBe(200);
  expect((await sub.json()).doc.parent).toBe('root:move-b:move-a');

  const read = await request.get(`${API_BASE_URL}/medias/${media.id}`, { headers });
  expect(read.status()).toBe(200);
  expect((await read.json()).doc._path).toBe('root:move-b:move-a:sub');
});

/**
 * Deleting a folder deletes its sub-folders and the documents filed in them, each through its own
 * delete, so their files leave the disk.
 */
test('Deleting a folder deletes its sub-folders, their documents and their files', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const run = Date.now();

  // Bytes unique to each upload, so no file is shared with another row
  const upload = async (name: string, _path: string) => {
    const payload = Buffer.from(`${name}-${run}`).toString('base64');
    const response = await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: {
        file: { base64: `data:text/plain;base64,${payload}`, filename: `${name}-${run}.txt` },
        alt: name,
        _path
      }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc;
  };
  const top = await upload('top', `root:del-${run}`);
  const nested = await upload('nested', `root:del-${run}:sub`);

  const deleted = await request.delete(`${API_BASE_URL}/medias-directories/root:del-${run}`, {
    headers
  });
  expect(deleted.status()).toBe(200);

  const sub = await request.get(`${API_BASE_URL}/medias-directories/root:del-${run}:sub`, {
    headers
  });
  expect(sub.status()).toBe(404);
  expect((await request.get(`${API_BASE_URL}/medias/${top.id}`, { headers })).status()).toBe(404);
  expect((await request.get(`${API_BASE_URL}/medias/${nested.id}`, { headers })).status()).toBe(
    404
  );
  expect((await request.get(`${BASE_URL}${top.url}`)).status()).toBe(404);
  expect((await request.get(`${BASE_URL}${nested.url}`)).status()).toBe(404);
});
