import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// Wide enough for focus mode's panel beside the stage.
test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The upload picker, in the plain form and in a block render: the `pages` fixture has `photos`, a
 * many relation to the images of `medias`, an `image` block with one and a `gallery` block with
 * many, both drawn by renders that pick in place.
 */

const richTextOf = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
});

let medias: string[] = [];
// In every file name, so a search in the picker lists these three and no upload of another file
const run = `pick-${Date.now()}`;
// A PDF of `medias`, which the query of `photos` leaves out
let pdf: { id: string; filename: string };

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
  const response = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: {
      file: {
        base64: `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')}`,
        filename: `doc-${Date.now()}.pdf`
      },
      alt: 'A PDF'
    }
  });
  expect(response.status()).toBe(200);
  pdf = (await response.json()).doc;
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

/** Adds a block type through ⌘K: the line of the Add group whose label is exactly `label`. */
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

/** Clicks the focus mode's own save button. */
async function save(page: Page) {
  await page.locator('.rz-blocks-focus button[type="submit"]').first().click();
}

/** The read of a field's saved picks: `?where[id][in_array]=…`. */
const isPicksRead = (url: URL) => decodeURIComponent(url.search).includes('[id][in_array]');

/** A target titled `title`; answers its id. */
async function createTarget(request: APIRequestContext, title: string) {
  const response = await request.post(`${API_BASE_URL}/targets`, {
    headers: await signInSuperAdmin(request),
    data: { title }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
}

test('The library reads its folder once it opens, not before', async ({ page, request }) => {
  const docId = await createPage(request, 'Photos closed');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);

  // The library's own reads: the open folder's files, and its folders
  const reads: string[] = [];
  page.on('request', (sent) => {
    const url = new URL(sent.url());
    const folderFiles = decodeURIComponent(url.search).includes('[_path]');
    if (folderFiles || url.pathname.endsWith('/medias-directories')) reads.push(sent.url());
  });

  await page.goto(panelUrl('pages', docId));
  const choose = page
    .locator('fieldset[data-path="photos"]')
    .getByRole('button', { name: 'Choose from the library' });
  await expect(choose).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(reads).toEqual([]);

  await choose.click();
  await expect(card(page, medias[0])).toBeVisible();
  expect(reads.length).toBeGreaterThan(0);
});

test('A page reads its picks by id and counts the rest, never a whole collection', async ({
  page,
  request
}) => {
  const run = Date.now();
  const tags = [
    await createTarget(request, `Read ${run} a`),
    await createTarget(request, `Read ${run} b`)
  ];
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Picks by id',
      slug: `picks-by-id-${run}`,
      tags,
      photos: [medias[0], medias[1]]
    }
  });
  expect(created.status()).toBe(200);
  const docId = (await created.json()).doc.id as string;
  await loginAs(page, ADMIN_EMAIL, PASSWORD);

  // Every list read of targets or medias: a whole collection holds neither an id nor a count
  const wholeReads: string[] = [];
  page.on('request', (sent) => {
    const url = new URL(sent.url());
    if (!/\/api\/(targets|medias)$/.test(url.pathname)) return;
    if (!isPicksRead(url)) wholeReads.push(sent.url());
  });

  await page.goto(panelUrl('pages', docId));
  const chips = page.locator('fieldset[data-path="tags"] .rz-relation__item');
  await expect(chips).toHaveText([`Read ${run} a`, `Read ${run} b`]);
  await expect(
    page.locator('fieldset[data-path="photos"] .rz-relation-upload__thumb img')
  ).toHaveCount(2);
  await page.waitForLoadState('networkidle');
  expect(wholeReads).toEqual([]);
});

test('The search of a relation reads 20 matches and their count once typing pauses', async ({
  page,
  request
}) => {
  const title = `Searched ${Date.now()}`;
  await createTarget(request, title);
  const docId = await createPage(request, 'Tags search');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  // The reads that name a title
  const searches: URL[] = [];
  page.on('request', (sent) => {
    const url = new URL(sent.url());
    if (
      url.pathname.includes('/api/targets') &&
      decodeURIComponent(url.search).includes('[like]')
    ) {
      searches.push(url);
    }
  });

  const tags = page.locator('fieldset[data-path="tags"]');
  await tags.getByRole('button', { name: 'Choose', exact: true }).click();
  await tags.locator('input').pressSequentially(title, { delay: 30 });
  await expect(tags.getByRole('option', { name: title })).toBeVisible();

  const lists = searches.filter((url) => url.pathname.endsWith('/api/targets'));
  const counts = searches.filter((url) => url.pathname.endsWith('/api/targets/count'));
  expect(lists).toHaveLength(1);
  expect(lists[0].searchParams.get('limit')).toBe('20');
  expect(counts).toHaveLength(1);
});

test('A relation of one offers Choose while empty, and neither Choose nor the search once full', async ({
  page,
  request
}) => {
  const title = `Thumbnail ${Date.now()}`;
  await createTarget(request, title);
  const docId = await createPage(request, 'Thumbnail full');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  const thumbnail = page.locator('fieldset[data-path="thumbnail"]');
  const choose = thumbnail.getByRole('button', { name: 'Choose', exact: true });
  await choose.click();
  await thumbnail.locator('input').pressSequentially(title, { delay: 30 });
  await thumbnail.getByRole('option', { name: title }).click();

  await expect(thumbnail.locator('.rz-relation__item')).toHaveText(title);
  await expect(choose).toHaveCount(0);
  await expect(thumbnail.locator('.rz-relation__search')).toHaveCount(0);
});

test('A new pick in the form shows at once, before the read of the picks answers', async ({
  page,
  request
}) => {
  const title = `At once ${Date.now()}`;
  await createTarget(request, title);
  const docId = await createPage(request, 'Picks at once');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  // The picks' reads never answer
  await page.route(isPicksRead, () => {});
  await page.goto(panelUrl('pages', docId));

  // A target picked from the search of tags
  const tags = page.locator('fieldset[data-path="tags"]');
  await tags.getByRole('button', { name: 'Choose', exact: true }).click();
  await tags.locator('input').pressSequentially(title, { delay: 30 });
  await tags.getByRole('option', { name: title }).click();
  await expect(tags.locator('.rz-relation__item')).toHaveText(title);

  // An image picked from the library of photos
  const photos = page.locator('fieldset[data-path="photos"]');
  await photos.getByRole('button', { name: 'Choose from the library' }).click();
  await card(page, medias[0]).click();
  await dialog(page)
    .getByRole('button', { name: /^Add \d/ })
    .click();
  await expect(photos.locator('.rz-relation-upload__thumb img')).toHaveCount(1);
});

test('An image picked in a render shows at once, before the read of the picks answers', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Render at once');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  // The picks' reads never answer
  await page.route(isPicksRead, () => {});
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);

  await add(page, 'Image');
  const block = page.locator('.rz-renders__item[data-type="image"]');
  await block
    .locator('.rz-relation-inline__empty')
    .getByRole('button', { name: 'choose from the library' })
    .click();
  await card(page, medias[1]).click();
  await expect(block.locator('.site-image')).toBeVisible();
  await expect(block.locator('.rz-relation-inline__loading')).toHaveCount(0);
});

test('A target renamed and saved shows its new title in the page that holds it', async ({
  page,
  request
}) => {
  const run = Date.now();
  const targetId = await createTarget(request, `Before ${run}`);
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Rename', slug: `rename-${run}`, tags: [targetId] }
  });
  expect(created.status()).toBe(200);
  const docId = (await created.json()).doc.id as string;
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  const chip = page.locator('fieldset[data-path="tags"] .rz-relation__item');
  await expect(chip).toHaveText(`Before ${run}`);
  await chip.locator('a').click();
  await page.locator('input[name="title"]').fill(`After ${run}`);
  await page.locator('button[data-submit]').click();
  await expect
    .poll(async () => {
      const read = await page.request.get(`${API_BASE_URL}/targets/${targetId}`);
      return (await read.json()).doc.title;
    })
    .toBe(`After ${run}`);

  await page.goBack();
  await expect(chip).toHaveText(`After ${run}`);
});

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

test("The picker lists the medias the field's query names, in the folder and in a search", async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Photos query');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  const photos = page.locator('fieldset[data-path="photos"]');
  await photos.getByRole('button', { name: 'Choose from the library' }).click();
  await expect(card(page, medias[0])).toBeVisible();
  await expect(card(page, pdf.id)).toHaveCount(0);

  // A search for the PDF's name finds nothing: the query still holds
  await dialog(page).locator('.rz-relation-browse__search input').fill(pdf.filename);
  await expect(dialog(page).locator('.rz-relation-browse__item')).toHaveCount(0);
  await expect(card(page, pdf.id)).toHaveCount(0);
});

test('The type filter lists a type the grid has shown only in a folder', async ({
  page,
  request
}) => {
  // One PNG of one pixel, in a folder of its own: the root holds JPEGs only
  const folder = `types${Date.now()}`;
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers: await signInSuperAdmin(request),
    data: {
      file: { base64: png, filename: `${run}-pixel.png` },
      alt: 'A pixel',
      _path: `root:${folder}`
    }
  });
  expect(uploaded.status()).toBe(200);

  const docId = await createPage(request, 'Photos types');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));
  await page
    .locator('fieldset[data-path="photos"]')
    .getByRole('button', { name: 'Choose from the library' })
    .click();
  await expect(card(page, medias[0])).toBeVisible();

  // One type at the root: nothing to filter
  const filter = dialog(page).getByRole('button', { name: 'All types' });
  await expect(filter).toBeDisabled();

  await dialog(page).locator('.rz-browse__folder', { hasText: folder }).click();
  await expect(dialog(page).locator('.rz-relation-browse__item')).toHaveCount(1);
  await expect(filter).toBeEnabled();
  await filter.click();
  await expect(page.getByRole('menuitem', { name: 'image/jpeg' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'image/png' })).toBeVisible();
});

test('Files uploaded from the picker are picked only when the field query names them', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Photos upload query');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', docId));

  const photos = page.locator('fieldset[data-path="photos"]');
  await photos.getByRole('button', { name: 'Choose from the library' }).click();
  const stamp = Date.now();
  await dialog(page)
    .locator('input[type="file"]')
    .setInputFiles([
      {
        name: `query-${stamp}.jpg`,
        mimeType: 'image/jpeg',
        buffer: readFileSync(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'))
      },
      {
        name: `query-${stamp}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%%EOF\n')
      }
    ]);

  // The image is picked, the PDF is not
  const add = dialog(page).getByRole('button', { name: /^Add/ });
  await expect(add).toHaveText('Add 1 file');
  await add.click();
  await page.locator('button[data-submit]').click();
  await expect.poll(async () => (await readPage(page, docId)).photos.length).toBe(1);
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

test('Inline, many: the picks the render makes show in an inspector already open', async ({
  page,
  request
}) => {
  const docId = await createPage(request, 'Gallery inspector open');
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('pages', docId)}?focus=sections`);

  await add(page, 'Gallery');
  const panel = page.locator('.rz-blocks-focus__panel');
  await panel.getByRole('tab', { name: 'Inspector' }).click();
  const thumbs = panel.locator('.rz-relation-upload__list .rz-relation-upload__thumb');
  await expect(thumbs).toHaveCount(0);

  const block = page.locator('.rz-renders__item[data-type="gallery"]');
  await block
    .locator('.rz-relation-inline__empty')
    .getByRole('button', { name: 'choose from the library' })
    .click();
  await card(page, medias[0]).click();
  await card(page, medias[1]).click();
  await dialog(page)
    .getByRole('button', { name: /^Add \d/ })
    .click();

  // The inspector reads the two picks by id
  await expect(thumbs).toHaveCount(2);
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
  // The read of the image's picks fails
  await page.route(
    (url) => url.pathname.endsWith('/api/medias') && isPicksRead(url),
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

test('A file picked in the "Create new" sheet lands in the sheet, not in the document behind', async ({
  page
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('posters', 'create')}?uploadPath=root`);

  const artwork = page.locator('fieldset[data-path="artwork"]');
  await artwork.getByRole('button', { name: 'Choose from the library' }).click();
  await dialog(page)
    .getByRole('button', { name: /Create new/ })
    .click();
  const sheet = page.locator('.rz-sheet-content');
  await expect(sheet.locator('.rz-doc-upload-dropzone')).toBeVisible();

  // A click on the sheet's drop zone opens the sheet's own input.
  const chooser = page.waitForEvent('filechooser');
  await sheet.locator('.rz-doc-upload-dropzone').click();
  await (await chooser).setFiles(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));

  await expect(sheet.locator('.rz-doc-upload-header__info p').first()).toHaveText('landscape.jpg');
  const parent = page.getByRole('main');
  await expect(parent.locator('.rz-doc-upload-dropzone')).toBeVisible();
  await expect(parent.locator('.rz-doc-upload-header__file')).toHaveCount(0);
});
