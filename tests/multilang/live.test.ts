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
