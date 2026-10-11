import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const SAVE = 'button[data-submit]';

test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The `links` tree of the `pages` fixture, in the panel: each item's ⋯ menu, and what deleting
 * a nested item leaves behind.
 */

async function createPage(request: APIRequestContext, title: string, links: unknown[]) {
  const slug = `${title.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title, slug, links }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
}

/** The header of the item at `path`, not of the items inside it. */
const headerOf = (page: Page, path: string) =>
  page.locator(`.rz-tree-item[data-path="${path}"] > .rz-tree-item__header`);

test('A tree item shows its actions when its header is hovered', async ({ page, request }) => {
  const id = await createPage(request, 'Tree hover', [{ label: 'Hover me', _children: [] }]);
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));

  const header = headerOf(page, 'links.0');
  await header.hover();
  await expect(header.locator('.rz-repeatable-actions')).toHaveCSS('opacity', '1');
});

test('Deleting a nested item with an error lets the document be saved, without it', async ({
  page,
  request
}) => {
  const id = await createPage(request, 'Tree errors', [
    {
      label: 'Parent',
      _children: [
        { label: 'First', _children: [] },
        { label: 'Second', _children: [] }
      ]
    }
  ]);
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));

  // A saved item opens closed: open the parent, then its second child
  await headerOf(page, 'links.0').locator('.rz-tree-item__toggle').click();
  await headerOf(page, 'links.0._children.1').locator('.rz-tree-item__toggle').click();

  // An invalid url on the second child holds the save
  await page.locator('input[name="links.0._children.1.url"]').fill('not a url');
  await expect(page.locator(SAVE)).toBeDisabled();

  await headerOf(page, 'links.0._children.1').getByRole('button', { name: 'Item actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete item' }).click();

  await expect(page.locator('.rz-tree-item[data-path="links.0._children.1"]')).toHaveCount(0);
  await expect(page.locator(SAVE)).toBeEnabled();

  await page.locator(SAVE).click();
  await expect
    .poll(async () => {
      const response = await request.get(`${API_BASE_URL}/pages/${id}`, {
        headers: await signInSuperAdmin(request)
      });
      return (await response.json()).doc.links[0]._children.map(
        (item: { label: string }) => item.label
      );
    })
    .toEqual(['First']);
});
