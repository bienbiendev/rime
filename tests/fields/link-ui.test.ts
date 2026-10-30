import test, { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const SAVE = 'button[data-submit]';

test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The link of the `links` tree of the `pages` fixture, in the panel, when it points to a
 * document: `link('url').types('url', 'email', 'homepage', 'pages')`.
 */

/** A page with a slug, so it opens with nothing to save, holding `links`. */
async function createPage(request: APIRequestContext, title: string, links: unknown[] = []) {
  const slug = `${title.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title, slug, links }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
}

/** The saved link of the first tree item of the page `id`. */
async function savedLink(request: APIRequestContext, id: string) {
  const response = await request.get(`${API_BASE_URL}/pages/${id}`, {
    headers: await signInSuperAdmin(request)
  });
  const { type, value } = (await response.json()).doc.links[0].url;
  return { type, value };
}

/** Opens the page `id` and its first tree item, and answers that item's link fieldset. */
async function openLink(page: Page, id: string) {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));
  await page
    .locator('.rz-tree-item[data-path="links.0"] > .rz-tree-item__header .rz-tree-item__toggle')
    .click();
  return page.locator('fieldset[data-path="links.0.url"]');
}

/** Picks the link type named `name` in the type menu of `fieldset`. */
async function pickType(page: Page, fieldset: Locator, name: string) {
  await fieldset.locator('.rz-link__type').click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
}

test('A link switched from an area to a collection holds no document', async ({
  page,
  request
}) => {
  const id = await createPage(request, 'Link switch', [{ label: 'Item', _children: [] }]);
  const fieldset = await openLink(page, id);

  // The area's one document is picked on its own
  await pickType(page, fieldset, 'Homepage');
  await expect(fieldset.locator('.rz-tag')).toHaveText('homepage');

  await pickType(page, fieldset, 'Page');
  await expect(fieldset.locator('.rz-tag')).toHaveCount(0);

  await page.locator(SAVE).click();
  await expect.poll(() => savedLink(request, id)).toEqual({ type: 'pages', value: null });
});

test('A link holds the last document picked', async ({ page, request }) => {
  const stamp = Date.now();
  await createPage(request, `First ${stamp}`);
  const secondId = await createPage(request, `Second ${stamp}`);
  const id = await createPage(request, 'Link repick', [{ label: 'Item', _children: [] }]);
  const fieldset = await openLink(page, id);

  await pickType(page, fieldset, 'Page');
  const search = fieldset.locator('.rz-ressource-input input');
  await search.click();
  await search.pressSequentially(`First ${stamp}`, { delay: 30 });
  await page.getByRole('option', { name: `First ${stamp}` }).click();
  await expect(fieldset.locator('.rz-tag')).toHaveText(`First ${stamp}`);

  await fieldset.locator('.rz-tag__button').click();
  await search.click();
  await search.pressSequentially(`Second ${stamp}`, { delay: 30 });
  await page.getByRole('option', { name: `Second ${stamp}` }).click();
  await expect(fieldset.locator('.rz-tag')).toHaveText(`Second ${stamp}`);

  await page.locator(SAVE).click();
  await expect.poll(() => savedLink(request, id)).toEqual({ type: 'pages', value: secondId });
});

test('Of two documents with the same title, the keyboard picks the highlighted one', async ({
  page,
  request
}) => {
  const title = `Contact ${Date.now()}`;
  await createPage(request, title);
  await createPage(request, title);
  const id = await createPage(request, 'Link same title', [{ label: 'Item', _children: [] }]);
  const fieldset = await openLink(page, id);

  await pickType(page, fieldset, 'Page');
  const search = fieldset.locator('.rz-ressource-input input');
  await search.click();
  await search.pressSequentially(title, { delay: 30 });
  const options = page.getByRole('option', { name: title });
  await expect(options).toHaveCount(2);

  // The down arrow moves the highlight to the second entry alone
  await search.press('ArrowDown');
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  const secondId = await options.nth(1).getAttribute('data-value');

  await search.press('Enter');
  await page.locator(SAVE).click();
  await expect.poll(() => savedLink(request, id)).toEqual({ type: 'pages', value: secondId });
});

test('A link search that finds no document says so in the panel language', async ({
  page,
  request
}) => {
  const id = await createPage(request, 'Link empty', [{ label: 'Item', _children: [] }]);
  const fieldset = await openLink(page, id);

  await pickType(page, fieldset, 'Page');
  const search = fieldset.locator('.rz-ressource-input input');
  await search.click();
  // No title holds these letters, and no id either: an id is hexadecimal
  await search.pressSequentially('qqqzzz', { delay: 30 });
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(fieldset.locator('.rz-command-empty')).toHaveText('Nothing found');
});

test('A link search matches the document titles, not their ids', async ({ page, request }) => {
  // No hexadecimal letter and no digit: the title cannot match a piece of an id
  const pageId = await createPage(request, 'Sunny hills');
  const id = await createPage(request, 'Link search ids', [{ label: 'Item', _children: [] }]);
  const fieldset = await openLink(page, id);

  await pickType(page, fieldset, 'Page');
  const search = fieldset.locator('.rz-ressource-input input');
  await search.click();
  await search.pressSequentially('Sunny', { delay: 30 });
  await expect(page.locator(`[role="option"][data-value="${pageId}"]`)).toHaveCount(1);

  await search.fill('');
  await search.pressSequentially(pageId.slice(0, 4), { delay: 30 });
  await expect(page.locator(`[role="option"][data-value="${pageId}"]`)).toHaveCount(0);
});
