import { PARAMS } from '#lib/core/constants.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const HISTORY = '.rz-document-versions';
const LIST_ITEM = '.rz-document-versions__list-item';
const ACTIVE_LINK = '.rz-document-versions__list-item--active a';
const TITLE = 'input[name="attributes.title"]';
const SAVE = 'button[data-submit]';

/**
 * The version history, opened from the document's settings menu.
 *
 * Picking a version loads that row into the form on the same page; saving writes that row and no
 * other. The rows are created over the API so each test starts from a known history, and read
 * back over it so what the browser did is checked against what is stored.
 */

// The tests share the news the first one creates: one failing skips the rest
test.describe.configure({ mode: 'serial' });

/** The history stays open across picks; a reload closes it. */
async function openHistory(page: Page) {
  if (await page.locator(HISTORY).count()) return;
  await page.getByRole('button', { name: 'Document actions' }).click();
  await page.getByRole('menuitem', { name: 'Versions history' }).click();
  await expect(page.locator(HISTORY)).toBeVisible();
}

/** The form's own POST to `?/update`, as opposed to the loads that follow it. */
const waitForSave = (page: Page) =>
  page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );

let newsId: string;
let publishedVersionId: string;
let draftVersionId: string;

const documentUrl = (versionId: string) =>
  `${panelUrl('news', newsId)}?${PARAMS.VERSION_ID}=${versionId}`;

const read = async (request: import('@playwright/test').APIRequestContext, query = '') => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}${query}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

test('Should create a news with a published version and a draft', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Versioned news', slug: 'versioned-news' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();
  newsId = doc.id;
  publishedVersionId = doc.versionId;

  const branched = await request.patch(`${API_BASE_URL}/news/${newsId}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Versioned news, draft' } }
  });
  expect(branched.status()).toBe(200);

  const draft = await read(request, `?${PARAMS.LATEST}=true`);
  draftVersionId = draft.versionId;
  expect(draftVersionId).not.toBe(publishedVersionId);
});

test('Should list both versions and mark the one on screen', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  // The document is on screen, its history closed
  await expect(page.locator(TITLE)).toBeVisible();
  await expect(page.locator(HISTORY)).toHaveCount(0);
  await openHistory(page);

  await expect(page.locator(LIST_ITEM)).toHaveCount(2);
  await expect(page.locator(ACTIVE_LINK)).toHaveCount(1);
  await expect(page.locator(ACTIVE_LINK)).toHaveAttribute('href', new RegExp(draftVersionId));
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, draft');
});

test('Should save a draft in place, leaving the published version alone', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));

  await page.locator(TITLE).fill('Versioned news, draft edited');
  const saved = waitForSave(page);
  await page.locator(SAVE).click();
  expect((await saved).status()).toBe(200);

  // Same row, same history: nothing was added.
  await page.reload();
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, draft edited');
  await openHistory(page);
  await expect(page.locator(LIST_ITEM)).toHaveCount(2);

  const draft = await read(request, `?${PARAMS.VERSION_ID}=${draftVersionId}`);
  expect(draft.attributes.title).toBe('Versioned news, draft edited');
  expect(draft.status).toBe(VERSIONS_STATUS.DRAFT);

  const published = await read(request);
  expect(published.attributes.title).toBe('Versioned news');
  expect(published.status).toBe(VERSIONS_STATUS.PUBLISHED);
});

test('Should load the version picked in the history, and keep it open', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  await openHistory(page);

  await page.locator(`${LIST_ITEM} a[href*="${publishedVersionId}"]`).click();
  await page.waitForURL(new RegExp(`versionId=${publishedVersionId}`));

  await expect(page.locator(TITLE)).toHaveValue('Versioned news');
  await expect(page.locator(HISTORY)).toBeVisible();
  await expect(page.locator(ACTIVE_LINK)).toHaveAttribute('href', new RegExp(publishedVersionId));
});

test('Should save the published version as published, leaving the draft alone', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(publishedVersionId));

  await page.locator(TITLE).fill('Versioned news, edited');
  const saved = waitForSave(page);
  await page.locator(SAVE).click();
  expect((await saved).status()).toBe(200);

  const published = await read(request);
  expect(published.versionId).toBe(publishedVersionId);
  expect(published.attributes.title).toBe('Versioned news, edited');
  expect(published.status).toBe(VERSIONS_STATUS.PUBLISHED);

  const draft = await read(request, `?${PARAMS.VERSION_ID}=${draftVersionId}`);
  expect(draft.attributes.title).toBe('Versioned news, draft edited');
  expect(draft.status).toBe(VERSIONS_STATUS.DRAFT);
});

test('Should branch a new draft from the published version and land on it', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(publishedVersionId));

  await page.locator(TITLE).fill('Versioned news, third');
  await page.getByRole('button', { name: 'Document actions' }).click();
  await page.getByRole('menuitem', { name: 'Save in a new draft' }).click();

  // The action answers with a redirect to the new row on this same page.
  await page.waitForURL((url) => {
    const versionId = url.searchParams.get(PARAMS.VERSION_ID);
    return !!versionId && versionId !== publishedVersionId && versionId !== draftVersionId;
  });

  await openHistory(page);
  await expect(page.locator(LIST_ITEM)).toHaveCount(3);
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, third');

  const newVersionId = new URL(page.url()).searchParams.get(PARAMS.VERSION_ID)!;
  const branched = await read(request, `?${PARAMS.VERSION_ID}=${newVersionId}`);
  expect(branched.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(branched.attributes.title).toBe('Versioned news, third');

  const published = await read(request);
  expect(published.versionId).toBe(publishedVersionId);
  expect(published.attributes.title).toBe('Versioned news, edited');
});

test('Should close the history and stay on the version', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(documentUrl(draftVersionId));
  await openHistory(page);

  await page.locator(HISTORY).getByRole('button', { name: 'Close' }).click();

  await expect(page.locator(HISTORY)).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get(PARAMS.VERSION_ID)).toBe(draftVersionId);
  await expect(page.locator(TITLE)).toHaveValue('Versioned news, draft edited');
});

/**
 * `infos` keeps versions without drafts: each save from the document page is a new version.
 * Its oldest versions are pruned past `maxVersions`, so the new ones are checked, not a count.
 */
test('Should add a version per save on a config without drafts', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('infos'));

  let versionId = new URL(page.url()).searchParams.get(PARAMS.VERSION_ID);
  const saves: (string | null)[] = [];
  for (const title of ['Infos, first save', 'Infos, second save']) {
    await page.locator('input[name="title"]').fill(title);
    const saved = waitForSave(page);
    await page.locator(SAVE).click();
    expect((await saved).status()).toBe(200);

    // The save lands on the version it made
    await page.waitForURL((url) => {
      const landed = url.searchParams.get(PARAMS.VERSION_ID);
      return !!landed && landed !== versionId;
    });
    versionId = new URL(page.url()).searchParams.get(PARAMS.VERSION_ID);
    saves.push(versionId);
  }

  // Each save is its own version, holding what was typed
  const response = await request.get(`${API_BASE_URL}/infos--versions`, {
    headers: await signInSuperAdmin(request)
  });
  const titles = new Map(
    ((await response.json()).docs as { id: string; title: string }[]).map((v) => [v.id, v.title])
  );
  expect(saves.map((id) => titles.get(id!))).toEqual(['Infos, first save', 'Infos, second save']);
});

/**
 * "Save in a new draft" borrows the Save button: whatever the request gives, the button is left
 * as it was, and a Save that follows works and saves in place.
 */
test('Should leave the Save button as it was after a new draft that got no answer', async ({
  page,
  request
}) => {
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: { title: 'Page in drafts', slug: 'page-in-drafts' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { id } = (await created.json()).doc;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));
  await page.getByRole('button', { name: 'Attributes' }).click();
  await page.locator(TITLE).fill('Page in drafts, edited');

  // The connection drops under the new draft
  await page.route(
    (url) => url.search.startsWith('?/update'),
    (route) => route.abort(),
    {
      times: 1
    }
  );
  await page.getByRole('button', { name: 'Document actions' }).click();
  await page.getByRole('menuitem', { name: 'Save in a new draft' }).click();

  await expect(page.locator(SAVE)).toBeEnabled();
  await expect(page.locator(SAVE)).not.toHaveAttribute('data-fork');
  await expect(page.locator(SAVE)).toHaveAttribute('data-status', VERSIONS_STATUS.PUBLISHED);

  const saved = waitForSave(page);
  await page.locator(SAVE).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.url()).not.toContain(`${PARAMS.FORK}=true`);
  expect((await response.json()).type).toBe('success');

  // Saved in place: the published version holds the title, and it is the only version
  const headers = await signInSuperAdmin(request);
  const read = await request.get(`${API_BASE_URL}/pages/${id}`, { headers });
  expect(read.status()).toBe(200);
  const { doc } = await read.json();
  expect(doc.attributes.title).toBe('Page in drafts, edited');
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  const versions = await request.get(
    `${API_BASE_URL}/pages--versions?where[ownerId][equals]=${id}`,
    { headers }
  );
  expect((await versions.json()).docs).toHaveLength(1);
});

/**
 * camelCase slugs. `blogPosts` lives at `/panel/blog-posts`: what a write refreshes, and what a
 * tree row links to, is found by that kebab.
 */
test('Should show a status change in the history of a camelCase collection', async ({
  page,
  request
}) => {
  const created = await request.post(`${API_BASE_URL}/blog-posts`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Blog post' }
  });
  expect(created.status()).toBe(200);
  const { id } = (await created.json()).doc;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('blog-posts', id));

  // The history is read once, as a draft
  const dot = page.locator('.rz-document-versions__list-item--active .rz-status__dot');
  await openHistory(page);
  await expect(dot).toHaveAttribute('style', /--rz-warn/);
  await page.keyboard.press('Escape');
  await expect(page.locator(HISTORY)).toHaveCount(0);

  await page.locator('.rz-status__button').click();
  await page.locator('[id="document.published"]').click();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.locator('.rz-status__text')).toHaveText('Published');

  await openHistory(page);
  await expect(dot).toHaveAttribute('style', /--rz-success/);
});

test('Should open a document of a camelCase nested collection from its tree', async ({
  page,
  request
}) => {
  const created = await request.post(`${API_BASE_URL}/blog-pages`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Blog page' }
  });
  expect(created.status()).toBe(200);
  const { id } = (await created.json()).doc;

  await page.addInitScript(() =>
    localStorage.setItem('collection.blogPages.display', 'display_nested')
  );
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('blog-pages'));
  await page.locator('.rz-collection-node__title', { hasText: 'Blog page' }).click();

  await page.waitForURL(panelUrl('blog-pages', id));
  await expect(page.locator('input[name="title"]')).toHaveValue('Blog page');
});
