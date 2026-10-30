import test, { expect } from '@playwright/test';
import { API_BASE_URL, BASE_URL, PANEL_SEGMENT, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Live edit of the `infos` area, whose about page renders `instagram` through `<LiveConsumer>`.
 *
 * The page opens the area's form beside it; what is typed shows in the page before any save.
 */

// The tests run in order and share the live link the first one reads: one failure skips the rest.
test.describe.configure({ mode: 'serial' });

let live: string;

test('Should give infos a live edit link', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const updated = await request.patch(`${API_BASE_URL}/infos?locale=fr`, {
    headers,
    data: { email: 'live@email.com', instagram: 'instagram-avant' }
  });
  expect(updated.status()).toBe(200);

  const read = await request.get(`${API_BASE_URL}/infos?locale=fr`, { headers });
  expect(read.status()).toBe(200);
  live = (await read.json()).doc._live;
  expect(live).toContain(`${panelUrl('live-edit')}?`);
});

test('LiveConsumer shows what is typed before it is saved', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(live);

  const frame = page.frameLocator('iframe[title="edit"]');
  await expect(frame.locator('body')).toContainText('instagram-avant');

  // LiveConsumer opens the area's form
  const instagram = page.locator('input[name="instagram"]');
  await expect(instagram).toHaveValue('instagram-avant');
  await instagram.fill('instagram-apres');

  await expect(frame.locator('body')).toContainText('instagram-apres');
});

test('The close button of an area lands on the area page', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(live);
  await expect(page.locator('input[name="instagram"]')).toBeVisible();

  // The first click closes the form, the second leaves live edit
  const close = page.locator('.rz-live-floating-ui button').first();
  await close.click();
  await expect(page.locator('input[name="instagram"]')).toHaveCount(0);
  await close.click();

  await page.waitForURL(panelUrl('infos'));
});

test('A panel whose document cannot be read toasts an error', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  // The panel's read of infos is refused
  await page.route(
    (url) => url.pathname === new URL(`${API_BASE_URL}/infos`).pathname,
    (route) => route.fulfill({ status: 403, json: { error: 'unauthorized' } })
  );
  await page.goto(live);

  // The panel speaks French
  const sonner = page.locator('[data-sonner-toast] [data-title]');
  await expect(sonner).toHaveText('Une erreur est survenue');
  await expect(page.locator('input[name="instagram"]')).toHaveCount(0);
});

test('The live page stops listening to the preview once it is left', async ({ page }) => {
  // The window's `message` listeners, kept in `window.messageListeners`
  await page.addInitScript(() => {
    const listeners = new Set<unknown>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = (...args: Parameters<typeof add>) => {
      if (args[0] === 'message') listeners.add(args[1]);
      add(...args);
    };
    window.removeEventListener = (...args: Parameters<typeof remove>) => {
      if (args[0] === 'message') listeners.delete(args[1]);
      remove(...args);
    };
    Object.assign(window, { messageListeners: listeners });
  });
  const countListeners = () =>
    page.evaluate(
      () => (window as unknown as { messageListeners: Set<unknown> }).messageListeners.size
    );

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(live);
  await expect(page.locator('input[name="instagram"]')).toBeVisible();
  const before = await countListeners();

  // Leave live edit for the area page, then come back, both without a reload
  const close = page.locator('.rz-live-floating-ui button').first();
  await close.click();
  await expect(page.locator('input[name="instagram"]')).toHaveCount(0);
  await close.click();
  await page.waitForURL(panelUrl('infos'));
  await page.goBack();
  await expect(page.locator('input[name="instagram"]')).toBeVisible();

  expect(await countListeners()).toBe(before);
});

/**
 * The live link names its locale: the save writes that row, whatever locale the panel cookie
 * holds. `instagram` is not localized, so the request is what tells which locale was written;
 * the read after it tells that the save landed.
 */
test('A live save writes the locale of the live link', async ({ page, request }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.context().addCookies([
    {
      name: 'rime.locale',
      value: 'en',
      domain: new URL(BASE_URL).hostname,
      path: `/${PANEL_SEGMENT}`
    }
  ]);
  await page.goto(live);
  expect(new URL(live).searchParams.get('locale')).toBe('fr');

  await page.locator('input[name="instagram"]').fill('instagram-live');
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/update')
  );
  await page.locator('.rz-live-floating-ui__save').click();
  const response = await saved;
  expect(new URL(response.url()).searchParams.get('locale')).toBe('fr');
  expect(response.ok()).toBe(true);

  const { doc } = await request.get(`${API_BASE_URL}/infos?locale=fr`).then((r) => r.json());
  expect(doc.instagram).toBe('instagram-live');
});

/**
 * A page's front holds its own `LiveEdit`, then a `LiveConsumer` of `infos`: both open their panel
 * on mount. The page's form is the one on top, and the root button's, whichever read answers last.
 */
for (const slow of ['page', 'infos'] as const) {
  test(`A page's live link opens the page's form above the area's, the ${slow} read answering last`, async ({
    page,
    request
  }) => {
    const headers = await signInSuperAdmin(request);
    const created = await request.post(`${API_BASE_URL}/pages?locale=fr`, {
      headers,
      data: { attributes: { title: 'Pile live', slug: `pile-live-${slow}-${Date.now()}` } }
    });
    expect(created.status()).toBe(200);
    const { id } = (await created.json()).doc;
    const read = await request.get(`${API_BASE_URL}/pages/${id}?locale=fr`, { headers });
    const pageLive = (await read.json()).doc._live;

    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    const slowPath = new URL(
      slow === 'page' ? `${API_BASE_URL}/pages/${id}` : `${API_BASE_URL}/infos`
    ).pathname;
    await page.route(
      (url) => url.pathname === slowPath,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      }
    );
    await page.goto(pageLive);

    // The page's form is open, its tabs on screen, and the area's form is under it
    const pageTabs = page.getByRole('tab', { name: 'attributes' });
    const instagram = page.locator('input[name="instagram"]');
    await expect(pageTabs).toBeVisible();
    await expect(instagram).toHaveCount(0);
    await pageTabs.click();
    await expect(page.locator('input[name="attributes.title"]')).toHaveValue('Pile live');

    // The root button closes the page's form, showing the area's, then opens the page's again
    const root = page.getByRole('button', { name: 'Formulaire du document' });
    await root.click();
    await expect(pageTabs).toHaveCount(0);
    await expect(instagram).toBeVisible();
    await root.click();
    await expect(pageTabs).toBeVisible();
  });
}
