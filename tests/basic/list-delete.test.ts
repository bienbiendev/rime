import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const PAGE = {
  attributes: { title: 'List delete probe', slug: 'list-delete-probe', template: 'basic' }
};

let pageId: string;
let headers: { cookie: string };

test.beforeAll(async ({ request }) => {
  headers = await signInSuperAdmin(request);
  const response = await request.post(`${API_BASE_URL}/pages`, { headers, data: PAGE });
  expect(response.status()).toBe(200);
  pageId = (await response.json()).doc.id;
});

test.afterAll(async ({ request }) => {
  await request.delete(`${API_BASE_URL}/pages/${pageId}`, { headers });
});

/** How many pages the super admin reads in the list. */
const countPages = async (request: APIRequestContext) => {
  const response = await request.get(`${API_BASE_URL}/pages`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).docs.length;
};

test('A staff delete of the page list with no filter answers 400 and deletes nothing', async ({
  request
}) => {
  const before = await countPages(request);
  expect(before).toBeGreaterThan(0);

  const response = await request.delete(`${API_BASE_URL}/pages`, { headers });
  expect(response.status()).toBe(400);

  expect(await countPages(request)).toBe(before);
  const page = await request.get(`${API_BASE_URL}/pages/${pageId}`, { headers });
  expect(page.status()).toBe(200);
});
