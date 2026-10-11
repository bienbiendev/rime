import test, { expect } from '@playwright/test';
import { BASE_URL, panelUrl, panelUrlRe, panelPath } from '../util.js';

// Exercises tests/consumer/lib/+rime/rime.config.server.ts, which local-pack-test.sh copies
// into place *before* `rime init` runs (see copy_plugin_config in that script), so init's own
// cold-start generate() mounts the plugin+field for real - not a live dev-server hot-reload.
// Both @bienbien/rime-consumer-plugin and @bienbien/rime-consumer-field are real, separately
// packed npm packages installed into the scaffolded app — this is the one place their
// $rime/modules resolution (see findInstalledPackageRoot in
// core/dev/codegen/runtime/index.server.ts) gets exercised as an *installed* dependency
// rather than a package's own dev sandbox.

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const SUFFIX = process.env.CONSUMER_TEST_SUFFIX || 'run';

test.beforeAll(async ({ request }) => {
  const initResponse = await request.post(`${BASE_URL}/api/init`, {
    data: { email: ADMIN_EMAIL, name: 'Admin User', password: PASSWORD }
  });
  if (![200, 404].includes(initResponse.status())) {
    throw new Error(`Unexpected /api/init status: ${initResponse.status()}`);
  }
});

test('plugin route, handler, field and hook all mounted correctly', async ({ page, request }) => {
  // Route + handler: registered before any sign-in is needed.
  const ping = await request.get(`${BASE_URL}/api/consumer-plugin/ping`);
  expect(ping.ok()).toBe(true);
  expect(await ping.json()).toEqual({ message: 'pong' });
  expect(ping.headers()['x-consumer-plugin']).toBe('active');

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await page.goto(panelUrl('sign-in'));
  await page.waitForLoadState();
  await page.locator('input[name="email"]').pressSequentially(ADMIN_EMAIL, { delay: 50 });
  await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 50 });
  const signInButton = page.locator('button[type="submit"]');
  await expect(signInButton).toBeEnabled();
  await signInButton.click();
  await page.waitForURL(panelUrl());

  // Header component: the plugin's HeaderButton (PlugZapIcon) — only rendered on the
  // dashboard (see Dashboard.svelte's topRight snippet), which is where sign-in just landed.
  await expect(page.locator('.rz-dashboard button:has(svg.lucide-plug-zap)')).toBeVisible();

  const nav = page.locator('.rz-nav__nav');

  // Collection injection: the plugin's own `pluginVisits` collection shows up in the nav
  // exactly like a consumer-authored one.
  await expect(nav.locator(`a[href="${panelPath('plugin-visits')}"]`)).toBeVisible();

  // Field injection + field's own server hook: create a page with the third-party
  // `consumerField` filled in, and the plugin's `consumerPluginNote` field also present.
  await nav.locator(`a[href="${panelPath('pages')}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href^="${panelPath('pages', 'create')}"]`).click();
  await page.waitForLoadState('networkidle');

  const title = `Consumer plugin test ${SUFFIX}`;
  await page.locator('input.rz-input[name="title"]').pressSequentially(title, { delay: 50 });
  await expect(page.locator('input.rz-input[name="consumerPluginNote"]')).toBeVisible();
  await page.locator('input.rz-input[name="note"]').pressSequentially('hello', { delay: 50 });

  const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForURL(panelUrlRe('pages'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-aria__last')).toHaveText(title);

  // module.server.ts's normalizeValue ran server-side, not the module.ts client no-op —
  // the saved+reloaded value carries its prefix.
  await expect(page.locator('input.rz-input[name="note"]')).toHaveValue('server:hello');

  // Collection hook: the plugin's afterUpdate hook only fires on update, not the initial
  // create above — save again to trigger it, then confirm it wrote a pluginVisits document.
  // Save is disabled on a pristine form, so dirty it first. The saved note carries a second
  // prefix, which tells the save has landed before the nav link is clicked.
  // The prod pass runs on the dev pass's database, so the rows are counted before the save:
  // only one more row proves the hook fired in this pass.
  /** The pluginVisits documents, read with the panel's session. */
  const visits = async (): Promise<{ id: string; title: string }[]> =>
    (await page.request.get(`${BASE_URL}/api/plugin-visits`).then((r) => r.json())).docs;
  const before = (await visits()).map((visit) => visit.id);

  await page.locator('input.rz-input[name="note"]').pressSequentially('!', { delay: 50 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(page.locator('input.rz-input[name="note"]')).toHaveValue(/server:.*server:/);

  await expect.poll(async () => (await visits()).length).toBe(before.length + 1);
  const visit = (await visits()).find((doc) => !before.includes(doc.id))!;
  const visitTitle = visit.title;

  // The list shows the row the hook just wrote
  await nav.locator(`a[href="${panelPath('plugin-visits')}"]`).click();
  await page.waitForLoadState('networkidle');
  await expect(
    page.locator(`.rz-list-row__title[href="${panelPath('plugin-visits', visit.id)}"]`)
  ).toHaveText(visitTitle);

  expect(pageErrors).toEqual([]);
});

// The cache plugin, on through RIME_CACHE_ENABLED, takes the anonymous requests under /cache
// (`$cache.isEnabled` in the config). A route's own cache-control is kept; a route with none
// gets private, max-age=3600.
test('the cache plugin keeps a route’s own cache-control and fills in one that has none', async ({
  request
}) => {
  const own = await request.get(`${BASE_URL}/cache/own`);
  expect(own.status()).toBe(200);
  expect(own.headers()['cache-control']).toBe('max-age=60');

  const endpoint = await request.get(`${BASE_URL}/cache/endpoint`);
  expect(endpoint.status()).toBe(200);
  expect(endpoint.headers()['cache-control']).toBe('no-store');

  const none = await request.get(`${BASE_URL}/cache/none`);
  expect(none.status()).toBe(200);
  expect(none.headers()['cache-control']).toBe('private, max-age=3600');

  // Outside /cache, `isEnabled` says no
  const front = await request.get(`${BASE_URL}/`);
  expect(front.headers()['cache-control']).not.toBe('private, max-age=3600');
});
