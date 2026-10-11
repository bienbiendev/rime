import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'path';
import { API_BASE_URL, BASE_URL, signIn } from '../util.js';

/**
 * `storage/` holds the uploads and other server files: no URL reaches it. An upload is served at
 * `/uploads/<folder>/<file>` only.
 */

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const probe = path.resolve(process.cwd(), 'storage/probe.txt');

test.beforeAll(() => {
  mkdirSync(path.dirname(probe), { recursive: true });
  writeFileSync(probe, 'probe');
});

test.afterAll(() => {
  rmSync(probe, { force: true });
});

test('a file of storage answers 404, whatever the path', async ({ request }) => {
  for (const url of ['/storage/probe.txt', '/storage', '/storage/']) {
    expect((await request.get(`${BASE_URL}${url}`)).status(), url).toBe(404);
  }
});

test('an upload answers at its url, and 404 at its place in storage', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  const created = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: `storage-probe-${Date.now()}.jpg` }, alt: 'storage probe' }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  expect(doc.url).toBe(`/uploads/medias/${doc.filename}`);
  expect((await request.get(`${BASE_URL}${doc.url}`)).status()).toBe(200);
  const inStorage = await request.get(`${BASE_URL}/storage/uploads/medias/${doc.filename}`);
  expect(inStorage.status()).toBe(404);

  await request.delete(`${API_BASE_URL}/medias/${doc.id}`, { headers });
});
