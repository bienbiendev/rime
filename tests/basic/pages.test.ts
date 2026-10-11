import { toKebabCase } from '#lib/util/string.js';
import test, { expect } from '@playwright/test';
import { API_BASE_URL, loginAs, panelPath, panelUrl, panelUrlRe } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

test.describe('Login form', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    // Navigate to the login page
    await page.goto(panelUrl('sign-in'));
    await page.waitForLoadState();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();

    // Fill in the credentials
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(PASSWORD);

    await expect(submitButton).toBeEnabled();

    // Submit the form
    await submitButton.click();

    // Wait for navigation after login
    await page.waitForURL(panelUrl());

    // Add assertions based on successful login
    // For example, check if redirected to dashboard or check for success message
    expect(page.url()).toBe(panelUrl()); // Adjust URL based on your app
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto(panelUrl('sign-in'));

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();

    // Fill in the credentials
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await emailInput.fill('wrong@email.com');
    await passwordInput.fill('wrongpassword');

    await expect(submitButton).toBeEnabled();

    // Submit the form
    await submitButton.click();

    // The message the sign-in shows on the email field for a wrong account
    const errorMessage = page.locator('.rz-auth form .rz-field-root:first-of-type .rz-field-error');
    await expect(errorMessage).toHaveText('Invalid credentials');
  });

  // basic sets `$smtp`, so the panel can send a reset mail
  test('should display the forgot password link when mail is configured', async ({ page }) => {
    await page.goto(panelUrl('sign-in'));
    await expect(page.locator(`a[href="${panelUrl('forgot-password')}"]`)).toBeVisible();
  });

  test('should send a signed-in visitor of the sign-in page to the panel', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);

    await page.goto(panelUrl('sign-in'));
    await page.waitForURL(panelUrl());
    expect(page.url()).toBe(panelUrl());
  });
});

test.describe('Admin panel', () => {
  test('Should visit all collections', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl());

    const collections = [
      { slug: 'pages', singular: 'Page', plural: 'Pages' },
      { slug: 'medias', singular: 'Media', plural: 'Medias' },
      { slug: 'staff', singular: 'User', plural: 'Users' }
    ];

    for (const { slug, plural } of collections) {
      const navButton = page.locator(`a.rz-nav-item[href="${panelPath(toKebabCase(slug))}"]`);
      expect(await navButton.innerText()).toBe(plural);

      const response = await page.goto(panelUrl(toKebabCase(slug)));
      expect(response?.status()).toBe(200);

      const suffix = slug === 'medias' ? `?uploadPath=root` : '';
      // The panel renders a path; waitForURL compares against the resolved location.
      const href = `${panelPath(toKebabCase(slug))}/create${suffix}`;
      if (slug === 'medias') {
        // An upload collection creates through its Upload button: the form is reached by url.
        await page.goto(`${panelUrl(toKebabCase(slug))}/create${suffix}`);
      } else {
        const createButton = page.locator(`a[href="${href}"]`);
        await expect(createButton).toBeEnabled();
        await createButton.click();
      }
      await page.waitForURL(`${panelUrl(toKebabCase(slug))}/create${suffix}`);

      const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
      await expect(saveButton).toBeDisabled();

      if (slug === 'pages') {
        const inputTitle = page.locator(`input.rz-input[name="attributes.title"]`);
        await inputTitle.fill('Home');
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        // The breadcrumb follows the typing, so the saved document's url is the proof of the save
        await page.waitForURL(panelUrlRe('pages'));

        // A document's header has no title of its own; the breadcrumb names it.
        await expect(page.locator('.rz-aria__last')).toHaveText('Home');
      }

      if (slug === 'staff') {
        const inputTitle = page.locator(`input.rz-input[name="email"]`);
        const inputPassword = page.locator(`input.rz-input[name="password"]`);
        const inputConfirmPassword = page.locator(`input.rz-input[name="confirmPassword"]`);
        const inputName = page.locator(`input.rz-input[name="name"]`);

        await inputTitle.fill('user@email.com');
        await inputName.fill('User');
        await inputPassword.fill(PASSWORD);
        await inputConfirmPassword.fill(PASSWORD);

        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await page.waitForURL(panelUrlRe('staff'));

        await expect(page.locator('.rz-aria__last')).toHaveText('user@email.com');
      }
    }
  });
  test('Should visit all globals', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl());

    const globals = [{ slug: 'settings', label: 'Settings' }];

    /** The stored `maintenance`, read with the panel's session. */
    const maintenance = async () =>
      (await page.request.get(`${API_BASE_URL}/settings`).then((r) => r.json())).doc.maintenance;

    for (const { slug, label } of globals) {
      const navButton = page.locator(`a.rz-nav-item[href="${panelPath(toKebabCase(slug))}"]`);
      expect(await navButton.innerText()).toBe(label);

      const response = await page.goto(panelUrl(toKebabCase(slug)));
      expect(response?.status()).toBe(200);

      const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
      await expect(saveButton).toBeDisabled();

      const before = await maintenance();
      const maintenanceToggle = page.locator('.rz-field-label-for[for="settings_0-maintenance"]');
      await maintenanceToggle.click();

      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      const sonner = page.locator('[data-sonner-toast] [data-title]');
      await expect(sonner).toHaveText('Document updated');
      await expect(saveButton).toBeDisabled();
      expect(await maintenance()).toBe(!before);
    }

    await page.click('button.rz-user');
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForURL(panelUrl('sign-in'));
    expect(page.url()).toBe(panelUrl('sign-in'));
  });

  test('Should show the page a nav link leads to on the first click', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl());

    // Collection to collection, area to area, and across: each is a client-side navigation.
    const stops = [
      { slug: 'pages', label: 'Pages' },
      { slug: 'medias', label: 'Medias' },
      { slug: 'settings', label: 'Settings' },
      { slug: 'navigation', label: 'Navigation' },
      { slug: 'pages', label: 'Pages' }
    ];

    for (const { slug, label } of stops) {
      await page.locator(`a.rz-nav-item[href="${panelPath(slug)}"]`).click();
      await page.waitForURL(panelUrl(slug));
      await expect(page.locator('.rz-aria__last')).toHaveText(label);
    }
  });
});

test.describe('Layout tab: group + separator + blocks persistence', () => {
  // tab-layout.ts's exact shape — group('hero').fields(...), separator(),
  // blocks('sections', [...]) — is the real-world config that surfaced the
  // empty-name-key bug (separator() fields never got a name, so
  // reduceFieldsToBlankDocument stamped prev[''] = null next to hero/sections,
  // which corrupted the whole tab's data into looking array-like once
  // flattened/unflattened through a real form submission — see core/prototype/doc.ts).
  // This is a direct regression guard for that exact config shape, not the
  // synthetic one in tests/fields.
  test('Should persist hero group fields across the separator+blocks tab after save and reload', async ({
    page
  }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);

    await page.goto(panelUrl('pages', 'create'));

    await page.locator('.rz-tabs-trigger[data-value="attributes"]').click();
    await page.locator('input[name="attributes.title"]').fill('Layout persistence test');

    await page.locator('.rz-tabs-trigger[data-value="layout"]').click();

    const heroTrigger = page.locator('.rz-group-field__trigger').filter({ hasText: 'Hero' });
    if ((await page.locator('input[name="layout.hero.title"]').count()) === 0) {
      await heroTrigger.click();
    }
    await page.locator('input[name="layout.hero.title"]').fill('Hero title');
    await page.locator('input[name="layout.hero.intro"]').fill('Hero intro');

    const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
    await saveButton.click();
    await page.waitForURL(panelUrlRe('pages'));

    await page.reload();

    await page.locator('.rz-tabs-trigger[data-value="attributes"]').click();
    await expect(page.locator('input[name="attributes.title"]')).toHaveValue(
      'Layout persistence test'
    );

    await page.locator('.rz-tabs-trigger[data-value="layout"]').click();
    if ((await page.locator('input[name="layout.hero.title"]').count()) === 0) {
      await page.locator('.rz-group-field__trigger').filter({ hasText: 'Hero' }).click();
    }
    await expect(page.locator('input[name="layout.hero.title"]')).toHaveValue('Hero title');
    await expect(page.locator('input[name="layout.hero.intro"]')).toHaveValue('Hero intro');
  });
});

test.describe('API Key dialog', () => {
  test('Should show the api key once on creation, block the redirect until closed, then never show it again', async ({
    page
  }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);

    await page.goto(panelUrl('apps', 'create'));

    const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
    await expect(saveButton).toBeDisabled();

    await page.locator('input.rz-input[name="name"]').fill('CI App');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // The key dialog shows the plaintext key exactly once
    const dialog = page.locator('.rz-dialog-content');
    await expect(dialog).toBeVisible();
    const keyText = (await page.locator('.rz-dialog-api__key').innerText()).trim();
    expect(keyText.length).toBeGreaterThan(0);

    // Redirect is held back while the dialog is open — still on the create route
    expect(page.url()).toBe(panelUrl('apps', 'create'));

    await page.locator('.rz-dialog-footer button', { hasText: 'Close' }).click();
    await expect(dialog).not.toBeVisible();

    // Closing the dialog releases the redirect to the created document
    await page.waitForURL(panelUrlRe('apps'));

    // Reloading the created document never shows the key again
    await page.reload();
    // The document is on screen, and no dialog with it
    await expect(page.locator('input.rz-input[name="name"]')).toHaveValue('CI App');
    await expect(page.locator('.rz-dialog-content')).toHaveCount(0);
    await expect(page.getByText(keyText)).toHaveCount(0);
  });
});

test.describe('Live Edit', () => {
  test('Should go to Live Panel', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);

    const response = await page.goto(panelUrl('pages', 'create'));
    expect(response?.status()).toBe(200);

    const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
    await expect(saveButton).toBeDisabled();

    const tabAttribute = page.locator('.rz-tabs-trigger[data-value="attributes"]');
    await tabAttribute.click();
    const inputTitle = page.locator(`input.rz-input[name="attributes.title"]`);
    await inputTitle.fill('Live test');

    const inputSlug = page.locator(`input.rz-input[name="attributes.slug"]`);
    await inputSlug.fill('live-test');

    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForURL(panelUrlRe('pages'));

    const liveEditButton = page.locator('.rz-button-live');
    await liveEditButton.click();
    await page.waitForURL((url) => url.pathname === panelPath('live-edit'));

    const liveContainer = page.locator('.rz-live-container');
    await expect(liveContainer).toBeVisible({ timeout: 5000 });
    await expect(liveContainer).toHaveCount(1);

    // The iframe renders the page being edited
    const frame = page.frameLocator('iframe[title="edit"]');
    await expect(frame.locator('h1')).toHaveText('Live test');
  });
});
