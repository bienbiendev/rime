import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// Wide enough for focus mode's three columns; a narrow screen has its own test.
test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The command palette: ⌘K lists what the page offers first, what the panel offers below, and the
 * documents the query finds. On the `pages` fixture, whose `paragraph` block has a render.
 */

const richTextOf = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

/**
 * A page with its slug set: an empty slug fills itself from the title when the document opens,
 * which leaves the form with a change and holds any navigation on the unsaved-changes dialog.
 */
async function createPage(request: APIRequestContext, title: string) {
  const slug = `${title.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title, slug, sections: [{ type: 'paragraph', text: richTextOf('Alpha') }] }
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
/**
 * One line, by its heading and its label. The label is read on its own span: a line's whole text
 * carries the spaces around its icon and its keys, which an anchored pattern would trip on.
 */
const line = (page: Page, heading: string, label: RegExp) =>
  group(page, heading).filter({
    has: page.locator('.rz-command-palette__label', { hasText: label })
  });

test('⌘K puts the page on top, the panel below, and goes there', async ({ page, request }) => {
  const docId = await createPage(request, 'Commands');
  await loginAs(page);
  await page.goto(panelUrl('pages', docId));
  await page.waitForLoadState('networkidle');

  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toHaveAttribute('placeholder', /command/);
  // The document's own commands come before the panel's.
  const headings = dialog(page).locator('.rz-command-group__heading');
  await expect(headings.first()).toHaveText('Document');
  await expect(line(page, 'Document', /^Save$/)).toHaveCount(1);
  await expect(headings.last()).not.toHaveText('Document');

  await line(page, 'Go to', /^Pages$/).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.waitForURL(panelUrl('pages'));
});

test('⌘K searches the documents by their title', async ({ page, request }) => {
  const docId = await createPage(request, 'Palette page');
  await loginAs(page);

  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.type('pa');
  await expect(line(page, 'Go to', /^Pages$/)).toHaveCount(1);
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
  await line(page, 'Pages', /grid/).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.rz-page-collection__grid')).toBeVisible();

  await page.keyboard.press('Control+k');
  await line(page, 'Pages', /^Search in/).click();
  await expect(page.locator('.rz-header-search-input input')).toBeFocused();

  await page.keyboard.press('Control+k');
  await line(page, 'Pages', /^Create/).click();
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

  // Nothing selected: the types to add come first, before the document's own.
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.rz-command-group__heading').first()).toHaveText('Add');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  const row = page.locator('.rz-layers__row').first();
  await row.click();
  await expect(row).toHaveClass(/rz-layers__row--selected/);
  // The row's pencil turns the panel to the block's fields.
  await row.getByRole('button', { name: 'Edit' }).click();
  const editor = focus.locator('.rz-blocks-focus__panel .ProseMirror');
  await editor.click();

  // The editor's items come first, the blocks' after them.
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.rz-command-group__heading').first()).toHaveText('Text');
  await expect(line(page, 'Add', /^Paragraph$/)).toHaveCount(1);

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

  // Escape on a row steps back: the selection, then focus mode.
  await focus.getByRole('tab', { name: 'Layers' }).click();
  await row.click();
  await page.keyboard.press('Escape');
  await expect(focus).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(focus).toHaveCount(0);
});
