import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

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

  await loginAs(page, ADMIN_EMAIL, PASSWORD);

  const response = await page.goto(panelUrl('pages', 'create'));
  expect(response?.status()).toBe(200);
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});

/** ---------------- ONCHANGE SYNC BETWEEN FIELDS ---------------- */

test('Should sync fullName from firstName + lastName via onChange', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="firstName"]').pressSequentially('Ada', { delay: 30 });
  await page.locator('input[name="lastName"]').pressSequentially('Lovelace', { delay: 30 });

  await expect(page.locator('input[name="fullName"]')).toHaveValue('Ada Lovelace');
});

/** ---------------- VALIDATION ERROR STATE ---------------- */

test('Should mark title with a validation error when cleared', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
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
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  const slugField = page.locator('fieldset[data-path="slug"]');
  await expect(slugField).toBeVisible();

  await page.locator('fieldset[data-path="isHome"] .rz-switch').click();

  await expect(slugField).toBeHidden();
});

/** ---------------- ONCHANGE SYNC, NON-TEXT FIELD TYPES ---------------- */

test('Should sync categoryLabel from category via onChange (select)', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('fieldset[data-path="category"] input').click();
  await page.getByText('News', { exact: true }).click();

  await expect(page.locator('input[name="categoryLabel"]')).toHaveValue('Selected: news');
});

test('Should sync featuredLabel from featured via onChange (checkbox)', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('fieldset[data-path="featured"] .rz-checkbox-field__input').click();

  await expect(page.locator('input[name="featuredLabel"]')).toHaveValue('Yes');
});

test('Should sync publishedLabel from published via onChange (toggle)', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('fieldset[data-path="published"] .rz-switch').click();

  await expect(page.locator('input[name="publishedLabel"]')).toHaveValue('Live');
});

test('Should sync priorityLabel from priority via onChange (number)', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('fieldset[data-path="priority"] input[type="number"]').fill('7');
  await page.locator('fieldset[data-path="priority"] input[type="number"]').blur();

  await expect(page.locator('input[name="priorityLabel"]')).toHaveValue('Priority 7');
});

/** ---------------- GROUP WITH MANY FIELDS: SAVE + RELOAD ---------------- */

test('Should persist every field in the meta group after save and reload', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="title"]').pressSequentially('Group save test', { delay: 30 });

  // The group starts collapsed (localStorage-remembered open state defaults
  // to closed on first visit) — expand it before touching its fields.
  const groupTrigger = page.locator('.rz-group-field__trigger').filter({ hasText: 'Meta' });
  await groupTrigger.click();

  await page
    .locator('input[name="meta.metaTitle"]')
    .pressSequentially('Nested title', { delay: 30 });
  await page
    .locator('textarea[name="meta.metaDescription"]')
    .pressSequentially('Nested description', { delay: 30 });
  await page.locator('fieldset[data-path="meta.metaFeatured"] .rz-checkbox-field__input').click();
  await page.locator('fieldset[data-path="meta.metaPublished"] .rz-switch').click();
  await page.locator('fieldset[data-path="meta.metaCategory"] input').click();
  await page.getByText('Blog', { exact: true }).click();
  await page.locator('fieldset[data-path="meta.metaPriority"] input[type="number"]').fill('4');

  await page.locator('button[type="submit"]').click();
  // Not just [^/]+$ — that also matches the create route itself
  // ("create" satisfies [^/]+), which resolved this instantly before the
  // real redirect happened and made the follow-up reload() just reload the
  // still-blank create form.
  await page.waitForURL(/\/panel\/pages\/(?!create$)[^/]+$/);

  // Reload from the server — this is the part that would have silently
  // dropped everything except the first field if the group's container had
  // been corrupted into an array (the separator-empty-name-key bug).
  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.locator('input[name="title"]')).toHaveValue('Group save test');

  // The group's collapse state is remembered in localStorage keyed by the
  // group's own field-name signature (not the document id), and localStorage
  // survives reload() — so it's already expanded from the click above.
  // Don't assume either state; only click if it's still collapsed.
  if ((await page.locator('input[name="meta.metaTitle"]').count()) === 0) {
    await page.locator('.rz-group-field__trigger').filter({ hasText: 'Meta' }).click();
  }

  await expect(page.locator('input[name="meta.metaTitle"]')).toHaveValue('Nested title');
  await expect(page.locator('textarea[name="meta.metaDescription"]')).toHaveValue(
    'Nested description'
  );
  await expect(
    page.locator('fieldset[data-path="meta.metaFeatured"] .rz-checkbox-field__input')
  ).toHaveAttribute('data-state', 'checked');
  await expect(page.locator('fieldset[data-path="meta.metaPublished"] .rz-switch')).toHaveAttribute(
    'data-state',
    'checked'
  );
  await expect(page.locator('fieldset[data-path="meta.metaCategory"]')).toContainText('Blog');
  await expect(
    page.locator('fieldset[data-path="meta.metaPriority"] input[type="number"]')
  ).toHaveValue('4');
});

/** ---------------- GROUP PREVIEW WHEN COLLAPSED ---------------- */

test('Should show field labels and values in the group preview when collapsed', async ({
  page
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');

  const groupTrigger = page.locator('.rz-group-field__trigger').filter({ hasText: 'Meta' });
  await groupTrigger.click();
  await page
    .locator('input[name="meta.metaTitle"]')
    .pressSequentially('Preview title', { delay: 30 });

  // Collapse it again — this switches to FieldsPreview.svelte's read-only summary.
  await groupTrigger.click();

  // capitalize() only uppercases the first letter (no camelCase word
  // splitting), so metaTitle's fallback label is "MetaTitle", not "Meta title".
  const previewRow = page.locator('.rz-render-fields-preview__row', { hasText: 'MetaTitle' });
  await expect(previewRow).toBeVisible();
  await expect(previewRow.locator('.rz-render-fields-preview__value')).toContainText(
    'Preview title'
  );
});

/** ---------------- FIELD DISABLED VIA .access() ---------------- */

test('Should disable restrictedField for a non-admin editor, enable it for the super admin', async ({
  page,
  request
}) => {
  const superAdminHeaders = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  await request.post(`${API_BASE_URL}/staff`, {
    headers: superAdminHeaders,
    data: {
      email: 'ui-editor@email.com',
      name: 'UI Editor',
      roles: ['editor'],
      password: PASSWORD
    }
  });

  await loginAs(page, 'ui-editor@email.com', PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');
  // Playwright's toBeDisabled()/isDisabled() doesn't recognize <fieldset> as
  // a disableable element (only button/input/select/textarea/optgroup/option),
  // even though `<fieldset disabled>` genuinely matches :disabled and natively
  // disables its descendants — so assert on the inner control, not the wrapper.
  await expect(page.locator('fieldset[data-path="restrictedField"] input')).toBeDisabled();

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('fieldset[data-path="restrictedField"] input')).toBeEnabled();
});
