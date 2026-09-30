import { PARAMS } from '$lib/core/constants';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * A new version holds the whole document: a field the update does not send takes the previous
 * version's value, and a field sent empty stays empty. On `news`, whose `published` is a date.
 */

type Headers = { cookie: string };

const latestPublished = async (request: APIRequestContext, headers: Headers, id: string) => {
  const response = await request.get(`${API_BASE_URL}/news/${id}?${PARAMS.LATEST}=true`, {
    headers
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.attributes.published as string | null;
};

test('A new draft keeps a field not sent, and keeps a field cleared on purpose cleared', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const created = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: {
        title: 'New version',
        slug: `new-version-${Date.now()}`,
        published: '2026-01-01T00:00:00.000Z'
      },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { id } = (await created.json()).doc;

  // Only the title is sent: the date comes from the published version.
  const titled = await request.patch(`${API_BASE_URL}/news/${id}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'New version, drafted' } }
  });
  expect(titled.status()).toBe(200);
  expect(Date.parse((await latestPublished(request, headers, id))!)).toBe(
    Date.parse('2026-01-01T00:00:00.000Z')
  );

  // The date is sent empty: the new draft keeps it empty.
  const cleared = await request.patch(`${API_BASE_URL}/news/${id}?${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { published: null } }
  });
  expect(cleared.status()).toBe(200);
  expect(await latestPublished(request, headers, id)).toBe(null);
});
