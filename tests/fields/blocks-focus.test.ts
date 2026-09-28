import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// Wide enough for focus mode's three columns; a narrow screen has its own test.
test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The blocks focus mode, on the `pages` fixture: `sections` takes paragraph, image, keyFacts,
 * grid and gallery, a grid holds `items` of paragraph and image, and `extras` is a summary field.
 *
 * Every test makes its own page, so one failing leaves the others their document.
 */

const richTextOf = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

/** A page with a paragraph, a grid holding a paragraph, and a paragraph. */
async function createPage(request: APIRequestContext) {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Focus mode',
      sections: [
        { type: 'paragraph', text: richTextOf('Alpha') },
        { type: 'grid', title: 'Grid', items: [{ type: 'paragraph', text: richTextOf('Inner') }] },
        { type: 'paragraph', text: richTextOf('Beta') }
      ]
    }
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

const rows = (page: Page) => page.locator('.rz-layers__row');
const selectedRow = (page: Page) => page.locator('.rz-layers__row--selected');
const dialog = (page: Page) => page.locator('[role="dialog"][data-state="open"]');

async function readSections(page: Page, docId: string) {
  const response = await page.request.get(`${API_BASE_URL}/pages/${docId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).doc.sections as any[];
}

/** The focus overlay covers the document header, so its own save button is the one to click. */
async function save(page: Page) {
  const focus = page.locator('.rz-blocks-focus');
  const scope = (await focus.count()) ? focus : page;
  await scope.locator('button[type="submit"]').first().click();
}

/** Adds a type through ⌘K: with a render in the list, there is no palette column. */
async function addViaCommand(page: Page, type: RegExp) {
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  // The heading and the label are read on their own elements: a line's whole text carries the
  // spaces around its icon, which an anchored pattern would trip on.
  await dialog(page)
    .locator('.rz-command-group', {
      has: page.locator('.rz-command-group__heading', { hasText: 'Add' })
    })
    .locator('.rz-command-palette__item', {
      has: page.locator('.rz-command-palette__label', { hasText: type })
    })
    .click();
  await expect(dialog(page)).toHaveCount(0);
}

test('Focus opens from the field, carries the address, and closes with the changes kept', async ({
  page,
  request
}) => {
  const docId = await createPage(request);
  await loginAs(page);
  await page.goto(panelUrl('pages', docId));
  await page.waitForLoadState('networkidle');

  await page.locator('[data-focus-open="sections"]').click();
  await expect(page.locator('.rz-blocks-focus')).toBeVisible();
  await expect(page).toHaveURL(/[?&]focus=sections/);
  // Three blocks at the root, one inside the grid, all unfolded.
  await expect(rows(page)).toHaveCount(4);

  // ⌘K inserts after the selection.
  await rows(page).first().click();
  await expect(rows(page).first()).toHaveClass(/rz-layers__row--selected/);
  await addViaCommand(page, /^Image$/);
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(1)).toHaveClass(/rz-layers__row--selected/);
  await expect(selectedRow(page)).toHaveText(/Image/);
  // The image's render draws its empty relation, a place to choose one.
  await expect(
    page.locator('.rz-renders__item[data-type="image"] .rz-relation-inline__empty')
  ).toBeVisible();

  // Escape steps back: the selection first, then focus; the inserted block is in the form, unsaved.
  await selectedRow(page).press('Escape');
  await expect(page.locator('.rz-layers__root')).toHaveClass(/rz-layers__root--selected/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.rz-blocks-focus')).toHaveCount(0);
  await expect(page).not.toHaveURL(/focus=/);
  await expect(
    page.locator('fieldset[data-path="sections"] > .rz-blocks__list > .rz-block')
  ).toHaveCount(4);

  await save(page);
  await expect
    .poll(async () => (await readSections(page, docId)).map((block) => block.type))
    .toEqual(['paragraph', 'image', 'grid', 'paragraph']);
});

test('The keys select, add, duplicate, move and remove', async ({ page, request }) => {
  const docId = await createPage(request);
  await loginAs(page);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-blocks-focus')).toBeVisible();
  await expect(rows(page)).toHaveCount(4);

  // Rows on screen: paragraph, grid, the grid's paragraph, paragraph.
  await rows(page).first().click();
  await expect(rows(page).first()).toHaveClass(/rz-layers__row--selected/);
  await selectedRow(page).press('ArrowDown');
  await expect(rows(page).nth(1)).toHaveClass(/rz-layers__row--selected/);
  await expect(selectedRow(page)).toHaveText(/Grid/);

  // ⌘K opens the palette; its first line adds the first type, a paragraph, after the grid.
  await selectedRow(page).press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(3)).toHaveClass(/rz-layers__row--selected/);

  await selectedRow(page).press('Control+d');
  await expect(rows(page)).toHaveCount(6);
  await expect(rows(page).nth(4)).toHaveClass(/rz-layers__row--selected/);

  await selectedRow(page).press('Backspace');
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(4)).toHaveClass(/rz-layers__row--selected/);

  // Alt+ArrowUp moves the selection one position up in its list, above the inserted paragraph.
  await selectedRow(page).press('Alt+ArrowUp');
  await expect(rows(page).nth(3)).toHaveClass(/rz-layers__row--selected/);

  await save(page);
  await expect
    .poll(async () => (await readSections(page, docId)).map((block) => block.type))
    .toEqual(['paragraph', 'grid', 'paragraph', 'paragraph']);
});

test('⌘K moves a block into a nested list, and never into one that refuses its type', async ({
  page,
  request
}) => {
  const docId = await createPage(request);
  await loginAs(page);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
  await page.waitForLoadState('networkidle');
  await expect(rows(page)).toHaveCount(4);

  // The grid itself cannot go into `items`: no move target is offered for it.
  const gridRow = page.locator('.rz-layers__item[data-type="grid"] > .rz-layers__row');
  await gridRow.click();
  await expect(gridRow).toHaveClass(/rz-layers__row--selected/);
  await gridRow.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).locator('.rz-command-item', { hasText: /Move into/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  // The last paragraph goes into the grid's items.
  const lastRow = rows(page).last();
  await lastRow.click();
  await expect(lastRow).toHaveClass(/rz-layers__row--selected/);
  await lastRow.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await dialog(page)
    .locator('.rz-command-item', { hasText: /Move into Grid/ })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.rz-layers__item[data-type="grid"] .rz-layers__row')).toHaveCount(3);

  await save(page);
  await expect
    .poll(async () => {
      const sections = await readSections(page, docId);
      const grid = sections.find((block) => block.type === 'grid');
      return {
        root: sections.map((block) => block.type),
        items: grid.items.map((b: any) => b.type)
      };
    })
    .toEqual({ root: ['paragraph', 'grid'], items: ['paragraph', 'paragraph'] });
});

test('A summary field is one row that opens focus', async ({ page, request }) => {
  const docId = await createPage(request);
  await loginAs(page);
  await page.goto(panelUrl('pages', docId));
  await page.waitForLoadState('networkidle');

  // The list field keeps its cards; the summary field has one row, the count and Edit.
  await expect(page.locator('fieldset[data-path="sections"] > .rz-blocks__list')).toBeVisible();
  const extras = page.locator('fieldset[data-path="extras"]');
  await expect(extras.locator('.rz-blocks__list')).toHaveCount(0);
  await expect(extras.locator('.rz-blocks__count')).toHaveText(/0 blocks/);

  await extras.locator('[data-focus-open="extras"]').click();
  await expect(page.locator('.rz-blocks-focus')).toBeVisible();
  await expect(page).toHaveURL(/[?&]focus=extras/);
  await addViaCommand(page, /^Paragraph$/);
  await expect(rows(page)).toHaveCount(1);
  await page.locator('.rz-blocks-focus .rz-blocks-focus__crumb').first().click();
  await expect(page.locator('.rz-blocks-focus')).toHaveCount(0);
  await expect(extras.locator('.rz-blocks__count')).toHaveText(/1 block/);
});

test('The renders draw the blocks, a click selects one, the panel follows', async ({
  page,
  request
}) => {
  const docId = await createPage(request);
  await loginAs(page);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
  await page.waitForLoadState('networkidle');

  // `paragraph` has a render: the stack of renders beside one panel, open on its Layers tab.
  const focus = page.locator('.rz-blocks-focus');
  await expect(focus).toHaveAttribute('data-layout', 'renders');
  const panel = focus.locator('.rz-blocks-focus__panel');
  const tab = (name: string) => panel.getByRole('tab', { name });
  await expect(tab('Layers')).toHaveAttribute('data-state', 'active');
  await expect(rows(page)).toHaveCount(4);

  // The paragraph's render mounts its rich-text field, in the render's own size, 1.3rem.
  const items = focus.locator('.rz-blocks-focus__renders > .rz-renders > .rz-renders__item');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0).locator('.site-paragraph .ProseMirror')).toHaveText('Alpha');
  await expect(items.nth(0).locator('.site-paragraph')).toHaveCSS('font-size', '20.8px');

  // The grid's render draws its items where it says, each in a wrapper of its own.
  const grid = items.nth(1);
  await expect(grid.locator('.site-grid__title')).toHaveText('Grid');
  const inner = grid.locator('.site-grid__items .rz-renders__item');
  await expect(inner.locator('.ProseMirror')).toHaveText('Inner');

  // A click selects the block and turns the panel to its fields.
  await items.nth(2).click();
  await expect(items.nth(2)).toHaveAttribute('data-selected', '');
  await expect(tab('Inspector')).toHaveAttribute('data-state', 'active');
  await expect(panel.locator('.ProseMirror')).toHaveText('Beta');

  // A click inside the grid selects the nested paragraph, not the grid; the layers agree.
  await inner.click();
  await expect(inner).toHaveAttribute('data-selected', '');
  await expect(grid).not.toHaveAttribute('data-selected', '');
  await tab('Layers').click();
  await expect(rows(page).nth(2)).toHaveClass(/rz-layers__row--selected/);

  // The render's own field edits the form.
  const editor = inner.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' plus');

  // A click beside the blocks selects the root again: nothing to inspect, the types to add.
  await focus.locator('.rz-blocks-focus__renders').click({ position: { x: 4, y: 4 } });
  await expect(inner).not.toHaveAttribute('data-selected', '');
  await expect(page.locator('.rz-layers__root')).toHaveClass(/rz-layers__root--selected/);
  await expect(tab('Blocks')).toHaveAttribute('data-state', 'active');
  await expect(panel.locator('.rz-palette__item')).toHaveCount(5);

  await save(page);
  await expect
    .poll(async () => {
      const sections = await readSections(page, docId);
      const grid = sections.find((block) => block.type === 'grid');
      return grid.items[0].text.content[0].content[0].text;
    })
    .toBe('Inner plus');
});

test('An empty list opens the panel on the types to add', async ({ page, request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Empty focus', sections: [] }
  });
  expect(response.status()).toBe(200);
  const docId = (await response.json()).doc.id as string;
  await loginAs(page);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
  await page.waitForLoadState('networkidle');

  const panel = page.locator('.rz-blocks-focus__panel');
  await expect(panel.getByRole('tab', { name: 'Blocks' })).toHaveAttribute('data-state', 'active');
  await expect(panel.locator('.rz-palette__item')).toHaveCount(5);
});

test('The selected render has a bar above with its arrows, the panel three tabs', async ({
  page,
  request
}) => {
  const docId = await createPage(request);
  await loginAs(page);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
  await page.waitForLoadState('networkidle');

  const focus = page.locator('.rz-blocks-focus');
  const items = focus.locator('.rz-blocks-focus__renders > .rz-renders > .rz-renders__item');
  const panel = focus.locator('.rz-blocks-focus__panel');
  const tab = (name: string) => panel.getByRole('tab', { name });

  // The panel opens on its Layers tab.
  await expect(tab('Layers')).toHaveAttribute('data-state', 'active');

  // A click on the first paragraph turns it to the Inspector, and shows the bar and the arrows.
  await items.nth(0).click();
  await expect(tab('Inspector')).toHaveAttribute('data-state', 'active');
  const bar = items.nth(0).locator('.rz-renders__toolbar');
  await expect(bar).toBeVisible();
  await expect(items.nth(0).getByRole('button', { name: 'Move up' })).toBeDisabled();

  // The other tabs stay a click away; a click on the block, or the layer row's pencil, brings the
  // fields back.
  await tab('Blocks').click();
  await expect(tab('Blocks')).toHaveAttribute('data-state', 'active');
  await items.nth(0).click();
  await expect(tab('Inspector')).toHaveAttribute('data-state', 'active');
  await tab('Layers').click();
  await expect(selectedRow(page)).toHaveText(/Paragraph/);
  await selectedRow(page).getByRole('button', { name: 'Edit' }).click();
  await expect(tab('Inspector')).toHaveAttribute('data-state', 'active');

  // Down one place: the grid comes first, the paragraph stays selected.
  await items.nth(0).getByRole('button', { name: 'Move down' }).click();
  await expect(items.nth(0)).toHaveAttribute('data-type', 'grid');
  await expect(items.nth(1)).toHaveAttribute('data-selected', '');

  // Duplicate from the bar.
  await items
    .nth(1)
    .locator('.rz-renders__toolbar')
    .getByRole('button', { name: 'Duplicate' })
    .click();
  await expect(items).toHaveCount(4);

  await save(page);
  await expect
    .poll(async () => (await readSections(page, docId)).map((block) => block.type))
    .toEqual(['grid', 'paragraph', 'paragraph', 'paragraph']);
});

test.describe('On a narrow screen', () => {
  test.use({ viewport: { width: 700, height: 900 } });

  test('the stage stays, the panel is a sheet', async ({ page, request }) => {
    const docId = await createPage(request);
    await loginAs(page);
    await page.goto(`${panelUrl('pages', docId)}?focus=sections`);
    await page.waitForLoadState('networkidle');

    const focus = page.locator('.rz-blocks-focus');
    const renders = focus.locator('.rz-blocks-focus__renders');
    const sheet = page.locator('.rz-blocks-focus__panel-sheet');
    await expect(renders).toBeVisible();
    await expect(sheet).toHaveCount(0);

    // The header button opens the panel; picking a layer puts it away, to see the block.
    await focus.locator('.rz-blocks-focus__panel-toggle').click();
    await expect(sheet).toBeVisible();
    await sheet.locator('.rz-layers__row').first().click();
    await expect(sheet).toHaveCount(0);

    // A click on a render opens the panel on its fields.
    await renders.locator('.rz-renders__item').first().click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('tab', { name: 'Inspector' })).toHaveAttribute(
      'data-state',
      'active'
    );

    // Escape closes the sheet and nothing else.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(focus).toBeVisible();
  });
});
