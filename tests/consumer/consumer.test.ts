import test, { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  API_BASE_URL,
  openStream,
  panelUrl,
  panelUrlRe,
  panelPath,
  signIn,
  streamReader
} from '../util.js';

// Reused from tests/basic rather than adding a new binary fixture just for this suite.
const FIXTURE_IMAGE = readFileSync(
  fileURLToPath(new URL('../basic/landscape.jpg', import.meta.url))
);

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

// dev/prod passes share the same sqlite db (built with `rime build -d`), so
// suffix anything that must be unique (staff email) per pass.
const SUFFIX = process.env.CONSUMER_TEST_SUFFIX || 'run';

let adminId: string | undefined;

test.beforeAll(async ({ request }) => {
  const initResponse = await request.post(`${process.env.PUBLIC_RIME_URL}/api/init`, {
    data: { email: ADMIN_EMAIL, name: 'Admin User', password: PASSWORD }
  });
  if (![200, 404].includes(initResponse.status())) {
    throw new Error(`Unexpected /api/init status: ${initResponse.status()}`);
  }
  if (initResponse.status() === 200) {
    adminId = (await initResponse.json()).user?.id;
  }
});

test('unauthenticated visit to /panel redirects to sign-in', async ({ page }) => {
  await page.goto(panelUrl());
  await page.waitForURL(panelUrl('sign-in'));
  expect(page.url()).toBe(panelUrl('sign-in'));
});

test('sign in, create a page, create a staff member, no errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  // Sign in
  await page.goto(panelUrl('sign-in'));
  await page.waitForLoadState();
  await page.locator('input[name="email"]').pressSequentially(ADMIN_EMAIL, { delay: 50 });
  await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 50 });
  const signInButton = page.locator('button[type="submit"]');
  await expect(signInButton).toBeEnabled();
  await signInButton.click();
  await page.waitForURL(panelUrl());

  if (adminId) {
    await page.goto(panelUrl('staff', adminId));
    await page.waitForLoadState('networkidle');
  }

  // Navigate via real in-app links, not page.goto: page.goto is a hard navigation and
  // can race with SvelteKit's own still-in-flight client-side router (e.g. right after
  // the redirect from a create action), producing a spurious "Failed to fetch". Going
  // through the sidebar nav's actual anchors also exercises the list pages themselves
  // for errors, not just the create/edit forms.
  const nav = page.locator('.rz-nav__nav');

  // Create a page
  await nav.locator(`a[href="${panelPath('pages')}"]`).click();
  await page.waitForLoadState('networkidle');
  // "^=" not "=": upload collections append ?uploadPath=... to their create link (see
  // ButtonCreate.svelte), so an exact match would miss medias' create button.
  await page.locator(`a[href^="${panelPath('pages', 'create')}"]`).click();
  await page.waitForLoadState('networkidle');
  const title = `Home ${SUFFIX}`;
  await page.locator('input.rz-input[name="title"]').pressSequentially(title, { delay: 50 });
  const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  // The breadcrumb's last item reflects asTitle reactively off the *live* form state (see
  // documentForm.svelte.ts's initTitle effect), so it already shows `title` the moment it was
  // typed - it's not proof the create+redirect actually completed. Wait for the URL to actually move off
  // /create before doing anything else, or the next step can race ahead of the redirect.
  await page.waitForURL(panelUrlRe('pages'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-aria__last')).toHaveText(title);

  // Create a staff member
  await nav.locator(`a[href="${panelPath('staff')}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href^="${panelPath('staff', 'create')}"]`).click();
  await page.waitForLoadState('networkidle');
  const staffEmail = `staff-${SUFFIX}@email.com`;
  await page.locator('input.rz-input[name="email"]').pressSequentially(staffEmail, { delay: 50 });
  await page.locator('input.rz-input[name="name"]').pressSequentially('Staff User', { delay: 50 });
  await page.locator('input.rz-input[name="password"]').pressSequentially(PASSWORD, { delay: 50 });
  await page
    .locator('input.rz-input[name="confirmPassword"]')
    .pressSequentially(PASSWORD, { delay: 50 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForURL(panelUrlRe('staff'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-aria__last')).toHaveText(staffEmail);

  // Create a media (exercises sharp processing + serve-static). An upload collection's page
  // offers the bulk upload, no link to the single form: that form is reached by its address,
  // once the list page has settled.
  await nav.locator(`a[href="${panelPath('medias')}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.goto(`${panelUrl('medias', 'create')}?uploadPath=root`);
  await page.waitForLoadState('networkidle');
  const mediaFilename = `landscape-${SUFFIX}.jpg`;
  await page
    .locator('input#file')
    .setInputFiles({ name: mediaFilename, mimeType: 'image/jpeg', buffer: FIXTURE_IMAGE });
  // Upload header swaps the dropzone for the file-info block once the picked file has
  // been processed (see UploadHeader.svelte) - waiting on its filename text confirms
  // that happened, rather than racing the save click against it.
  await expect(page.locator('.rz-doc-upload-header__info p').first()).toHaveText(mediaFilename);
  await page.locator('input.rz-input[name="alt"]').pressSequentially('A landscape', { delay: 50 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForURL(panelUrlRe('medias'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-aria__last')).toHaveText(mediaFilename);

  expect(pageErrors).toEqual([]);
});

// The junction rows pointing at a deleted page go by cascade, which only happens with foreign
// keys on: libsql opens a database with them, the Bun driver turns them on.
test('deleting a page removes the relations pointing at it', async ({ request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const create = async (title: string, related: string[] = []) => {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { title, related }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc.id as string;
  };
  const read = async (id: string) =>
    (await request.get(`${API_BASE_URL}/pages/${id}`, { headers }).then((r) => r.json())).doc;

  const target = await create(`Target ${SUFFIX}`);
  const source = await create(`Source ${SUFFIX}`, [target]);
  expect((await read(source)).related).toHaveLength(1);

  expect((await request.delete(`${API_BASE_URL}/pages/${target}`, { headers })).status()).toBe(200);
  expect((await read(source)).related).toEqual([]);
});

// A new slug rewrites the paths under the page by cascade: foreign keys again.
test('renaming a page carries its child url', async ({ request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const create = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API_BASE_URL}/pages`, { headers, data });
    expect(response.status()).toBe(200);
    return (await response.json()).doc;
  };
  const parent = await create({ title: `Parent ${SUFFIX}` });
  const child = await create({ title: `Child ${SUFFIX}`, _parent: parent.id });
  expect(child._urlPath).toBe(`${parent._slug}/${child._slug}`);

  const renamed = await request.patch(`${API_BASE_URL}/pages/${parent.id}/slug`, {
    headers,
    data: { slug: `renamed-${SUFFIX}` }
  });
  expect(renamed.status()).toBe(200);

  const { doc } = await request
    .get(`${API_BASE_URL}/pages/${child.id}`, { headers })
    .then((response) => response.json());
  expect(doc._urlPath).toBe(`renamed-${SUFFIX}/${child._slug}`);
  expect(new URL(doc.url).pathname).toBe(`/renamed-${SUFFIX}/${child._slug}`);
});

// A stream stays open while nothing happens, on either runtime, and still carries the next event.
// 12 s is past the 10 s a server's idle timeout may default to, and short of the keep-alive.
test('a quiet SSE stream still carries the lock event', async ({ request }) => {
  test.setTimeout(45_000);
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { title: `Stream ${SUFFIX}` }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  const { response, close } = await openStream(`rime:pages:${doc.id}`, headers.cookie);
  expect(response.status).toBe(200);
  const stream = streamReader(response);
  await stream.until(': open');

  await new Promise((resolve) => setTimeout(resolve, 12_000));

  const lock = await request.post(`${API_BASE_URL}/pages/${doc.id}/lock`, { headers });
  expect(lock.status()).toBe(200);
  const received = await stream.until('"event":"rime:lock"');
  expect(received).toContain('data: {"event":"rime:lock","payload":{}}');
  close();
});
