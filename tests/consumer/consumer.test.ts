import test, { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Reused from tests/basic rather than adding a new binary fixture just for this suite.
const FIXTURE_IMAGE = readFileSync(
  fileURLToPath(new URL('../basic/landscape.jpg', import.meta.url))
);

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

// dev/prod passes share the same sqlite db (built with `rime build -d`), so
// suffix anything that must be unique (staff email) per pass.
const SUFFIX = process.env.CONSUMER_TEST_SUFFIX || 'run';

function panelUrl(...args: string[]) {
  const base = process.env.PUBLIC_RIME_URL;
  return args.length ? `${base}/panel/${args.join('/')}` : `${base}/panel`;
}

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
  await nav.locator(`a[href="${panelUrl('pages')}"]`).click();
  await page.waitForLoadState('networkidle');
  // "^=" not "=": upload collections append ?uploadPath=... to their create link (see
  // ButtonCreate.svelte), so an exact match would miss medias' create button.
  await page.locator(`a[href^="${panelUrl('pages', 'create')}"]`).click();
  await page.waitForLoadState('networkidle');
  const title = `Home ${SUFFIX}`;
  await page.locator('input.rz-input[name="title"]').pressSequentially(title, { delay: 50 });
  const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  // h1 reflects asTitle reactively off the *live* form state (see documentForm.svelte.ts's
  // initTitle effect), so it already shows `title` the moment it was typed - it's not
  // proof the create+redirect actually completed. Wait for the URL to actually move off
  // /create before doing anything else, or the next step can race ahead of the redirect.
  await page.waitForURL(/\/panel\/pages\/(?!create$)[^/]+$/);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-page-header__row h1')).toHaveText(title);

  // Create a staff member
  await nav.locator(`a[href="${panelUrl('staff')}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href^="${panelUrl('staff', 'create')}"]`).click();
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
  await page.waitForURL(/\/panel\/staff\/(?!create$)[^/]+$/);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-page-header__row h1')).toHaveText(staffEmail);

  // Create a media (exercises sharp processing + serve-static)
  await nav.locator(`a[href="${panelUrl('medias')}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href^="${panelUrl('medias', 'create')}"]`).click();
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
  await page.waitForURL(/\/panel\/medias\/(?!create$)[^/]+$/);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-page-header__row h1')).toHaveText(mediaFilename);

  expect(pageErrors).toEqual([]);
});
