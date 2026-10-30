import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const EDITOR_EMAIL = 'ro-editor@email.com';

/**
 * A `bulletins` document opened by an editor, who may read it but not update it: no control
 * changes the value, the media library does not open, the live editor does not open, and focus
 * mode offers no types to add.
 */

// The tests open the bulletin and sign in the editor the first test creates: one failing skips the
// rest
test.describe.configure({ mode: 'serial' });

let documentUrl: string;

test('Should create a bulletin and an editor', async ({ request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  const media = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: `bulletin-${Date.now()}.jpg` }, alt: 'Bulletin' }
  });
  expect(media.status()).toBe(200);
  const created = await request.post(`${API_BASE_URL}/bulletins`, {
    headers,
    data: {
      title: 'Weekly',
      topics: ['news', 'events'],
      sections: [
        { type: 'image', image: (await media.json()).doc.id },
        { type: 'note', text: 'Read me' }
      ]
    }
  });
  expect(created.status()).toBe(200);
  documentUrl = panelUrl('bulletins', (await created.json()).doc.id);

  const editor = await request.post(`${API_BASE_URL}/staff`, {
    headers,
    data: { email: EDITOR_EMAIL, name: 'RO Editor', roles: ['editor'], password: PASSWORD }
  });
  expect(editor.status()).toBe(200);
});

test('Should keep a select value in a read-only document', async ({ page }) => {
  await loginAs(page, EDITOR_EMAIL, PASSWORD);
  await page.goto(documentUrl);

  const tags = page.locator('.rz-select__option .rz-tag');
  await expect(tags).toHaveCount(2);
  const remove = tags.first().locator('.rz-tag__button');
  await expect(remove).toBeDisabled();
  await remove.click({ force: true });
  await expect(tags).toHaveCount(2);
});

test('Should not open the media library from an image in a read-only document', async ({
  page
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAs(page, EDITOR_EMAIL, PASSWORD);
  await page.goto(`${documentUrl}?focus=sections`);

  const block = page.locator('.rz-renders__item[data-type="image"]');
  const image = block.locator('.site-image');
  await expect(image).toBeVisible();
  // The first click selects the block; a second one on an editable field would open the library
  await image.click();
  await expect(block).toHaveAttribute('data-selected', '');
  await image.click();
  await expect(page.locator('[role="dialog"][data-state="open"]')).toHaveCount(0);
});

test('Should not open the live editor from a read-only document', async ({ page }) => {
  await loginAs(page, EDITOR_EMAIL, PASSWORD);
  await page.goto(documentUrl);

  const live = page.locator('.rz-button-live');
  await expect(live).toHaveAttribute('aria-disabled', 'true');
  await expect(live).not.toHaveAttribute('href');

  // An admin, who may update it, gets the link
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl);
  await expect(page.locator('.rz-button-live')).toHaveAttribute('href', /.+/);
});

test('Should turn the focus panel to Layers when the selection empties', async ({ page }) => {
  await loginAs(page, EDITOR_EMAIL, PASSWORD);
  await page.goto(`${documentUrl}?focus=sections`);

  const panel = page.locator('.rz-blocks-focus__panel');
  const note = page.locator(
    '.rz-blocks-focus__renders > .rz-renders > .rz-renders__item[data-type="note"]'
  );
  await note.first().click();
  await expect(panel.getByRole('tab', { name: 'Inspector' })).toHaveAttribute(
    'data-state',
    'active'
  );

  // No Add tab in a locked form: the panel shows the layers
  await page.keyboard.press('Escape');
  await expect(note.first()).not.toHaveAttribute('data-selected');
  await expect(panel.getByRole('tab', { name: 'Layers' })).toHaveAttribute('data-state', 'active');
  await expect(page.locator('.rz-layers__row')).toHaveCount(2);
});
