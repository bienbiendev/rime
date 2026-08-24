import test, { expect } from '@playwright/test';

// Exercises tests/consumer/+rime/rime.config.ts, which local-pack-test.sh swaps in over the
// plain rime-init config once the dev server is already running (see [5b/13] in that script)
// to also prove the file-watcher's live regeneration path, not just a fresh startup. Both
// @bienbien/rime-consumer-plugin and @bienbien/rime-consumer-field are real, separately
// packed npm packages installed into the scaffolded app — this is the one place their
// $rime/<own-name> self-referencing resolution (see stripOwnPackagePrefix in
// core/dev/generate/runtime/index.server.ts) gets exercised as an *installed* dependency
// rather than a package's own dev sandbox.

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const SUFFIX = process.env.CONSUMER_TEST_SUFFIX || 'run';

function panelUrl(...args: string[]) {
  const base = process.env.PUBLIC_RIME_URL;
  return args.length ? `${base}/panel/${args.join('/')}` : `${base}/panel`;
}

test.beforeAll(async ({ request }) => {
  const initResponse = await request.post(`${process.env.PUBLIC_RIME_URL}/api/init`, {
    data: { email: ADMIN_EMAIL, name: 'Admin User', password: PASSWORD }
  });
  if (![200, 404].includes(initResponse.status())) {
    throw new Error(`Unexpected /api/init status: ${initResponse.status()}`);
  }
});

test('plugin route, handler, field and hook all mounted correctly', async ({ page, request }) => {
  // Route + handler: registered before any sign-in is needed.
  const ping = await request.get(`${process.env.PUBLIC_RIME_URL}/api/consumer-plugin/ping`);
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
  await expect(nav.locator(`a[href="${panelUrl('pluginVisits')}"]`)).toBeVisible();

  // Field injection + field's own server hook: create a page with the third-party
  // `consumerField` filled in, and the plugin's `consumerPluginNote` field also present.
  await nav.locator(`a[href="${panelUrl('pages')}"]`).click();
  await page.waitForLoadState('networkidle');
  await page.locator(`a[href^="${panelUrl('pages', 'create')}"]`).click();
  await page.waitForLoadState('networkidle');

  const title = `Consumer plugin test ${SUFFIX}`;
  await page.locator('input.rz-input[name="title"]').pressSequentially(title, { delay: 50 });
  await expect(page.locator('input.rz-input[name="consumerPluginNote"]')).toBeVisible();
  await page.locator('input.rz-input[name="note"]').pressSequentially('hello', { delay: 50 });

  const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForURL(/\/panel\/pages\/(?!create$)[^/]+$/);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-page-header__row h1')).toHaveText(title);

  // module.server.ts's normalizeValue ran server-side, not the module.ts client no-op —
  // the saved+reloaded value carries its prefix.
  await expect(page.locator('input.rz-input[name="note"]')).toHaveValue('server:hello');

  // Collection hook: the plugin's afterUpdate hook only fires on update, not the initial
  // create above — save again to trigger it, then confirm it wrote a pluginVisits document.
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForLoadState('networkidle');

  await nav.locator(`a[href="${panelUrl('pluginVisits')}"]`).click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.rz-list-row').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});
