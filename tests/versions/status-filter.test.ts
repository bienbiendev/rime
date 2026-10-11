import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * The status filter of a list with drafts, on `blog-posts`: "Draft" keeps the draft rows only,
 * "All" brings the published ones back.
 */

const rowTitles = (page: Page) =>
  page.locator('.rz-list-row .rz-list-row__title').allTextContents();

/** The status each row shows, once: `['Draft']` when every row is a draft. */
const rowStatuses = async (page: Page) => [
  ...new Set(
    (await page.locator('.rz-list-row .rz-doc-status').allTextContents()).map((text) => text.trim())
  )
];

test('The status filter keeps the rows of the status it names', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  for (const [title, status] of [
    ['Filtered draft', VERSIONS_STATUS.DRAFT],
    ['Filtered published', VERSIONS_STATUS.PUBLISHED]
  ]) {
    const created = await request.post(`${API_BASE_URL}/blog-posts`, {
      headers,
      data: { title, status }
    });
    expect(created.status()).toBe(200);
  }

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('blog-posts'));
  await expect
    .poll(() => rowTitles(page))
    .toEqual(expect.arrayContaining(['Filtered draft', 'Filtered published']));

  await page.getByRole('button', { name: 'Status', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Draft' }).click();
  await expect.poll(() => rowTitles(page)).not.toContain('Filtered published');
  expect(await rowTitles(page)).toContain('Filtered draft');
  expect(await rowStatuses(page)).toEqual(['Draft']);

  // The button names the status picked; "All" lifts the filter
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'All' }).click();
  await expect
    .poll(() => rowTitles(page))
    .toEqual(expect.arrayContaining(['Filtered draft', 'Filtered published']));
  expect(await rowStatuses(page)).toEqual(expect.arrayContaining(['Draft', 'Published']));
});
