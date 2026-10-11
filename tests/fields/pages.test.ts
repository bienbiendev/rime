import test, { expect } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

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
  // An error can come from any request the page sends once mounted: all of them are answered.
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});

/** ---------------- ONCHANGE SYNC, VALIDATION ERROR, .condition() ---------------- */

test('Should sync, validate and hide fields on the create form', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));

  // onChange syncs fullName from firstName + lastName
  await page.locator('input[name="firstName"]').pressSequentially('Ada', { delay: 30 });
  await page.locator('input[name="lastName"]').pressSequentially('Lovelace', { delay: 30 });
  await expect.soft(page.locator('input[name="fullName"]')).toHaveValue('Ada Lovelace');

  // onChange syncs categoryLabel from category (select)
  await page.locator('fieldset[data-path="category"] input').click();
  await page.getByText('News', { exact: true }).click();
  await expect.soft(page.locator('input[name="categoryLabel"]')).toHaveValue('Selected: news');

  // onChange syncs featuredLabel from featured (checkbox)
  await page.locator('fieldset[data-path="featured"] .rz-checkbox-field__input').click();
  await expect.soft(page.locator('input[name="featuredLabel"]')).toHaveValue('Yes');

  // onChange syncs publishedLabel from published (toggle)
  await page.locator('fieldset[data-path="published"] .rz-switch').click();
  await expect.soft(page.locator('input[name="publishedLabel"]')).toHaveValue('Live');

  // onChange syncs priorityLabel from priority (number)
  await page.locator('fieldset[data-path="priority"] input[type="number"]').fill('7');
  await page.locator('fieldset[data-path="priority"] input[type="number"]').blur();
  await expect.soft(page.locator('input[name="priorityLabel"]')).toHaveValue('Priority 7');

  // A cleared title shows the validation error
  const titleInput = page.locator('input[name="title"]');
  await titleInput.pressSequentially('Temp', { delay: 30 });
  await titleInput.fill('');
  await titleInput.blur();
  await expect.soft(titleInput).toHaveAttribute('data-error', '');
  await expect
    .soft(page.locator('fieldset[data-path="title"] .rz-field-error'))
    .toHaveText('Required');

  // .condition() hides slug once isHome is toggled on
  const slugField = page.locator('fieldset[data-path="slug"]');
  await expect.soft(slugField).toBeVisible();
  await page.locator('fieldset[data-path="isHome"] .rz-switch').click();
  await expect.soft(slugField).toBeHidden();
});

/** ---------------- GROUP WITH MANY FIELDS: SAVE + RELOAD ---------------- */

test('Should persist the text, textarea, checkbox, toggle, select and number of the meta group after save and reload', async ({
  page
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));

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

  await expect(page.locator('input[name="title"]')).toHaveValue('Group save test');

  // The group's collapse state is remembered in localStorage keyed by the
  // group's own field-name signature (not the document id), and localStorage
  // survives reload() — so it's already expanded from the click above.
  // Don't assume either state; only click if it's still collapsed.
  await expect(groupTrigger).toBeVisible();
  if ((await page.locator('input[name="meta.metaTitle"]').count()) === 0) {
    await groupTrigger.click();
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

/** ---------------- CLEARED DATE ---------------- */

test('A date cleared in the calendar is saved empty', async ({ page, request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { title: 'Cleared date', publishDate: '2026-03-14T12:00:00.000Z' }
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).doc.id as string;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));
  await page.locator('fieldset[data-path="publishDate"] .rz-date__button').click();
  // Clicking the selected day again deselects it
  await page.locator('[data-bits-day][data-selected]').click();
  await page.keyboard.press('Escape');
  await expect(
    page.locator('fieldset[data-path="publishDate"] .rz-date__button')
  ).not.toContainText('1970');
  await page.locator('button[type="submit"]').click();

  await expect
    .poll(async () => {
      const { doc } = await request
        .get(`${API_BASE_URL}/pages/${id}`, { headers })
        .then((r) => r.json());
      return doc.publishDate;
    })
    .toBeNull();
});

/** ---------------- DIGIT-ONLY TEXT ---------------- */

test('A text made only of digits is saved as text through the panel', async ({ page, request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { title: 'Digits' }
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).doc.id as string;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));
  const metaTrigger = page.locator('.rz-group-field__trigger').filter({ hasText: 'Meta' });
  await expect(metaTrigger).toBeVisible();
  if ((await page.locator('input[name="meta.metaTitle"]').count()) === 0) {
    await metaTrigger.click();
  }
  await page.locator('input[name="meta.metaTitle"]').fill('007');
  await page.locator('button[type="submit"]').click();

  await expect
    .poll(async () => {
      const { doc } = await request
        .get(`${API_BASE_URL}/pages/${id}`, { headers })
        .then((r) => r.json());
      return doc.meta?.metaTitle;
    })
    .toBe('007');
});

/** ---------------- TABS INSIDE A GROUP ---------------- */

test('A tabs field inside a group reads and writes its own path', async ({ page, request }) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { title: 'Nested tabs', meta: { seo: { seoTitle: 'Stored' } } }
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).doc.id as string;
  const readMeta = async () =>
    (await request.get(`${API_BASE_URL}/pages/${id}`, { headers }).then((r) => r.json())).doc.meta;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));
  const metaTrigger = page.locator('.rz-group-field__trigger').filter({ hasText: 'Meta' });
  await expect(metaTrigger).toBeVisible();
  if ((await page.locator('input[name="meta.metaTitle"]').count()) === 0) {
    await metaTrigger.click();
  }

  const input = page.locator('input[name="meta.seo.seoTitle"]');
  await expect(input).toHaveValue('Stored');
  await input.fill('Edited');
  await page.locator('button[type="submit"]').click();

  await expect.poll(async () => (await readMeta())?.seo?.seoTitle).toBe('Edited');
  expect((await readMeta())['']).toBeUndefined();
});

/** ---------------- GROUP PREVIEW WHEN COLLAPSED ---------------- */

test('Should show field labels and values in the group preview when collapsed', async ({
  page
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));

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
  const editor = await request.post(`${API_BASE_URL}/staff`, {
    headers: superAdminHeaders,
    data: {
      email: 'ui-editor@email.com',
      name: 'UI Editor',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  expect(editor.status()).toBe(200);

  await loginAs(page, 'ui-editor@email.com', PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  // Playwright's toBeDisabled()/isDisabled() doesn't recognize <fieldset> as
  // a disableable element (only button/input/select/textarea/optgroup/option),
  // even though `<fieldset disabled>` genuinely matches :disabled and natively
  // disables its descendants — so assert on the inner control, not the wrapper.
  await expect(page.locator('fieldset[data-path="restrictedField"] input')).toBeDisabled();

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', 'create'));
  await expect(page.locator('fieldset[data-path="restrictedField"] input')).toBeEnabled();
});
