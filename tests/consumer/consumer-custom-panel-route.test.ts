import test, { expect } from '@playwright/test';
import { BASE_URL, PANEL_SEGMENT } from '../util.js';

// Only meaningful when this pass configured a non-default RIME_PANEL_ROUTE (see
// local-pack-test.sh's 4th pass) - self-skips so accidentally matching this file
// against a default-configured instance doesn't produce a false failure.
test.skip(PANEL_SEGMENT === 'panel', 'requires a non-default RIME_PANEL_ROUTE');

test('old default /panel 404s once RIME_PANEL_ROUTE is customized', async ({ request }) => {
  const dashboard = await request.get(`${BASE_URL}/panel`, { maxRedirects: 0 });
  expect(dashboard.status()).toBe(404);

  const signIn = await request.get(`${BASE_URL}/panel/sign-in`, { maxRedirects: 0 });
  expect(signIn.status()).toBe(404);
});

test('unauthenticated visit to the custom panel segment redirects to its sign-in', async ({
  request
}) => {
  const response = await request.get(`${BASE_URL}/${PANEL_SEGMENT}`, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers()['location']).toBe(`/${PANEL_SEGMENT}/sign-in`);
});
