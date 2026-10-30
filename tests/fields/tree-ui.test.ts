import test, { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const SAVE = 'button[data-submit]';

test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The `links` tree of the `pages` fixture, in the panel: each item's ⋯ menu, what deleting a
 * nested item leaves behind, and a drop inside an item just saved.
 */

/** A page with a slug, so it opens with nothing to save, holding `links`. */
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

/** Saves, and waits for the server's answer. */
async function save(page: Page) {
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );
  await page.locator(SAVE).click();
  expect((await saved).status()).toBe(200);
}

async function readLinks(page: Page, docId: string) {
  const response = await page.request.get(`${API_BASE_URL}/pages/${docId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).doc.links as { label: string; _children: unknown[] }[];
}

/**
 * Drags `from` onto the middle of `to`, in steps: Sortable's fallback drag follows the mouse. The
 * target is measured once the drag has started, the dragged card's place being a line by then.
 */
async function dragTo(page: Page, from: Locator, to: Locator) {
  const start = (await from.boundingBox())!;
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 8, { steps: 4 });
  const end = (await to.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 16 });
  await page.mouse.up();
}

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

test('An item added and saved takes a drop inside it', async ({ page, request }) => {
  const docId = await createPage(request, 'Tree drop', [{ label: 'Home', _children: [] }]);
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));
  await page.waitForLoadState('networkidle');

  const links = page.locator('fieldset[data-path="links"]');
  await links.locator('.rz-tree__actions .rz-add-item-button').click();
  await page.locator('input[name="links.1.label"]').fill('About');
  await save(page);

  // Saved, About takes its real id: its card is new, and opens closed
  const about = headerOf(page, 'links.1').locator('.rz-tree-item__toggle');
  await expect(about).toHaveAttribute('aria-expanded', 'false');
  await about.click();

  // Home, dragged by its grip into About's "Inside" list
  await dragTo(
    page,
    headerOf(page, 'links.0').locator('.rz-tree-item__grip'),
    page.locator('.rz-tree__list[data-path="links.1"]')
  );
  await expect(page.locator('.rz-tree-item[data-path="links.0._children.0"]')).toHaveCount(1);
  await save(page);
  await expect
    .poll(async () => (await readLinks(page, docId)).map((item) => item.label))
    .toEqual(['About']);
  expect((await readLinks(page, docId))[0]._children).toHaveLength(1);
});
