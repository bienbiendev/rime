import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

test.use({ viewport: { width: 1600, height: 900 } });

// The search, sort and palette tests read the listings the first test creates: one failing skips
// the rest
test.describe.configure({ mode: 'serial' });

/**
 * The `listings` fixture: its list page searches titles, sorts by paths and deletes checked rows,
 * its select searches labels, its link clears on a type switch, and the command palette names its
 * documents by their nested title. The status filter runs on `reports`, which has drafts.
 */

const createListing = async (request: APIRequestContext, heading: string, score: number) => {
  const response = await request.post(`${API_BASE_URL}/listings`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { heading }, meta: { score } }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
};

const rowTitles = (page: Page) =>
  page.locator('.rz-list-row .rz-list-row__title').allTextContents();

/** After a sort click: waits until the rows read as one of `orders`, and answers that order. */
async function sortedAs(page: Page, orders: string[][]) {
  let titles: string[] = [];
  await expect
    .poll(async () => {
      titles = await rowTitles(page);
      return orders.some((order) => order.join('\n') === titles.join('\n'));
    })
    .toBe(true);
  return titles;
}

const THREE = ['Alpha listing', 'Bravo listing', 'Charlie listing'];

test('Should create three listings', async ({ request }) => {
  // Created in an order no sort gives, with scores that order them unlike their titles
  await createListing(request, 'Alpha listing', 2);
  await createListing(request, 'Charlie listing', 3);
  await createListing(request, 'Bravo listing', 1);
});

test('The search box keeps the rows whose title it names', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings'));

  const search = page.locator('.rz-header-search-input input');
  await search.fill('Bravo');
  await expect.poll(() => rowTitles(page)).toEqual(['Bravo listing']);
  await search.fill('');
  await expect.poll(async () => (await rowTitles(page)).sort()).toEqual(THREE);
});

test('A column placed at 0 comes first, and sorts by its path', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings'));

  const columns = page.locator('.rz-list-header__column[data-column="field"]');
  await expect(columns.first()).toContainText('Score');

  // Score 1, 2, 3: an order neither title order gives
  const byScore = ['Bravo listing', 'Alpha listing', 'Charlie listing'];
  const score = page.getByRole('button', { name: /Sort by Score/i });
  await score.click();
  const once = await sortedAs(page, [byScore, [...byScore].reverse()]);
  await score.click();
  await sortedAs(page, [[...once].reverse()]);
});

test('The Title column sorts by a title inside a group', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings'));

  const title = page.getByRole('button', { name: /Sort by Title/i });
  await title.click();
  const once = await sortedAs(page, [THREE, [...THREE].reverse()]);
  await title.click();
  await sortedAs(page, [[...once].reverse()]);
});

test('The command palette names a document by its title inside a group', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl());
  // The shortcut listens once the panel is mounted
  await expect(page.locator('main')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.locator('[role="dialog"][data-state="open"]')).toBeVisible();
  await page.keyboard.type('Bravo');
  await expect(
    page.locator('[role="dialog"][data-state="open"] .rz-command-palette__item', {
      hasText: 'Bravo listing'
    })
  ).toHaveCount(1);
});

test('The create form renders its components and separator, clears a switched link, and searches its select', async ({
  page
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings', 'create'));

  // A component renders, unless its access or its condition hides it. Three in the fixture: the
  // one nothing hides is the one rendered
  await expect.soft(page.locator('.rz-fixture-notice')).toHaveCount(1);

  // A separator takes its class
  await expect.soft(page.locator('hr.rz-fixture-wide')).toHaveCount(1);

  // Switching the link type clears its text
  const input = page.locator('input[name="website"]');
  await input.fill('https://a.co');
  await page.locator('fieldset[data-path="website"] .rz-link__type').click();
  await page.getByRole('menuitemradio', { name: /email/i }).click();
  await expect.soft(input).toHaveValue('');
  await expect.soft(page.locator('fieldset[data-path="website"] .rz-field-error')).toHaveCount(0);

  // The select search finds an option by its label
  const search = page.locator('fieldset[data-path="country"] input');
  await search.click();
  await search.pressSequentially('Fran', { delay: 30 });
  await expect.soft(page.getByRole('option', { name: 'France' })).toBeVisible();
  await expect.soft(page.getByRole('option', { name: 'Germany' })).toHaveCount(0);
});

/** Inserts the `fields()` node a palette entry names, in the rich text of the open document. */
async function insertFieldsNode(page: Page, label: string) {
  await page.locator('fieldset[data-path="body"] .ProseMirror').click();
  await page.keyboard.type('/');
  const palette = page.locator('[role="dialog"][data-state="open"]');
  await palette
    .locator('.rz-command-palette__item', {
      has: page.locator('.rz-command-palette__label', { hasText: new RegExp(`^${label}$`) })
    })
    .click();
}

test('A rich text inserts the fields node its palette entry names', async ({ page, request }) => {
  const id = await createListing(request, 'Rich listing', 0);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings', id));

  await insertFieldsNode(page, 'Hero');
  // The new node opens its fields in a sheet: close it
  const sheet = page.locator('.rz-rich-text-sheet');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );
  await page.locator('button[data-submit]').click();
  expect((await saved).status()).toBe(200);

  const read = await request.get(`${API_BASE_URL}/listings/${id}`, {
    headers: await signInSuperAdmin(request)
  });
  const types = ((await read.json()).doc.body.content as { type: string }[]).map((n) => n.type);
  expect(types).toContain('rich-text-fields-hero');
  expect(types).not.toContain('rich-text-fields-quote');
});

test('A fields node stores what its sheet holds', async ({ page, request }) => {
  const id = await createListing(request, 'Hero values', 0);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings', id));

  await insertFieldsNode(page, 'Hero');
  const sheet = page.locator('.rz-rich-text-sheet');
  await sheet.locator('input[name="heroTitle"]').fill('Welcome');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await page.locator('button[data-submit]').click();

  await expect
    .poll(async () => {
      const read = await request.get(`${API_BASE_URL}/listings/${id}`, {
        headers: await signInSuperAdmin(request)
      });
      const content = ((await read.json()).doc.body?.content ?? []) as any[];
      return content.find((node) => node.type === 'rich-text-fields-hero')?.attrs.json;
    })
    .toEqual({ heroTitle: 'Welcome' });
});

test('A stored tab that exists opens', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rime.Tabs:create:', 'second'));
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings', 'create'));
  await expect(page.locator('input[name="second.secondText"]')).toBeVisible();
  await expect(page.locator('input[name="first.firstText"]')).toBeHidden();
});

test('A stored tab that no longer exists opens the first tab', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rime.Tabs:create:', 'gone'));
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings', 'create'));
  await expect(page.locator('input[name="first.firstText"]')).toBeVisible();
});

test('The status filter keeps the rows of the status it names', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  for (const [title, status] of [
    ['Filtered draft', VERSIONS_STATUS.DRAFT],
    ['Filtered published', VERSIONS_STATUS.PUBLISHED]
  ]) {
    const created = await request.post(`${API_BASE_URL}/reports`, {
      headers,
      data: { title, status }
    });
    expect(created.status()).toBe(200);
  }

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('reports'));
  await expect
    .poll(() => rowTitles(page))
    .toEqual(expect.arrayContaining(['Filtered draft', 'Filtered published']));

  await page.getByRole('button', { name: 'Status', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Draft' }).click();
  await expect.poll(() => rowTitles(page)).not.toContain('Filtered published');
  expect(await rowTitles(page)).toContain('Filtered draft');

  // The button names the status picked; "All" lifts the filter
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'All' }).click();
  await expect
    .poll(() => rowTitles(page))
    .toEqual(expect.arrayContaining(['Filtered draft', 'Filtered published']));
});

test('Two checked rows are deleted together, and the other rows stay', async ({
  page,
  request
}) => {
  const doomed = [
    await createListing(request, 'Doomed one', 0),
    await createListing(request, 'Doomed two', 0)
  ];
  const headers = await signInSuperAdmin(request);
  /** The ids the collection holds. */
  const stored = async () => {
    const response = await request.get(`${API_BASE_URL}/listings?limit=500`, { headers });
    expect(response.status()).toBe(200);
    return (await response.json()).docs.map((doc: { id: string }) => doc.id) as string[];
  };
  const kept = (await stored()).filter((id) => !doomed.includes(id));

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('listings'));

  await page.getByRole('checkbox', { name: 'Doomed one', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Doomed two', exact: true }).click();
  await page
    .locator('.rz-header-select')
    .getByRole('button', { name: /^Delete/ })
    .click();

  await expect.poll(stored).toEqual(kept);
  await expect.poll(() => rowTitles(page)).not.toContain('Doomed one');
  expect(await rowTitles(page)).not.toContain('Doomed two');
});
