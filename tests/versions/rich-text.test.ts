import { PARAMS } from '#lib/core/constants.js';
import {
  AUTO_SAVE_DELAY_MS,
  VERSIONS_STATUS
} from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect } from '@playwright/test';
import { API_BASE_URL, BASE_URL, loginAs, panelUrl, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Rich text that holds what the field cannot edit: `news.writer.text` offers bold, italic, upload,
 * headings and links, and gets a horizontal rule and a struck word. The site still renders all of
 * it, and the panel opens it read-only instead of saving an empty document over it.
 */

// The tests share the news the first one creates: one failing skips the rest
test.describe.configure({ mode: 'serial' });

const text = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'line one' },
        { type: 'hardBreak' },
        { type: 'text', text: 'line two' }
      ]
    },
    { type: 'horizontalRule' },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'old price', marks: [{ type: 'strike' }] }]
    }
  ]
};

let newsId: string;

test('Should create a published news with a break, a rule and a struck word', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/news`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: { title: 'Rich text kept', slug: 'rich-text-kept' },
      writer: { text },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(response.status()).toBe(200);
  newsId = (await response.json()).doc.id;
});

test('The site renders the break, the rule and the struck word', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/news/rich-text-kept`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toMatch(/line one(<!--[^>]*-->)*<br\s*\/?>/);
  expect(html).toMatch(/<hr\s*\/?>/);
  // In a rendered paragraph, not only in the load data serialized into the page
  expect(html).toMatch(/<p[^>]*>(<!--[^>]*-->)*old price/);
});

test('The panel opens that text read-only, naming what it cannot edit', async ({
  page,
  request
}) => {
  await loginAs(page, ADMIN_EMAIL, PASSWORD);
  await page.goto(panelUrl('news', newsId));
  await page.locator('.rz-tabs-trigger[data-value="writer"]').click();

  const notice = page.locator('.rz-rich-text__unsupported');
  await expect(notice).toContainText('horizontalRule');
  await expect(notice).toContainText('strike');
  const editor = page.locator(
    '.rz-rich-text__editor-wrapper:has(.rz-rich-text__unsupported) .ProseMirror'
  );
  await expect(editor).toHaveAttribute('contenteditable', 'false');

  // The stored value is untouched
  const headers = await signInSuperAdmin(request);
  const response = await request.get(`${API_BASE_URL}/news/${newsId}`, { headers });
  expect((await response.json()).doc.writer.text).toEqual(text);

  // And nothing was auto-saved over it: past the auto-save delay, the news has no auto-saved row
  await page.waitForTimeout(AUTO_SAVE_DELAY_MS * 2);
  const versions = await request.get(
    `${API_BASE_URL}/news--versions?where[ownerId][equals]=${newsId}`,
    { headers }
  );
  expect(versions.status()).toBe(200);
  const { docs } = await versions.json();
  expect(docs.filter((row: { isAutoSave: boolean }) => row.isAutoSave)).toEqual([]);
});

/**
 * An upload node names the media it shows in `attrs.id`. A new version writes its rows anew,
 * without their ids: the ids inside a rich-text value stay.
 */
test('A new version keeps the media an upload node points at', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const withUpload = {
    type: 'doc',
    content: [
      { type: 'upload', attrs: { id: 'media-in-text', title: 'Landscape' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'below the image' }] }
    ]
  };

  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Upload node kept', slug: 'upload-node-kept' },
      writer: { text: withUpload },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  const forked = await request.patch(`${API_BASE_URL}/news/${doc.id}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Upload node kept, again' } }
  });
  expect(forked.status()).toBe(200);
  expect((await forked.json()).doc.versionId).not.toBe(doc.versionId);

  const latest = await request.get(`${API_BASE_URL}/news/${doc.id}?${PARAMS.LATEST}=true`, {
    headers
  });
  const { doc: draft } = await latest.json();
  expect(draft.attributes.title).toBe('Upload node kept, again');
  expect(draft.writer.text).toEqual(withUpload);

  await request.delete(`${API_BASE_URL}/news/${doc.id}`, { headers });
});
