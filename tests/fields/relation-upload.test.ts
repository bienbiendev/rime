import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// Wide enough for focus mode's panel beside the stage.
test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The upload picker, in the plain form and in a block render: the `pages` fixture has `photos`, a
 * many relation to `medias`, an `image` block with one and a `gallery` block with many, both drawn
 * by renders that pick in place.
 */

const richTextOf = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

let medias: string[] = [];
// In every file name, so a search in the picker lists these three and no upload of another file
const run = `pick-${Date.now()}`;

// Runs again in a fresh worker after a failure, so every test finds its medias
test.beforeAll(async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  medias = [];
  for (const filename of [`${run}-a.jpg`, `${run}-b.jpg`, `${run}-c.jpg`]) {
    const response = await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: { file: { base64, filename }, alt: filename }
    });
    expect(response.status()).toBe(200);
    medias.push((await response.json()).doc.id);
  }
});

/** A page with a slug, so it opens with nothing to save, and one paragraph. */
async function createPage(request: APIRequestContext, title: string) {
  const slug = `${title.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}`;
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title, slug, sections: [{ type: 'paragraph', text: richTextOf('Alpha') }] }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
}

async function readPage(page: Page, docId: string) {
  const response = await page.request.get(`${API_BASE_URL}/pages/${docId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
}

const dialog = (page: Page) => page.locator('[role="dialog"][data-state="open"]');
const marked = (page: Page) => dialog(page).locator('.rz-relation-browse__item[data-selected]');
const card = (page: Page, id: string) =>
  dialog(page).locator(`.rz-relation-browse__item[data-id="${id}"]`);

/** Adds a type through ⌘K. */
async function add(page: Page, label: string) {
  // Focus mode offers its Add lines once it is on screen
  await expect(page.locator('.rz-blocks-focus')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(dialog(page)).toBeVisible();
  await dialog(page)
    .locator('.rz-command-group', {
      has: page.locator('.rz-command-group__heading', { hasText: 'Add' })
    })
    .locator('.rz-command-palette__item', {
      has: page.locator('.rz-command-palette__label', { hasText: new RegExp(`^${label}$`) })
    })
    .click();
  await expect(dialog(page)).toHaveCount(0);
}

async function save(page: Page) {
  await page.locator('.rz-blocks-focus button[type="submit"]').first().click();
}

test('Many: a click picks or unpicks, the picks are marked, Add closes and the pick is saved', async ({
  page,
  request
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const docId = await createPage(request, 'Photos many');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  const photos = page.locator('fieldset[data-path="photos"]');
  await photos.getByRole('button', { name: 'Choose from the library' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: /Create new/ })).toBeVisible();

  await card(page, medias[0]).click();
  await card(page, medias[1]).click();
  await expect(marked(page)).toHaveCount(2);
  await expect(card(page, medias[1]).locator('.rz-relation-browse__mark')).toHaveText('2');
  await expect(dialog(page)).toBeVisible();

  // A second click on a pick takes it out, and throws nothing.
  await card(page, medias[0]).click();
  await expect(marked(page)).toHaveCount(1);
  await expect(card(page, medias[1]).locator('.rz-relation-browse__mark')).toHaveText('1');

  await dialog(page)
    .getByRole('button', { name: /^Add \d/ })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(photos.locator('.rz-relation-upload__list .rz-relation-upload__thumb')).toHaveCount(
    1
  );
  expect(errors).toEqual([]);

  // The pick that stayed, saved
  await page.locator('button[data-submit]').click();
  await expect
    .poll(async () => (await readPage(page, docId)).photos.map((ref: any) => ref.documentId))
    .toEqual([medias[1]]);
});

test('Many: a press dragged across the images picks them all, and unpicks them back', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Photos sweep');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  await page
    .locator('fieldset[data-path="photos"]')
    .getByRole('button', { name: 'Choose from the library' })
    .click();
  await expect(dialog(page)).toBeVisible();
  // Only the three: an upload from another file cannot sit between them on the sweep's path
  await dialog(page).locator('.rz-relation-browse__search input').fill(run);
  await expect(dialog(page).locator('.rz-relation-browse__item')).toHaveCount(3);

  const centreOf = async (id: string) => {
    const box = (await card(page, id).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const sweep = async () => {
    const [a, b, c] = await Promise.all(medias.map(centreOf));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.move(c.x, c.y, { steps: 8 });
    await page.mouse.up();
  };

  // The three swept, and nothing else
  await sweep();
  for (const id of medias) await expect(card(page, id)).toHaveAttribute('data-selected', '');
  await expect(marked(page)).toHaveCount(3);

  // Starting on a pick, the same sweep takes them all out.
  await sweep();
  for (const id of medias) await expect(card(page, id)).not.toHaveAttribute('data-selected');
  await expect(marked(page)).toHaveCount(0);
});

test('One: in the inspector, a click picks and closes, another replaces it', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Image field');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);

  await add(page, 'Image');
  const panel = page.locator('.rz-blocks-focus__panel');
  await panel.getByRole('tab', { name: 'Inspector' }).click();
  const select = panel.getByRole('button', { name: 'Choose from the library' });

  await select.click();
  await card(page, medias[0]).click();
  await expect(dialog(page)).toHaveCount(0);

  await select.click();
  await expect(marked(page)).toHaveCount(1);
  await card(page, medias[1]).click();
  await expect(dialog(page)).toHaveCount(0);
  // One pick: a card in the zone's place, no drop zone beside it.
  await expect(panel.locator('.rz-relation-upload__card')).toHaveCount(1);
  await expect(panel.locator('.rz-relation-upload__drop')).toHaveCount(0);

  await save(page);
  await expect
    .poll(async () => (await readPage(page, docId)).sections[1]?.image?.[0]?.documentId)
    .toBe(medias[1]);
});

test('Inline, one: the render offers a choice, draws the pick', async ({ page, request }) => {
  const docId = await createPage(request, 'Image inline');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);

  await add(page, 'Image');
  const block = page.locator('.rz-renders__item[data-type="image"]');
  await block
    .locator('.rz-relation-inline__empty')
    .getByRole('button', { name: 'choose from the library' })
    .click();
  await expect(dialog(page)).toBeVisible();
  await card(page, medias[2]).click();
  await expect(dialog(page)).toHaveCount(0);

  await expect(block.locator('.site-image')).toHaveAttribute('src', /md-1024\.webp$/);

  await save(page);
  await expect
    .poll(async () => (await readPage(page, docId)).sections[1]?.image?.[0]?.documentId)
    .toBe(medias[2]);
});

test('Inline, many: the render picks several, the inspector lists the same', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Gallery inline');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);

  await add(page, 'Gallery');
  const block = page.locator('.rz-renders__item[data-type="gallery"]');
  await block
    .locator('.rz-relation-inline__empty')
    .getByRole('button', { name: 'choose from the library' })
    .click();
  await expect(dialog(page)).toBeVisible();
  await card(page, medias[0]).click();
  await card(page, medias[1]).click();
  await dialog(page)
    .getByRole('button', { name: /^Add \d/ })
    .click();
  await expect(dialog(page)).toHaveCount(0);

  await expect(block.locator('.site-gallery img')).toHaveCount(2);
  const panel = page.locator('.rz-blocks-focus__panel');
  await panel.getByRole('tab', { name: 'Inspector' }).click();
  await expect(panel.locator('.rz-relation-upload__list .rz-relation-upload__thumb')).toHaveCount(
    2
  );

  await save(page);
  await expect
    .poll(async () =>
      ((await readPage(page, docId)).sections[1]?.images ?? []).map((ref: any) => ref.documentId)
    )
    .toEqual([medias[0], medias[1]]);
});

test('Many, not an upload: a document created from the field is picked and saved, with no error', async ({
  page,
  request
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  const docId = await createPage(request, 'Tags create');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  const tags = page.locator('fieldset[data-path="tags"]');
  await tags.getByRole('button', { name: /Create new/ }).click();
  await expect(dialog(page)).toBeVisible();
  const title = `Created tag ${Date.now()}`;
  await dialog(page).locator('input[name="title"]').fill(title);
  await dialog(page).locator('button[type="submit"]').first().click();

  await expect(tags.locator('.rz-relation__item', { hasText: title })).toHaveCount(1);
  await expect(dialog(page)).toHaveCount(0);
  expect(errors).toEqual([]);

  // The document created there is the one the page holds once saved
  const response = await request.get(
    `${API_BASE_URL}/targets?where[title][equals]=${encodeURIComponent(title)}`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(response.status()).toBe(200);
  const { docs: created } = await response.json();
  expect(created).toHaveLength(1);
  // The document's own Save: the closed sheet keeps a disabled Save of its own
  await page.getByRole('main').locator('button[data-submit]').click();
  await expect
    .poll(async () => (await readPage(page, docId)).tags.map((ref: any) => ref.documentId))
    .toEqual([created[0].id]);
});

test('Inline: an image whose fetch fails gives the empty state, not a loading box for good', async ({
  page,
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Image unreadable',
      slug: `image-unreadable-${Date.now()}`,
      sections: [{ type: 'image', image: medias[0] }]
    }
  });
  expect(response.status()).toBe(200);
  const docId = (await response.json()).doc.id;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  // The panel names its locale on the read: match the document, whatever the query string
  await page.route(
    (url) => url.pathname.endsWith(`/api/medias/${medias[0]}`),
    (route) => route.abort()
  );
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);

  const block = page.locator('.rz-renders__item[data-type="image"]');
  await expect(
    block
      .locator('.rz-relation-inline__empty')
      .getByRole('button', { name: 'choose from the library' })
  ).toBeVisible();
  await expect(block.locator('.rz-relation-inline__loading')).toHaveCount(0);
});
