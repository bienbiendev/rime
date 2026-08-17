import { toKebabCase } from '$lib/util/string';
import test, { expect } from '@playwright/test';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

function panelUrl(...args: string[]) {
  if (!args.length) return `${process.env.PUBLIC_RIME_URL}/panel`;
  return `${process.env.PUBLIC_RIME_URL}/panel/${args.join('/')}`;
}

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

    await emailInput.pressSequentially(ADMIN_EMAIL, { delay: 100 });
    await passwordInput.pressSequentially(PASSWORD, { delay: 100 });

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

    await emailInput.pressSequentially('wrong@email.com', { delay: 100 });
    await passwordInput.pressSequentially('wrongpassword', { delay: 100 });

    await expect(submitButton).toBeEnabled();

    // Submit the form
    await submitButton.click();

    // Check for error message
    const errorMessage = page.locator('.rz-auth form .rz-field-root:first-of-type .rz-field-error');
    await expect(errorMessage).toBeVisible();
  });

  test('should not display forgot password link', async ({ page }) => {
    await page.goto(panelUrl('sign-in'));
    await expect(page.locator(`a[href="/forgot-password?slug=staff"]`)).toHaveCount(0);
  });
});

test.describe('Admin panel', () => {
  test('Should visit all collections', async ({ page }) => {
    // Navigate to the login page
    await page.goto(panelUrl('sign-in'));

    const submitButton = page.locator('button[type="submit"]');
    // Fill in the credentials
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    await emailInput.pressSequentially(ADMIN_EMAIL, { delay: 100 });
    await passwordInput.pressSequentially(PASSWORD, { delay: 100 });
    // Submit the form
    await submitButton.click();
    // Wait for navigation after login
    await page.waitForURL(panelUrl());

    const collections = [
      { slug: 'pages', singular: 'Page', plural: 'Pages' },
      { slug: 'medias', singular: 'Media', plural: 'Medias' },
      { slug: 'staff', singular: 'User', plural: 'Users' }
    ];

    for (const { slug, plural } of collections) {
      const navButton = page.locator(`a.rz-button-nav[href="${panelUrl(toKebabCase(slug))}"]`);
      expect(await navButton.innerText()).toBe(plural);

      const response = await page.goto(panelUrl(toKebabCase(slug)));
      expect(response?.status()).toBe(200);
      await page.waitForLoadState('networkidle');

      const suffix = slug === 'medias' ? `?uploadPath=root` : '';
      const href = `${panelUrl(toKebabCase(slug))}/create${suffix}`;
      const createButton = page.locator(`a[href="${href}"]`);

      await expect(createButton).toBeEnabled();
      await createButton.click();
      await page.waitForURL(href);
      await page.waitForLoadState('networkidle');

      const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
      await expect(saveButton).toBeDisabled();

      if (slug === 'pages') {
        const inputTitle = page.locator(`input.rz-input[name="attributes.title"]`);
        await inputTitle.pressSequentially('Home', { delay: 100 });
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await page.waitForLoadState('networkidle');

        const h1 = page.locator('.rz-page-header__row h1');
        expect(await h1.innerText()).toBe('Home');
      }

      if (slug === 'staff') {
        const inputTitle = page.locator(`input.rz-input[name="email"]`);
        const inputPassword = page.locator(`input.rz-input[name="password"]`);
        const inputConfirmPassword = page.locator(`input.rz-input[name="confirmPassword"]`);
        const inputName = page.locator(`input.rz-input[name="name"]`);

        await inputTitle.pressSequentially('user@email.com', { delay: 100 });
        await inputName.pressSequentially('User', { delay: 100 });
        await inputPassword.pressSequentially(PASSWORD, { delay: 100 });
        await inputConfirmPassword.pressSequentially(PASSWORD, { delay: 100 });

        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await page.waitForLoadState('networkidle');

        const h1 = page.locator('.rz-page-header__row h1');
        expect(await h1.innerText()).toBe('user@email.com');
      }
    }
  });
  test('Should visit all globals', async ({ page }) => {
    await page.goto(panelUrl('sign-in'));

    const submitButton = page.locator('button[type="submit"]');
    // Fill in the credentials
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    await emailInput.pressSequentially(ADMIN_EMAIL, { delay: 100 });
    await passwordInput.pressSequentially(PASSWORD, { delay: 100 });
    // Submit the form
    await submitButton.click();
    await page.waitForNavigation();

    const globals = [{ slug: 'settings', label: 'Settings' }];

    for (const { slug, label } of globals) {
      const navButton = page.locator(`a.rz-button-nav[href="${panelUrl(toKebabCase(slug))}"]`);
      expect(await navButton.innerText()).toBe(label);

      const response = await page.goto(panelUrl(toKebabCase(slug)));
      expect(response?.status()).toBe(200);

      const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
      await expect(saveButton).toBeDisabled();

      const maintenanceToggle = page.locator('.rz-field-label-for[for="settings_0-maintenance"]');
      await maintenanceToggle.click();

      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      await page.waitForLoadState('networkidle');

      const sonner = page.locator('[data-sonner-toast] [data-title]');
      expect(await sonner.innerText()).toContain('Document');
      await expect(saveButton).toBeDisabled();
    }

    await page.click('.rz-signout button');
    await page.waitForNavigation();
    expect(page.url()).toBe(panelUrl('sign-in'));
  });
});

test.describe('Layout tab: group + separator + blocks persistence', () => {
  // tab-layout.ts's exact shape — group('hero').fields(...), separator(),
  // blocks('sections', [...]) — is the real-world config that surfaced the
  // empty-name-key bug (separator() fields never got a name, so
  // reduceFieldsToBlankDocument stamped prev[''] = null next to hero/sections,
  // which corrupted the whole tab's data into looking array-like once
  // flattened/unflattened through a real form submission — see util/doc.ts).
  // This is a direct regression guard for that exact config shape, not the
  // synthetic one in tests/fields.
  test('Should persist hero group fields across the separator+blocks tab after save and reload', async ({
    page
  }) => {
    await page.goto(panelUrl('sign-in'));
    await page.locator('input[name="email"]').pressSequentially(ADMIN_EMAIL, {
      delay: 30
    });
    await page.locator('input[name="password"]').pressSequentially(PASSWORD, { delay: 30 });
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(panelUrl());

    await page.goto(panelUrl('pages', 'create'));
    await page.waitForLoadState('networkidle');

    await page.locator('.rz-tabs-trigger[data-value="attributes"]').click();
    await page
      .locator('input[name="attributes.title"]')
      .pressSequentially('Layout persistence test', { delay: 30 });

    await page.locator('.rz-tabs-trigger[data-value="layout"]').click();

    const heroTrigger = page.locator('.rz-group-field__trigger').filter({ hasText: 'Hero' });
    if ((await page.locator('input[name="layout.hero.title"]').count()) === 0) {
      await heroTrigger.click();
    }
    await page
      .locator('input[name="layout.hero.title"]')
      .pressSequentially('Hero title', { delay: 30 });
    await page
      .locator('input[name="layout.hero.intro"]')
      .pressSequentially('Hero intro', { delay: 30 });

    const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
    await saveButton.click();
    // Not just [^/]+$ — that also matches the create route itself.
    await page.waitForURL(/\/panel\/pages\/(?!create$)[^/]+$/);

    await page.reload();
    await page.waitForLoadState('networkidle');

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

test.describe('Live Edit', () => {
  test('Should go to Live Panel', async ({ page }) => {
    // Navigate to the login page
    await page.goto(panelUrl('sign-in'));

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();

    // Fill in the credentials
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    await emailInput.pressSequentially(ADMIN_EMAIL, { delay: 100 });
    await passwordInput.pressSequentially(PASSWORD, { delay: 100 });

    await expect(submitButton).toBeEnabled();

    // Submit the form
    await submitButton.click();

    // Wait for navigation after login
    await page.waitForNavigation();

    expect(page.url()).toBe(panelUrl());

    const response = await page.goto(panelUrl('pages', 'create'));
    expect(response?.status()).toBe(200);

    const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
    await expect(saveButton).toBeDisabled();

    const tabAttribute = page.locator('.rz-tabs-trigger[data-value="attributes"]');
    await tabAttribute.click();
    const inputTitle = page.locator(`input.rz-input[name="attributes.title"]`);
    await inputTitle.pressSequentially('Live test', { delay: 100 });

    const inputSlug = page.locator(`input.rz-input[name="attributes.slug"]`);
    await inputSlug.pressSequentially('live-test', { delay: 100 });

    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    const liveEditButton = page.locator('.rz-button-live');
    await liveEditButton.click();
    await page.waitForLoadState('networkidle');

    const liveContainer = page.locator('.rz-live-container');
    await expect(liveContainer).toBeVisible({ timeout: 5000 });
    expect(liveContainer).toHaveCount(1);
  });
});
