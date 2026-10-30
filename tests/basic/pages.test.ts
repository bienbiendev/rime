import { toKebabCase } from '#lib/util/string.js';
import test, { expect } from '@playwright/test';
import {
  API_BASE_URL,
  BASE_URL,
  loginAs,
  panelPath,
  panelUrl,
  panelUrlRe,
  signIn
} from '../util.js';

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

    expect(page.url()).toBe(panelUrl());
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

  test('should toast the error of a sign-in that throws on the server', async ({ page }) => {
    await page.goto(panelUrl('sign-in'));

    // The sign-in action throws: SvelteKit answers an `error` result
    await page.route(
      (url) => url.pathname === panelPath('sign-in'),
      (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            type: 'error',
            status: 500,
            error: { message: 'operation_error' }
          })
        }),
      { times: 1 }
    );

    await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    const sonner = page.locator('[data-sonner-toast] [data-title]');
    await expect(sonner).toHaveText('The operation failed');
  });

  test('should keep an invalid email in error while the password is typed', async ({ page }) => {
    await page.goto(panelUrl('sign-in'));

    const email = page.locator('input[name="email"]');
    await email.fill(ADMIN_EMAIL);
    await email.fill('a@b');
    await page.locator('input[name="password"]').fill(PASSWORD);

    const emailError = page.locator('.rz-auth form .rz-field-root:first-of-type .rz-field-error');
    await expect(emailError).toHaveText('Invalid email address');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should check a reset confirmation typed first once the password is typed', async ({
    page
  }) => {
    // The page renders with any token: the token is checked when the reset is sent
    await page.goto(`${panelUrl('reset-password')}?token=test`);

    const password = page.locator('input[name="password"]');
    const confirm = page.locator('input[name="confirmPassword"]');
    const reset = page.getByRole('button', { name: 'Reset password' });

    await confirm.fill('Secret-123!');
    await password.fill('Secret-123!');
    await expect(reset).toBeEnabled();

    await confirm.fill('Secret-124!');
    await expect(page.locator('.rz-field-error')).toHaveText('The passwords do not match');
    await expect(reset).toBeDisabled();
  });

  test('should ask for one reset mail from the forgot-password form', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/request-password-reset')) sent.push(request.url());
    });
    await page.goto(panelUrl('forgot-password'));

    await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
    const button = page.getByRole('button', { name: 'Request a password reset link' });
    await button.dblclick();

    await expect(page.getByText(`An email has been sent to ${ADMIN_EMAIL}`)).toBeVisible();
    expect(sent).toHaveLength(1);
  });

  test('should send the forgot-password form with Enter', async ({ page }) => {
    await page.goto(panelUrl('forgot-password'));
    await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[name="email"]').press('Enter');
    await expect(page.getByText(`An email has been sent to ${ADMIN_EMAIL}`)).toBeVisible();
  });

  test('should send the reset form with Enter, and say when its link is invalid', async ({
    page
  }) => {
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/reset-password')) sent.push(request.url());
    });
    await page.goto(`${panelUrl('reset-password')}?token=test`);

    await page.locator('input[name="password"]').fill('Secret-123!');
    await page.locator('input[name="confirmPassword"]').fill('Secret-123!');
    await page.locator('input[name="confirmPassword"]').press('Enter');

    const sonner = page.locator('[data-sonner-toast] [data-title]');
    await expect(sonner).toHaveText('This reset link is invalid or has expired');
    expect(sent).toHaveLength(1);
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

  test('The user menu links a path, on the origin the panel is on', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl());

    await page.click('button.rz-user');
    await expect(page.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', /^\//);
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
  // A group, a separator and a blocks field in one tab (tab-layout.ts): the group's values survive
  // a save through the form and a reload.
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

test.describe('Tabs without storage', () => {
  // Storage is blocked for the tabs' keys: each read and write throws a SecurityError.
  test('Should show the first tab, and change tabs without remembering them', async ({ page }) => {
    await page.addInitScript(() => {
      const blocked = (key: string) => {
        if (key.startsWith('rime.Tabs:')) throw new DOMException('Blocked', 'SecurityError');
      };
      const { getItem, setItem } = Storage.prototype;
      Storage.prototype.getItem = function (key) {
        blocked(key);
        return getItem.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        blocked(key);
        return setItem.call(this, key, value);
      };
    });
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl('pages', 'create'));

    await expect(page.locator('input[name="attributes.title"]')).toBeVisible();

    const layout = page.locator('.rz-tabs-trigger[data-value="layout"]');
    await layout.click();
    await expect(layout).toHaveAttribute('data-state', 'active');
    await expect(page.locator('input[name="attributes.title"]')).toBeHidden();
  });
});

test.describe('Password reset link', () => {
  test('Should wait for a staff email to be saved before sending it a reset link', async ({
    page,
    request
  }) => {
    const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
    const found = await request.get(`${API_BASE_URL}/staff?where[email][equals]=${ADMIN_EMAIL}`, {
      headers
    });
    const [admin] = (await found.json()).docs;

    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl('staff', admin.id));

    const email = page.locator('input[name="email"]');
    const send = page.getByRole('button', { name: 'Send a password reset link' });
    await expect(send).toBeEnabled();

    // The link would go to an address nobody saved
    await email.fill('new@site.com');
    await expect(send).toBeDisabled();

    await email.fill(ADMIN_EMAIL);
    await expect(send).toBeEnabled();
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
    // The icon-only copy button is named by its action
    await expect(dialog.getByRole('button', { name: 'Copy the API key' })).toBeVisible();

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

  test('Should create the api key once when ⌘S is pressed while its dialog is open', async ({
    page,
    request
  }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl('apps', 'create'));

    await page.locator('input.rz-input[name="name"]').fill('CI App saved twice');
    await page.locator('.rz-page-header__row button[type="submit"]').click();

    const dialog = page.locator('.rz-dialog-content');
    await expect(dialog).toBeVisible();
    // The redirect waits for the dialog: a second save must not start
    await page.keyboard.press('Control+s');

    await page.locator('.rz-dialog-footer button', { hasText: 'Close' }).click();
    await page.waitForURL(panelUrlRe('apps'));

    const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
    const response = await request.get(
      `${API_BASE_URL}/apps?where[name][equals]=${encodeURIComponent('CI App saved twice')}`,
      { headers }
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).docs).toHaveLength(1);
  });
});

test.describe('Change url', () => {
  test('Should show and link the new address once the url is changed, with no reload', async ({
    page,
    request
  }) => {
    const stamp = Date.now();
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers: await signIn(ADMIN_EMAIL, PASSWORD)(request),
      data: { attributes: { title: 'Change url', slug: `change-url-${stamp}` } }
    });
    expect(response.status()).toBe(200);
    const id = (await response.json()).doc.id as string;

    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await page.goto(panelUrl('pages', id));

    const next = `new-url-${stamp}`;
    await page.locator('.rz-document-url').getByRole('button', { name: 'Change url' }).click();
    const dialog = page.locator('.rz-dialog-content');
    await dialog.locator('#rz-change-slug-input').fill(next);
    await dialog.getByRole('button', { name: 'Change url' }).click();
    await expect(page.getByText('Url changed')).toBeVisible();

    // The url line, "View page" and the live-edit link read the new address
    const host = BASE_URL.replace(/^https?:\/\//, '');
    await expect(page.locator('.rz-document-url__text')).toHaveText(`${host}/${next}`);
    await expect(page.locator('.rz-document-actions__open')).toHaveAttribute(
      'href',
      new RegExp(`/${next}(\\?|$)`)
    );
    await expect(page.locator('.rz-button-live')).toHaveAttribute(
      'href',
      new RegExp(encodeURIComponent(`/${next}`))
    );

    // The dialog opens on the new slug
    await page.locator('.rz-document-url').getByRole('button', { name: 'Change url' }).click();
    await expect(dialog.locator('#rz-change-slug-input')).toHaveValue(next);
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
    await inputTitle.fill('Live');

    // The slug follows the title until one is typed in it
    const inputSlug = page.locator(`input.rz-input[name="attributes.slug"]`);
    await expect(inputSlug).toHaveValue('live');
    await inputSlug.fill('');
    await inputSlug.pressSequentially('welcome', { delay: 30 });
    await inputTitle.pressSequentially(' test', { delay: 30 });
    await expect(inputTitle).toHaveValue('Live test');
    await expect(inputSlug).toHaveValue('welcome');

    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForURL(panelUrlRe('pages'));

    // The icon-only live button is named by its action
    const liveEditButton = page.getByRole('link', { name: 'Live edit' });
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

/**
 * A media opened from outside its folder, as a relation's link or the dashboard opens it, shows
 * its own folder, and a save leaves it there.
 */
test('A media opened without its folder in the URL stays in its folder when saved', async ({
  page,
  request
}) => {
  const headers = await signIn(ADMIN_EMAIL, PASSWORD)(request);
  const run = Date.now();
  const folder = `news-${run}`;
  const payload = Buffer.from(`in-${folder}`).toString('base64');
  const created = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: {
      file: { base64: `data:text/plain;base64,${payload}`, filename: `${folder}.txt` },
      alt: 'before',
      _path: `root:${folder}`
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(`${panelUrl('medias')}/${doc.id}?uploadPath=root`);
  await expect(page.locator('.rz-aria__link', { hasText: folder })).toBeVisible();

  const alt = page.locator('input.rz-input[name="alt"]');
  await alt.fill('after');
  const saveButton = page.locator('.rz-page-header__row button[type="submit"]');
  await expect(saveButton).toBeEnabled();
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes(doc.id)
  );
  await saveButton.click();
  expect((await saved).status()).toBe(200);

  const read = await request.get(`${API_BASE_URL}/medias/${doc.id}`, { headers });
  const stored = (await read.json()).doc;
  expect(stored.alt).toBe('after');
  expect(stored._path).toBe(`root:${folder}`);
});

/** A folder that does not exist sends back to the root, and a browser keeps no cached redirect. */
test('An unknown upload folder redirects to the root with a 302', async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  const response = await page.request.get(`${panelUrl('medias')}?uploadPath=root:missing`, {
    maxRedirects: 0
  });
  expect(response.status()).toBe(302);
  expect(new URL(response.headers()['location'], BASE_URL).pathname).toBe(panelPath('medias'));
});
