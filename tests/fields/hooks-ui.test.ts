import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

/**
 * UI-driven counterparts to a subset of api.test.ts's hook coverage.
 *
 * api.test.ts exercises hooks by PATCHing JSON straight at the REST API —
 * it never goes through the panel form's submit path (flatten -> FormData ->
 * unflatten on the server, see extract-data.server.ts), which is exactly
 * the path a real empty-name-key/array-corruption-style bug lives in. These
 * tests fill the real form, click Save, reload, and check the value that
 * actually came back from the server — only field types/hooks a person
 * could genuinely trigger by typing/clicking are covered here (e.g. radio's
 * beforeValidate remap of an out-of-list value can't be triggered from the
 * UI at all, since the UI never offers that option — that one stays API-only).
 */

function panelUrl(...args: string[]) {
  if (!args.length) return `${process.env.PUBLIC_RIME_URL}/panel`;
  return `${process.env.PUBLIC_RIME_URL}/panel/${args.join('/')}`;
}

async function loginAs(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto(panelUrl('sign-in'));
  await page.locator('input[name="email"]').pressSequentially(email, { delay: 30 });
  await page.locator('input[name="password"]').pressSequentially(password, { delay: 30 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(panelUrl());
}

async function createHooksTestDoc(page: Page) {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="title"]').pressSequentially('UI hooks doc', { delay: 30 });
  // agree has a custom validator requiring true with no valid default — every
  // create must check it or the whole save is rejected (see api.test.ts).
  await page.locator('fieldset[data-path="agree"] .rz-checkbox-field__input').click();
}

async function save(page: Page) {
  await page.locator('button[type="submit"]').click();
  // Not just [^/]+$ — that also matches the create route itself
  // ("create" satisfies [^/]+), which resolved this instantly before the
  // real redirect happened and made the follow-up reload() just reload the
  // still-blank create form.
  await page.waitForURL(/\/panel\/hooks-test\/(?!create$)[^/]+$/);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/** ---------------- BEFOREVALIDATE -> VALIDATE COERCION, TEXT ---------------- */

test('Should coerce magicText to foo through a real form submit', async ({ page }) => {
  await createHooksTestDoc(page);
  await page.locator('input[name="magicText"]').pressSequentially('anything typed', { delay: 30 });

  await save(page);

  await expect(page.locator('input[name="magicText"]')).toHaveValue('foo');
});

/** ---------------- $BEFORESAVE (server-only), TEXT ---------------- */

test('Should append -tagged to taggedText through a real form submit', async ({ page }) => {
  await createHooksTestDoc(page);
  await page.locator('input[name="taggedText"]').pressSequentially('hello', { delay: 30 });

  await save(page);

  await expect(page.locator('input[name="taggedText"]')).toHaveValue('hello-tagged');
});

/** ---------------- BEFOREVALIDATE CLAMPING, NUMBER ---------------- */

test('Should clamp a manually typed out-of-range score down to 100', async ({ page }) => {
  await createHooksTestDoc(page);
  await page.locator('fieldset[data-path="score"] input[type="number"]').fill('150');

  await save(page);

  await expect(page.locator('fieldset[data-path="score"] input[type="number"]')).toHaveValue('100');
});

/** ---------------- $BEFORESAVE (server-only) AFTER BUILT-IN SANITIZE, EMAIL ---------------- */

test('Should lowercase contact through a real form submit', async ({ page }) => {
  await createHooksTestDoc(page);
  await page.locator('input[name="contact"]').pressSequentially('Foo@EXAMPLE.com', { delay: 30 });

  await save(page);

  await expect(page.locator('input[name="contact"]')).toHaveValue('foo@example.com');
});

/** ---------------- $BEFORESAVE (server-only), TEXTAREA ---------------- */

test('Should trim notes through a real form submit', async ({ page }) => {
  await createHooksTestDoc(page);
  await page.locator('textarea[name="notes"]').pressSequentially('  hello world  ', { delay: 30 });

  await save(page);

  await expect(page.locator('textarea[name="notes"]')).toHaveValue('hello world');
});

/** ---------------- $BEFORESAVE (server-only) SUBSTITUTION, COMBOBOX ---------------- */

test('Should substitute framework react for svelte through a real form submit', async ({
  page
}) => {
  await createHooksTestDoc(page);
  await page.locator('fieldset[data-path="framework"] .rz-combobox__trigger').click();
  await page.locator('.rz-combobox__item', { hasText: 'React' }).click();

  await save(page);

  await expect(page.locator('fieldset[data-path="framework"] .rz-combobox__trigger')).toContainText(
    'Svelte'
  );
});

/** ---------------- CUSTOM VALIDATE, CHECKBOX ---------------- */

test('Should block the create form when agree is left unchecked', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="title"]').pressSequentially('Should not save', { delay: 30 });

  await page.locator('button[type="submit"]').click();

  // No redirect on a rejected create — still on the create route.
  await expect(page).toHaveURL(/\/panel\/hooks-test\/create/);
});

/** ---------------- FIELD-LEVEL ACCESS, ACROSS FIELD TYPES (UI) ---------------- */

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

test('Should create a hooks-ui-editor staff account', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'hooks-ui-editor@email.com',
      name: 'Hooks UI Editor',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
});

test('Should create a relation target for the adminOnlyRelation field', async ({ request }) => {
  // The relation field's input only renders once there's at least one
  // document to relate to — this test file can't rely on another file
  // having already created one (file/test order isn't guaranteed).
  const response = await request.post(`${API_BASE_URL}/targets`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Hooks UI target' }
  });
  expect(response.status()).toBe(200);
});

// Two distinct access tiers, matching config/hooks-test.ts's two
// "field-level access" blocks — read() is what gates whether the field
// renders at all (RenderFields.svelte's authorizedFields filter runs
// canRead before a FieldComponent is ever mounted, so a read-denied field
// has no DOM node whatsoever, not just a disabled one), independent of
// create()/update().
const hiddenFromEditorLocators = [
  'fieldset[data-path="adminOnlyCheckbox"] .rz-checkbox-field__input',
  'fieldset[data-path="adminOnlyToggle"] .rz-switch',
  'fieldset[data-path="adminOnlySelect"] input',
  'fieldset[data-path="adminOnlyNumber"] input[type="number"]',
  'fieldset[data-path="adminOnlyDate"] button.rz-date__button',
  'fieldset[data-path="adminOnlyRelation"] input'
];

// Text's restrictedField is covered separately by pages.test.ts; this rounds
// out the other shapes.
const restrictedFieldLocators = [
  'fieldset[data-path="restrictedCheckbox"] .rz-checkbox-field__input',
  'fieldset[data-path="restrictedToggle"] .rz-switch',
  'fieldset[data-path="restrictedSelect"] input',
  'fieldset[data-path="restrictedNumber"] input[type="number"]',
  'fieldset[data-path="restrictedDate"] button.rz-date__button',
  'fieldset[data-path="restrictedRelation"] input'
];

test('Should not render read-restricted fields at all for a non-admin editor', async ({ page }) => {
  await loginAs(page, 'hooks-ui-editor@email.com', PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.waitForLoadState('networkidle');

  for (const control of hiddenFromEditorLocators) {
    await expect(page.locator(control)).toHaveCount(0);
  }
});

test('Should render read-restricted fields, enabled, for the super admin', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.waitForLoadState('networkidle');

  for (const control of hiddenFromEditorLocators) {
    await expect(page.locator(control)).toBeEnabled();
  }
});

test('Should show but disable write-restricted fields for a non-admin editor', async ({ page }) => {
  await loginAs(page, 'hooks-ui-editor@email.com', PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.waitForLoadState('networkidle');

  for (const control of restrictedFieldLocators) {
    await expect(page.locator(control)).toBeVisible();
    await expect(page.locator(control)).toBeDisabled();
  }
});

test('Should show and enable write-restricted fields for the super admin', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.waitForLoadState('networkidle');

  for (const control of restrictedFieldLocators) {
    await expect(page.locator(control)).toBeVisible();
    await expect(page.locator(control)).toBeEnabled();
  }
});
