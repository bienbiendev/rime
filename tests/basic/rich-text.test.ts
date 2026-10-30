import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

test.use({ viewport: { width: 1600, height: 900 } });

/**
 * The media node of `news.writer.text`: what it shows follows the node, so an undo shows the
 * media back.
 */

test('A removed media shows again on undo', async ({ page, request }) => {
  const headers = await signInSuperAdmin(request);
  const run = Date.now();

  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: {
      file: {
        base64: await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg')),
        filename: `rich-text-undo-${run}.jpg`
      },
      alt: 'rich text undo'
    }
  });
  expect(uploaded.status()).toBe(200);
  const media = (await uploaded.json()).doc;

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: `Rich text undo ${run}`, slug: `rich-text-undo-${run}` },
      writer: {
        text: {
          type: 'doc',
          content: [{ type: 'rich-text-upload-medias', attrs: { id: media.id } }]
        }
      }
    }
  });
  expect(created.status()).toBe(200);
  const news = (await created.json()).doc;

  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('news', news.id));
  await page.locator('.rz-tabs-trigger[data-value="writer"]').click();

  const image = page.locator('.rz-richtext-media__media img');
  await expect(image).toBeVisible();

  // A click selects the node, which shows its remove button
  await image.click();
  await page.locator('.rz-richtext-media__button-remove').click();
  await expect(page.locator('.rz-richtext-media__add')).toBeVisible();
  await expect(image).toHaveCount(0);

  await page.locator('fieldset[data-path="writer.text"] .ProseMirror').focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(image).toBeVisible();
  await expect(page.locator('.rz-richtext-media__add')).toHaveCount(0);

  await request.delete(`${API_BASE_URL}/news/${news.id}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${media.id}`, { headers });
});
