import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Moves in the tree of `pages`, a nested collection. A move the server refuses: the panel says so
 * and shows the stored order again. A move it takes stays after a search is cleared. A row
 * released where it was taken: nothing is sent.
 */

/** The titles of the tree's rows, top to bottom. */
const titles = (page: Page) => page.locator('.rz-collection-node__title').allTextContents();

test('A refused move shows an error and keeps the stored order', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  for (const title of ['Move A', 'Move B']) {
    const created = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title, slug: title.toLowerCase().replace(' ', '-') } }
    });
    expect(created.status()).toBe(200);
  }

  await page.addInitScript(() =>
    localStorage.setItem('collection.pages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));
  await expect.poll(() => titles(page)).toEqual(expect.arrayContaining(['Move A', 'Move B']));
  const before = await titles(page);
  // The lower of the two goes above the other
  const [upper, lower] = before.filter((title) => title.startsWith('Move '));

  // Every PATCH of a page is refused
  await page.route(
    (url) => url.pathname.startsWith('/api/pages/'),
    (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 403, body: '{}' })
        : route.continue()
  );

  /** The tree row whose title is exactly `title`. */
  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  await row(lower)
    .locator('.rz-collection-node__grip')
    .dragTo(row(upper), { targetPosition: { x: 20, y: 2 } });

  await expect(page.getByText('An error occurred')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(before);
});

test('A moved row keeps its place once a search is cleared', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const create = async (title: string, under?: { parent: string; position: number }) => {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: { title, slug: title.toLowerCase().replace(' ', '-') },
        ...(under && { _parent: under.parent, _position: under.position })
      }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc.id as string;
  };
  const parent = await create('Order parent');
  await create('Order first', { parent, position: 0 });
  await create('Order second', { parent, position: 1 });

  await page.addInitScript(() =>
    localStorage.setItem('collection.pages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));

  /** The titles under the parent, top to bottom. */
  const children = () =>
    page
      .locator(`.rz-collection-sortable[data-id="${parent}"] .rz-collection-node__title`)
      .allTextContents();
  await expect.poll(children).toEqual(['Order first', 'Order second']);

  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  await row('Order second')
    .locator('.rz-collection-node__grip')
    .dragTo(row('Order first'), { targetPosition: { x: 20, y: 2 } });
  await expect(page.getByText('Order updated')).toBeVisible();
  await expect.poll(children).toEqual(['Order second', 'Order first']);

  // A cleared search starts again from the list's documents: the moved order, as stored
  const search = page.locator('.rz-header-search-input input');
  await search.fill('Order');
  await search.fill('');
  await expect.poll(children).toEqual(['Order second', 'Order first']);

  const stored = await request.get(
    `${API_BASE_URL}/pages?where[_parent][equals]=${parent}&sort=_position&latest=true`,
    { headers }
  );
  expect(
    (await stored.json()).docs.map((doc: { attributes: { title: string } }) => doc.attributes.title)
  ).toEqual(['Order second', 'Order first']);
});

test('A row released where it was taken sends nothing', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { attributes: { title: 'Stay put', slug: 'stay-put' } }
  });
  expect(created.status()).toBe(200);

  await page.addInitScript(() =>
    localStorage.setItem('collection.pages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));
  await expect.poll(() => titles(page)).toEqual(expect.arrayContaining(['Stay put']));
  const before = await titles(page);

  const patches: string[] = [];
  page.on('request', (sent) => {
    if (sent.method() === 'PATCH') patches.push(sent.url());
  });

  const row = page.locator('.rz-collection-node__row', {
    has: page.getByText('Stay put', { exact: true })
  });
  await row.locator('.rz-collection-node__grip').dragTo(row);

  // A save would answer well within this time.
  await page.waitForTimeout(1000);
  expect(patches).toEqual([]);
  await expect(page.getByText('Order updated')).toHaveCount(0);
  expect(await titles(page)).toEqual(before);
});

test('A folded page whose children are gone shows its list open, and forgets the fold', async ({
  page,
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const parent = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { attributes: { title: 'Fold parent', slug: 'fold-parent' } }
  });
  expect(parent.status()).toBe(200);
  const parentId = (await parent.json()).doc.id as string;
  const child = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { attributes: { title: 'Fold child', slug: 'fold-child' }, _parent: parentId }
  });
  expect(child.status()).toBe(200);
  const childId = (await child.json()).doc.id as string;
  // A root page, dropped under the parent once its child is gone
  const newcomer = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { attributes: { title: 'Fold newcomer', slug: 'fold-newcomer' } }
  });
  expect(newcomer.status()).toBe(200);
  const newcomerId = (await newcomer.json()).doc.id as string;

  await page.addInitScript(() =>
    localStorage.setItem('collection.pages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));

  // The parent's list of children, which is also where a row drops under it
  const list = page.locator(`.rz-collection-sortable[data-id="${parentId}"]`);
  /** The tree row whose title is exactly `title`. */
  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  await row('Fold parent').locator('.rz-collection-node__fold').click();
  await expect(list).toHaveAttribute('hidden');

  const removed = await request.delete(`${API_BASE_URL}/pages/${childId}`, { headers });
  expect(removed.status()).toBe(200);
  await page.reload();

  await expect(page.getByText('Fold parent', { exact: true })).toBeVisible();
  await expect(list).not.toHaveAttribute('hidden');

  // The fold is forgotten: a row dropped under the parent shows. The parent's empty list has no
  // height, and a drop just under the parent's row lands in it (CollectionTree.svelte's
  // emptyInsertThreshold).
  const grip = (await row('Fold newcomer').locator('.rz-collection-node__grip').boundingBox())!;
  const target = (await row('Fold parent').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + target.height + 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText('Order updated')).toBeVisible();

  await expect
    .poll(async () => {
      const response = await request.get(`${API_BASE_URL}/pages/${newcomerId}?latest=true`, {
        headers
      });
      return (await response.json()).doc._parent;
    })
    .toBe(parentId);
  await expect(page.getByText('Fold newcomer', { exact: true })).toBeVisible();
  await expect(list).not.toHaveAttribute('hidden');
});
