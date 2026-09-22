import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * The command palette: ⌘K lists what the page and its focus offer, ⌘⇧K the whole panel and a
 * search over it, and the keys go to one place. On the `pages` fixture, whose `paragraph` block
 * has a render.
 */

const richTextOf = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

async function createPage(request: APIRequestContext, title: string) {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title, sections: [{ type: 'paragraph', text: richTextOf('Alpha') }] }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
}

async function loginAs(page: Page) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(ADMIN_EMAIL, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

async function readSections(page: Page, docId: string) {
  const response = await page.request.get(`${API_BASE_URL}/pages/${docId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).doc.sections as any[];
}

const dialog = (page: Page) => page.locator('[role="dialog"][data-state="open"]');
const lines = (page: Page) => dialog(page).locator('.rz-command-palette__item');
const input = (page: Page) => dialog(page).locator('input');
/** The lines under one heading. */
const group = (page: Page, heading: string) =>
  dialog(page)
    .locator('.rz-command-group', {
      has: page.locator('.rz-command-group__heading', { hasText: heading })
    })
    .locator('.rz-command-palette__item');

test('⌘K lists the document, ⌘⇧K the navigation, and goes there', async ({ page, request }) => {
  const docId = await createPage(request, 'Commands');
  await loginAs(page);
  await page.goto(panelUrl('pages', docId));
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(group(page, 'Document').filter({ hasText: /^Save/ })).toHaveCount(1);
  await expect(group(page, 'Go to')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  await page.keyboard.press('Control+Shift+k');
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toHaveAttribute('placeholder', /collection/);
  await group(page, 'Go to')
    .filter({ hasText: /^Pages$/ })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await page.waitForURL(panelUrl('pages'));
});

test('⌘⇧K searches the documents by their title', async ({ page, request }) => {
  const docId = await createPage(request, 'Palette page');
  await loginAs(page);

  await page.keyboard.press('Control+Shift+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.type('pa');
  await expect(group(page, 'Go to').filter({ hasText: /^Pages$/ })).toHaveCount(1);
  const found = group(page, 'Pages').filter({ hasText: 'Palette page' });
  await expect(found).toHaveCount(1);
  await found.click();
  await page.waitForURL(panelUrl('pages', docId));
});

test('The collection list offers a document, the search and the display', async ({
  page,
  request
}) => {
  await createPage(request, 'Listed');
  await loginAs(page);
  await page.goto(panelUrl('pages'));
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await group(page, 'Pages').filter({ hasText: /grid/ }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.rz-page-collection__grid')).toBeVisible();

  await page.keyboard.press('Control+k');
  await group(page, 'Pages')
    .filter({ hasText: /^Search in/ })
    .click();
  await expect(page.locator('.rz-header-search-input input')).toBeFocused();

  await page.keyboard.press('Control+k');
  await group(page, 'Pages')
    .filter({ hasText: /^Create/ })
    .click();
  await page.waitForURL(`${panelUrl('pages')}/create`);
});

test('In focus mode, ⌘K in the editor lists the text first, and Escape closes one thing at a time', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Focus commands');
  await loginAs(page);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
  await page.waitForLoadState('networkidle');
  const focus = page.locator('.rz-blocks-focus');
  await expect(focus).toBeVisible();

  const row = page.locator('.rz-layers__row').first();
  await row.click();
  await expect(row).toHaveClass(/rz-layers__row--selected/);
  const editor = focus.locator('.rz-blocks-focus__inspector .ProseMirror');
  await editor.click();

  // The editor's items come first, the blocks' after them.
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.rz-command-group__heading').first()).toHaveText('Text');
  await expect(group(page, 'Add').filter({ hasText: /^Paragraph$/ })).toHaveCount(1);

  // The arrows move in the list, not in the layers.
  await page.keyboard.press('ArrowDown');
  await expect(lines(page).nth(1)).toHaveAttribute('data-selected', '');
  await expect(row).toHaveClass(/rz-layers__row--selected/);

  // Escape closes the palette and nothing else.
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(focus).toBeVisible();

  // ⌘S from the editor saves.
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' saved');
  await page.keyboard.press('Control+s');
  await expect
    .poll(async () => (await readSections(page, docId))[0].text.content[0].content[0].text)
    .toBe('Alpha saved');

  // Escape on a row closes focus mode.
  await row.click();
  await page.keyboard.press('Escape');
  await expect(focus).toHaveCount(0);
});
