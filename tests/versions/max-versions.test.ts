import test, { expect } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/** `versions: true` normalises to twelve versions kept. */
const MAX_VERSIONS = 12;

/**
 * Pruning on a versioned config without drafts.
 *
 * `infos` is `versions: true`: no `status` field, so the pruning cannot spare a published
 * version and keeps the newest rows by date alone.
 */
test('An area without drafts keeps its newest versions only', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const written: string[] = [];
  for (let i = 1; i <= MAX_VERSIONS + 2; i++) {
    const title = `pruned ${i}`;
    const response = await request.patch(`${API_BASE_URL}/infos`, {
      headers,
      data: { title }
    });
    expect(response.status()).toBe(200);
    written.push(title);
  }

  const response = await request.get(`${API_BASE_URL}/infos--versions?limit=100&sort=-updatedAt`, {
    headers
  });
  expect(response.status()).toBe(200);
  const titles = ((await response.json()).docs as { title: string }[]).map((v) => v.title);

  expect(titles).toHaveLength(MAX_VERSIONS);
  expect(titles).toEqual(written.slice(-MAX_VERSIONS).reverse());
});
