import test, { expect } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

test('A null in a relation list is dropped, not a 500', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // `[undefined]` over JSON.
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    headers,
    data: { logo: [null] }
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).doc.logo).toEqual([]);
});
