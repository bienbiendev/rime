import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * What a copy changes, through the API, on `articles`: a unique title and slug numbered until
 * free, a unique email emptied by an app hook, a value set by one, and a resolved reference kept.
 * Auth and upload documents are refused.
 */

type Headers = { cookie: string };
let headers: Headers;
let staffId: string;

// A title and slug no earlier run of the suite holds
const run = Date.now();

const duplicate = async (request: APIRequestContext, id: string) => {
  const response = await request.post(`${API_BASE_URL}/articles/${id}/duplicate`, { headers });
  expect(response.status()).toBe(200);
  const copyId = (await response.json()).id;
  return (
    await request.get(`${API_BASE_URL}/articles/${copyId}`, { headers }).then((r) => r.json())
  ).doc;
};

// Runs again in a fresh worker after a failure, so every test signs in
test.beforeAll(async ({ request }) => {
  headers = await signInSuperAdmin(request);
  const response = await request.get(
    `${API_BASE_URL}/staff?where[email][equals]=${encodeURIComponent(ADMIN_EMAIL)}`,
    { headers }
  );
  staffId = (await response.json()).docs[0].id;
});

test('Duplicate: a unique title and slug are numbered, hooks apply, a reference is kept', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/articles`, {
    headers,
    data: {
      title: `Sale ${run}`,
      slug: `sale-${run}`,
      contact: `sale-${run}@email.com`,
      code: 'A1',
      owner: staffId
    }
  });
  expect(response.status()).toBe(200);
  const source = (await response.json()).doc;

  const first = await duplicate(request, source.id);
  expect(first.title).toBe(`Sale ${run} (copy)`);
  expect(first.slug).toBe(`sale-${run}-copy`);
  expect(first.contact || null).toBeNull();
  expect(first.code).toBe('NEW');
  expect(first.owner.id).toBe(staffId);

  const second = await duplicate(request, source.id);
  expect(second.title).toBe(`Sale ${run} (copy 2)`);
  expect(second.slug).toBe(`sale-${run}-copy-2`);

  // The source is left as it was
  const after = await request.get(`${API_BASE_URL}/articles/${source.id}`, { headers });
  const { doc } = await after.json();
  expect(doc.title).toBe(`Sale ${run}`);
  expect(doc.slug).toBe(`sale-${run}`);
  expect(doc.contact).toBe(`sale-${run}@email.com`);
});

test('Duplicate: an auth or an upload document is refused, and no copy is made', async ({
  request
}) => {
  /** How many documents the collection holds. */
  const count = async (slug: string) => {
    const response = await request.get(`${API_BASE_URL}/${slug}?limit=500`, { headers });
    expect(response.status()).toBe(200);
    return (await response.json()).docs.length as number;
  };

  const staffBefore = await count('staff');
  const staff = await request.post(`${API_BASE_URL}/staff/${staffId}/duplicate`, { headers });
  expect(staff.status()).toBe(400);
  expect(await count('staff')).toBe(staffBefore);

  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  const media = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: { base64, filename: `dup-${run}.jpg` }, alt: 'Dup' }
  });
  expect(media.status()).toBe(200);
  const mediaId = (await media.json()).doc.id;

  const mediasBefore = await count('medias');
  const copy = await request.post(`${API_BASE_URL}/medias/${mediaId}/duplicate`, { headers });
  expect(copy.status()).toBe(400);
  expect(await count('medias')).toBe(mediasBefore);
});
