import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * An image in rich text follows its media: `news.writer.text` stores the node's id, and a read
 * fills the rest from the media as it is now.
 */

test('An upload node saved with its id alone reads the url of its media', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const run = Date.now();

  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: {
      file: {
        base64: await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg')),
        filename: `rich-text-media-${run}.jpg`
      },
      alt: 'rich text media'
    }
  });
  expect(uploaded.status()).toBe(200);
  const media = (await uploaded.json()).doc;

  const text = {
    type: 'doc',
    content: [{ type: 'rich-text-upload-medias', attrs: { id: media.id } }]
  };
  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: `Rich text media ${run}`, slug: `rich-text-media-${run}` },
      writer: { text },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const news = (await created.json()).doc;

  // Read by anyone: the news and the media are public
  const read = await request.get(`${API_BASE_URL}/news/${news.id}`);
  expect(read.status()).toBe(200);
  const node = (await read.json()).doc.writer.text.content[0];
  expect(node.attrs).toMatchObject({
    id: media.id,
    url: `/uploads/medias/${media.filename}`,
    filename: media.filename,
    mimeType: 'image/jpeg'
  });
  expect(node.attrs.sizes.thumbnail).toBe(media.sizes.thumbnail);

  await request.delete(`${API_BASE_URL}/news/${news.id}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${media.id}`, { headers });
});
