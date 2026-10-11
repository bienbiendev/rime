import test, { expect, type Page } from '@playwright/test';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// The access tests sign in the editor an earlier test creates: one failing skips the rest
test.describe.configure({ mode: 'serial' });

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

async function createHooksTestDoc(page: Page) {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
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
}

/** ---------------- ONE SUBMIT, ONE HOOK PER FIELD ---------------- */

test('Should run each field hook through a real form submit', async ({ page }) => {
  await createHooksTestDoc(page);
  const magicText = page.locator('input[name="magicText"]');
  const taggedText = page.locator('input[name="taggedText"]');
  const score = page.locator('fieldset[data-path="score"] input[type="number"]');
  const contact = page.locator('input[name="contact"]');
  const notes = page.locator('textarea[name="notes"]');
  const framework = page.locator('fieldset[data-path="framework"] .rz-combobox__trigger');

  await magicText.pressSequentially('anything typed', { delay: 30 });
  await taggedText.pressSequentially('hello', { delay: 30 });
  await score.fill('150');
  await contact.pressSequentially('Foo@EXAMPLE.com', { delay: 30 });
  await notes.pressSequentially('  hello world  ', { delay: 30 });
  await framework.click();
  await page.locator('.rz-combobox__item', { hasText: 'React' }).click();

  await save(page);

  // beforeValidate coerces a text to foo
  await expect.soft(magicText).toHaveValue('foo');
  // $beforeSave appends -tagged to a text
  await expect.soft(taggedText).toHaveValue('hello-tagged');
  // beforeValidate clamps a typed number to 100
  await expect.soft(score).toHaveValue('100');
  // $beforeSave lowercases an email after its built-in sanitize
  await expect.soft(contact).toHaveValue('foo@example.com');
  // $beforeSave trims a textarea
  await expect.soft(notes).toHaveValue('hello world');
  // $beforeSave substitutes svelte for react in a combobox
  await expect.soft(framework).toContainText('Svelte');
});

/** ---------------- CUSTOM VALIDATE, CHECKBOX ---------------- */

test('Should block the create form when agree is left unchecked', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));
  await page.locator('input[name="title"]').pressSequentially('Should not save', { delay: 30 });

  await page.locator('button[type="submit"]').click();

  // The box shows the error, and nothing was stored
  await expect(page.locator('fieldset[data-path="agree"] .rz-checkbox--error')).toBeVisible();
  const { docs } = await request
    .get(
      `${API_BASE_URL}/hooks-test?where[title][equals]=${encodeURIComponent('Should not save')}`,
      { headers: await signInSuperAdmin(request) }
    )
    .then((r) => r.json());
  expect(docs).toEqual([]);
});

/** ---------------- MANY-SELECT, ADD / REMOVE / ORDER ---------------- */

test('Should add, remove and keep the order of many-select values', async ({ page, request }) => {
  await createHooksTestDoc(page);
  const tags = page.locator('fieldset[data-path="tags"]');

  // Picked from the keyboard, out of the options' order: the values keep the order they were
  // picked in. The search keeps its focus between picks; the last pick leaves nothing to search.
  await tags.locator('input').click();
  for (const label of ['C', 'A', 'B']) {
    await page.keyboard.type(label);
    const option = tags.getByRole('option', { name: label, exact: true });
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
  }
  await expect(tags.locator('.rz-tag')).toHaveText(['C', 'A', 'B']);

  await tags.locator('.rz-tag', { hasText: 'A' }).locator('.rz-tag__button').click();
  await expect(tags.locator('.rz-tag')).toHaveText(['C', 'B']);

  await save(page);
  await expect(tags.locator('.rz-tag')).toHaveText(['C', 'B']);
  const id = new URL(page.url()).pathname.split('/').pop();
  const { doc } = await request
    .get(`${API_BASE_URL}/hooks-test/${id}`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());
  expect(doc.tags).toEqual(['c', 'b']);
});

/** ---------------- FIELD-LEVEL ACCESS, ACROSS FIELD TYPES (UI) ---------------- */

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

  // The form is there, its admin fields are not. The relation the editor reads has its input:
  // the relations to `targets` have their documents.
  await expect(page.locator('input[name="title"]')).toBeVisible();
  await expect(page.locator('fieldset[data-path="restrictedRelation"] input')).toBeVisible();
  for (const control of hiddenFromEditorLocators) {
    await expect(page.locator(control)).toHaveCount(0);
  }
});

test('Should render read-restricted fields, enabled, for the super admin', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));

  for (const control of hiddenFromEditorLocators) {
    await expect(page.locator(control)).toBeEnabled();
  }
});

test('Should show but disable write-restricted fields for a non-admin editor', async ({ page }) => {
  await loginAs(page, 'hooks-ui-editor@email.com', PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));

  for (const control of restrictedFieldLocators) {
    await expect(page.locator(control)).toBeVisible();
    await expect(page.locator(control)).toBeDisabled();
  }
});

test('Should show and enable write-restricted fields for the super admin', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('hooks-test', 'create'));

  for (const control of restrictedFieldLocators) {
    await expect(page.locator(control)).toBeVisible();
    await expect(page.locator(control)).toBeEnabled();
  }
});
