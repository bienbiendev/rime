import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

test('A null in a relation list is dropped, not a 500', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg'));
  const uploaded = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: 'leaves.jpg' }, alt: 'logo' }
  });
  expect(uploaded.status()).toBe(200);
  const mediaId = (await uploaded.json()).doc.id;

  // `[mediaId, undefined]` over JSON: the null goes, the media stays.
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    headers,
    data: { logo: [mediaId, null] }
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).doc.logo.map((ref: any) => ref.documentId)).toEqual([mediaId]);
});
