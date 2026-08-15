import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

function panelUrl(...args: string[]) {
  if (!args.length) return `${process.env.PUBLIC_RIME_URL}/panel`;
  return `${process.env.PUBLIC_RIME_URL}/panel/${args.join('/')}`;
}

async function loginAs(page: Page, email: string, password: string) {
  // Navigating to /sign-in while already authenticated redirects to /panel
  // instead of showing the form, so clear the session first — this makes
  // loginAs safe to call repeatedly to switch accounts within one test.
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

/** ---------------- NO CONSOLE ERRORS ---------------- */

test('Should load the pages create page without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await loginAs(page, 'admin@bienoubien.studio', 'a&1Aa&1A');

  const response = await page.goto(panelUrl('pages', 'create'));
  expect(response?.status()).toBe(200);
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});

/** ---------------- ONCHANGE SYNC BETWEEN FIELDS ---------------- */

test('Should sync fullName from firstName + lastName via onChange', async ({ page }) => {
  await loginAs(page, 'admin@bienoubien.studio', 'a&1Aa&1A');
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="firstName"]').pressSequentially('Ada', { delay: 30 });
  await page.locator('input[name="lastName"]').pressSequentially('Lovelace', { delay: 30 });

  await expect(page.locator('input[name="fullName"]')).toHaveValue('Ada Lovelace');
});

/** ---------------- VALIDATION ERROR STATE ---------------- */

test('Should mark title with a validation error when cleared', async ({ page }) => {
  await loginAs(page, 'admin@bienoubien.studio', 'a&1Aa&1A');
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  const titleInput = page.locator('input[name="title"]');
  await titleInput.pressSequentially('Temp', { delay: 30 });
  await titleInput.fill('');
  await titleInput.blur();

  await expect(titleInput).toHaveAttribute('data-error', '');
  await expect(page.locator('fieldset[data-path="title"] .rz-field-error')).toBeVisible();
});

/** ---------------- FIELD VISIBILITY VIA .condition() ---------------- */

test('Should hide slug once isHome is toggled on', async ({ page }) => {
  await loginAs(page, 'admin@bienoubien.studio', 'a&1Aa&1A');
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  const slugField = page.locator('fieldset[data-path="slug"]');
  await expect(slugField).toBeVisible();

  await page.locator('fieldset[data-path="isHome"] .rz-switch').click();

  await expect(slugField).toBeHidden();
});

/** ---------------- FIELD DISABLED VIA .access() ---------------- */

test('Should disable restrictedField for a non-admin editor, enable it for the super admin', async ({
  page,
  request
}) => {
  const superAdminHeaders = await signIn('admin@bienoubien.studio', 'a&1Aa&1A')(request);
  await request.post(`${API_BASE_URL}/staff`, {
    headers: superAdminHeaders,
    data: {
      email: 'ui-editor@bienoubien.com',
      name: 'UI Editor',
      roles: ['editor'],
      password: 'a&1Aa&1A'
    }
  });

  await loginAs(page, 'ui-editor@bienoubien.com', 'a&1Aa&1A');
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');
  // Playwright's toBeDisabled()/isDisabled() doesn't recognize <fieldset> as
  // a disableable element (only button/input/select/textarea/optgroup/option),
  // even though `<fieldset disabled>` genuinely matches :disabled and natively
  // disables its descendants — so assert on the inner control, not the wrapper.
  await expect(page.locator('fieldset[data-path="restrictedField"] input')).toBeDisabled();

  await loginAs(page, 'admin@bienoubien.studio', 'a&1Aa&1A');
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('fieldset[data-path="restrictedField"] input')).toBeEnabled();
});
