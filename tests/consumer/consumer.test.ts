import test, { expect } from '@playwright/test';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

// dev/prod passes share the same sqlite db (built with `rime build -d`), so
// suffix anything that must be unique (staff email) per pass.
const SUFFIX = process.env.CONSUMER_TEST_SUFFIX || 'run';

function panelUrl(...args: string[]) {
  const base = process.env.PUBLIC_RIME_URL;
  return args.length ? `${base}/panel/${args.join('/')}` : `${base}/panel`;
}

test('unauthenticated visit to /panel redirects to sign-in', async ({ page }) => {
  await page.goto(panelUrl());
  await page.waitForURL(panelUrl('sign-in'));
  expect(page.url()).toBe(panelUrl('sign-in'));
});

test('sign in, create a page, create a staff member, no errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
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

  // Create a page
  await page.goto(panelUrl('pages', 'create'));
  const title = `Home ${SUFFIX}`;
  await page.locator('input.rz-input[name="title"]').pressSequentially(title, { delay: 50 });
  const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-page-header__row h1')).toHaveText(title);

  // Create a staff member
  await page.goto(panelUrl('staff', 'create'));
  const staffEmail = `staff-${SUFFIX}@email.com`;
  await page.locator('input.rz-input[name="email"]').pressSequentially(staffEmail, { delay: 50 });
  await page.locator('input.rz-input[name="name"]').pressSequentially('Staff User', { delay: 50 });
  await page
    .locator('input.rz-input[name="password"]')
    .pressSequentially(PASSWORD, { delay: 50 });
  await page
    .locator('input.rz-input[name="confirmPassword"]')
    .pressSequentially(PASSWORD, { delay: 50 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  // redirected off /staff/create to the new doc's edit page confirms the save succeeded
  await page.waitForURL(/\/panel\/staff\/(?!create$)[^/]+$/);

  expect(pageErrors).toEqual([]);
});
