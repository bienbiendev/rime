import test, { expect } from '@playwright/test';
import { API_BASE_URL, BASE_URL, PANEL_SEGMENT, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const TITLE = 'input[name="attributes.title"]';

// The tests run in order and share the page they create: one failure skips the rest.
test.describe.configure({ mode: 'serial' });

/**
 * The panel's language switcher on a document with unsaved changes.
 *
 * `pages` does not auto-save, so a switch with something typed asks first. Confirming drops the
 * typing and reloads in the other locale; cancelling keeps both the typing and the locale.
 */

let pageId: string;

test('Should create a page', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { title: 'Page à traduire', slug: 'page-a-traduire' } }
  });
  expect(response.status()).toBe(200);
  pageId = (await response.json()).doc.id;
});

test('Switching locale with unsaved changes asks first', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  // An English title of its own: the English row then tells whether a save landed there
  const english = await request.patch(`${API_BASE_URL}/pages/${pageId}?locale=en`, {
    headers,
    data: { attributes: { title: 'Page to translate' } }
  });
  expect(english.status()).toBe(200);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', pageId));
  await page.getByRole('tab', { name: 'attributes' }).click();
  await expect(page.locator(TITLE)).toHaveValue('Page à traduire');

  await page.locator(TITLE).fill('Page à traduire, modifiée');
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();

  // Cancel: the typing and the locale stay.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Annuler/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(TITLE)).toHaveValue('Page à traduire, modifiée');
  await expect(page.getByRole('button', { name: 'Français' })).toBeVisible();

  // Save: the typing lands in the French row, the one on screen, and not in the English one.
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );
  await page.locator('button[data-submit]').click();
  expect((await saved).ok()).toBe(true);
  const title = (locale: string) =>
    request
      .get(`${API_BASE_URL}/pages/${pageId}?locale=${locale}`, { headers })
      .then((r) => r.json())
      .then((r) => r.doc.attributes.title);
  expect(await title('fr')).toBe('Page à traduire, modifiée');
  expect(await title('en')).toBe('Page to translate');

  // The form takes the saved document before its toast is up: typing goes after it.
  await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();

  // Typed again, then confirmed: the page reloads in English, the typing is gone.
  await page.getByRole('tab', { name: 'attributes' }).click();
  await page.locator(TITLE).fill('Page à traduire, encore');
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Confirmer/ }).click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await page.getByRole('tab', { name: 'attributes' }).click();
  await expect(page.locator(TITLE)).toHaveValue('Page to translate');
  // Nothing was saved: FR still holds the title saved above
  expect(await title('fr')).toBe('Page à traduire, modifiée');
});

/**
 * The panel keeps its locale in a cookie of its own path: in the same browser, /api and the site
 * read the locale they are asked for, the default one here.
 */
test('The panel locale stays in the panel', async ({ page, context, request }) => {
  const headers = await signInSuperAdmin(request);
  // English and French titles differ, so the site's heading tells which locale it read
  await request.patch(`${API_BASE_URL}/pages/${pageId}?locale=en`, {
    headers,
    data: { attributes: { title: 'Page to translate' } }
  });
  const { doc } = await request
    .get(`${API_BASE_URL}/pages/${pageId}?locale=fr`, { headers })
    .then((r) => r.json());

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', pageId));
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name === 'rime.locale');
  expect(cookie?.path).toBe(`/${PANEL_SEGMENT}`);

  const api = await context.request.get(`${API_BASE_URL}/pages/${pageId}`);
  expect((await api.json()).doc.locale).toBe('fr');
  const site = await context.newPage();
  await site.goto(`${BASE_URL}/${doc.attributes.slug}`);
  await expect(site.locator('h1')).toHaveText(doc.attributes.title);

  await page.reload();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
});

/**
 * The panel speaks French here, whatever language the content is in: dates and error texts
 * are French sentences.
 */
test('A date reads in the panel language with the content in English', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', pageId));
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();

  await expect(
    page.getByText(/^Créé le (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) /)
  ).toBeVisible();
});

test('A weak password reads as a sentence under the field', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('staff', 'create'));
  await page.locator('input.rz-input[name="password"]').pressSequentially('abc', { delay: 30 });

  await expect(page.locator('.rz-field-error', { hasText: 'Au moins 8 caractères' })).toBeVisible();
});

/**
 * "Import from default locale", on the English form: the French values replace the English ones
 * on screen, and the save writes them to the English row.
 */
test('Import from default locale copies the French values into the English row', async ({
  page,
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: 'Page à importer', slug: 'page-a-importer' },
      seo: { metaTitle: 'Méta à importer' }
    }
  });
  expect(created.status()).toBe(200);
  const id = (await created.json()).doc.id;
  // English values of its own, which the import replaces
  const english = await request.patch(`${API_BASE_URL}/pages/${id}?locale=en`, {
    headers,
    data: { attributes: { title: 'Page to import' }, seo: { metaTitle: 'Meta to import' } }
  });
  expect(english.status()).toBe(200);

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('pages', id));
  await page.getByRole('button', { name: 'Français' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await page.getByRole('tab', { name: 'attributes' }).click();
  await expect(page.locator(TITLE)).toHaveValue('Page to import');

  await page.getByRole('button', { name: 'Actions du document' }).click();
  await page.getByRole('menuitem', { name: 'Importer les données depuis fr' }).click();
  await expect(page.locator(TITLE)).toHaveValue('Page à importer');

  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );
  await page.locator('button[data-submit]').click();
  expect((await saved).ok()).toBe(true);

  const { doc: en } = await request
    .get(`${API_BASE_URL}/pages/${id}?locale=en`, { headers })
    .then((r) => r.json());
  expect(en.attributes.title).toBe('Page à importer');
  expect(en.seo.metaTitle).toBe('Méta à importer');

  await request.delete(`${API_BASE_URL}/pages/${id}`, { headers });
});
