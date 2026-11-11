import test, { expect, type Page, type Route } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Moves in the tree of `pages`, a nested collection. A move is one request, for the moved row. A
 * move the server refuses: the panel says so, shows the stored order again, and the next drag
 * works. A move it takes stays after a search is cleared, and stores the order on screen when
 * positions tie. A row released where it was taken: nothing is sent.
 */

/*
 * A new page goes to the end of its list. The pages these drags move are sent with
 * `_position: 0` instead: the newest among the pages at 0, they sit at the top of the tree, on
 * screen and followed by other rows, whatever pages the suite made before.
 *
 * A drag moves in steps, as a hand does, over the rows between its start and its drop: in these
 * runs a single jump from the grip to the drop moved nothing.
 */

/** The titles of the tree's rows, top to bottom. */
const titles = (page: Page) => page.locator('.rz-collection-node__title').allTextContents();

/** A move request: `POST /api/pages/<id>/move`. */
const isMove = (url: URL) =>
  url.pathname.startsWith('/api/pages/') && url.pathname.endsWith('/move');

test('A refused move shows an error and keeps the stored order', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const ids: Record<string, string> = {};
  for (const title of ['Move A', 'Move B']) {
    const created = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title, slug: title.toLowerCase().replace(' ', '-') }, _position: 0 }
    });
    expect(created.status()).toBe(200);
    ids[title] = (await created.json()).doc.id;
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

  // Every move of a page is refused
  const refuse = (route: Route) => route.fulfill({ status: 403, body: '{}' });
  await page.route(isMove, refuse);

  /** The tree row whose title is exactly `title`. */
  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  const drag = () =>
    row(lower)
      .locator('.rz-collection-node__grip')
      .dragTo(row(upper), { targetPosition: { x: 20, y: 2 }, steps: 10 });
  await drag();

  await expect(page.getByText('An error occurred')).toBeVisible();
  await expect.poll(() => titles(page)).toEqual(before);

  // The next drag works, and its order is stored
  await page.unroute(isMove, refuse);
  await drag();
  await expect(page.getByText('Order updated')).toBeVisible();
  const moved = () => titles(page).then((all) => all.filter((title) => title.startsWith('Move ')));
  await expect.poll(moved).toEqual([lower, upper]);

  const stored = await request.get(
    `${API_BASE_URL}/pages?where[id][in_array]=${ids[upper]},${ids[lower]}&sort=_position&latest=true`,
    { headers }
  );
  expect(
    (await stored.json()).docs.map((doc: { attributes: { title: string } }) => doc.attributes.title)
  ).toEqual([lower, upper]);
});

test('A drop among pages that share a position stores the order on screen', async ({
  page,
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const create = async (title: string, parent?: string) => {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: { title, slug: title.toLowerCase().replace(' ', '-') },
        _position: 0,
        ...(parent && { _parent: parent })
      }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc as { id: string; updatedAt: string };
  };
  const parent = (await create('Tie parent')).id;
  const created: { id: string; updatedAt: string }[] = [];
  for (const title of ['Tie A', 'Tie B', 'Tie C']) {
    created.push(await create(title, parent));
  }

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
  await expect.poll(() => children().then((shown) => shown.length)).toBe(3);
  // The three hold position 0: the screen shows them in some order, and the last goes above the
  // second. The first does not move, yet takes its place on screen.
  const [first, second, last] = await children();

  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  await row(last)
    .locator('.rz-collection-node__grip')
    .dragTo(row(second), { targetPosition: { x: 20, y: 2 }, steps: 10 });
  await expect(page.getByText('Order updated')).toBeVisible();

  const expected = [first, last, second];
  await expect.poll(children).toEqual(expected);
  const response = await request.get(
    `${API_BASE_URL}/pages?where[_parent][equals]=${parent}&sort=_position&latest=true`,
    { headers }
  );
  const { docs } = await response.json();
  type Stored = { id: string; updatedAt: string; attributes: { title: string } };
  expect(docs.map((doc: Stored) => doc.attributes.title)).toEqual(expected);

  // The two that only changed place keep their `updatedAt`
  for (const doc of docs as Stored[]) {
    if (doc.attributes.title === last) continue;
    expect(doc.updatedAt).toBe(created.find((one) => one.id === doc.id)!.updatedAt);
  }
});

test('A moved row keeps its place once a search is cleared', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const create = async (title: string, under?: { parent: string; position: number }) => {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: { title, slug: title.toLowerCase().replace(' ', '-') },
        _position: under?.position ?? 0,
        ...(under && { _parent: under.parent })
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
    .dragTo(row('Order first'), { targetPosition: { x: 20, y: 2 }, steps: 10 });
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

test('A move under another parent sends one request, for the moved row', async ({
  page,
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const create = async (title: string, parent?: string) => {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: { title, slug: title.toLowerCase().replace(' ', '-') },
        _position: 0,
        ...(parent && { _parent: parent })
      }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc.id as string;
  };
  const home = await create('Patch home');
  const about = await create('Patch about', home);
  const team = await create('Patch team');

  await page.addInitScript(() =>
    localStorage.setItem('collection.pages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages'));
  await expect(page.getByText('Patch about', { exact: true })).toBeVisible();

  // Every write the page sends: a move, a PATCH
  const writes: string[] = [];
  page.on('request', (sent) => {
    const url = new URL(sent.url());
    if (sent.method() === 'PATCH' || isMove(url)) writes.push(`${sent.method()} ${url.pathname}`);
  });

  // A drop just under a childless row lands in its empty list (tree/sortable.ts's
  // emptyInsertThreshold)
  const row = (title: string) =>
    page.locator('.rz-collection-node__row', { has: page.getByText(title, { exact: true }) });
  const grip = (await row('Patch about').locator('.rz-collection-node__grip').boundingBox())!;
  const target = (await row('Patch team').boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + target.height + 2, { steps: 12 });
  // A hand held still keeps the browser sending the drag over the rows; a test sends one event
  // per move. Once Sortable's 150 ms animation has put the rows in place, one more move lets the
  // drop see them there.
  await page.waitForTimeout(200);
  await page.mouse.move(target.x + 41, target.y + target.height + 2);
  await page.mouse.up();
  await expect(page.getByText('Order updated')).toBeVisible();

  // The moved row alone: neither `home` nor `team` is saved
  expect(writes).toEqual([`POST /api/pages/${about}/move`]);

  await page.reload();
  await expect(
    page.locator(`.rz-collection-sortable[data-id="${team}"] .rz-collection-node__title`)
  ).toHaveText(['Patch about']);
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

  const writes: string[] = [];
  page.on('request', (sent) => {
    if (sent.method() === 'PATCH' || isMove(new URL(sent.url()))) writes.push(sent.url());
  });

  const row = page.locator('.rz-collection-node__row', {
    has: page.getByText('Stay put', { exact: true })
  });
  await row.locator('.rz-collection-node__grip').dragTo(row);

  // A save would answer well within this time.
  await page.waitForTimeout(1000);
  expect(writes).toEqual([]);
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
  // height, and a drop just under the parent's row lands in it (tree/sortable.ts's
  // emptyInsertThreshold). New pages sit at the end of the tree: the rows come on screen first.
  await row('Fold newcomer').scrollIntoViewIfNeeded();
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
