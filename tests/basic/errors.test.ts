import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, panelUrl, signIn } from '../util.js';

/**
 * How an error comes back from each place a request can fail. The pages hooks in
 * lib/+rime/pages/module.server.ts throw on `?throw=<kind>`:
 *
 *   unknown  new Error(…)                → 500, its message never sent
 *   http     error(418, …)               → 418
 *   rime     new RimeError(NOT_FOUND, …) → 404
 *   form     new RimeFormError({ … })    → 400, a failure an action can show on its form
 */

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

const PAGE = { attributes: { title: 'Errors probe', slug: 'errors-probe', template: 'basic' } };

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

/** The panel's create action, as the form posts it. */
const panelCreate = (request: APIRequestContext, kind: string, form: Record<string, string>) =>
  request.post(`${panelUrl('pages', 'create')}?/create&throw=${kind}`, {
    headers: { ...headers, 'x-sveltekit-action': 'true' },
    form
  });

/** The error node of a panel page's data request. */
const loadError = async (request: APIRequestContext, kind: string) => {
  const response = await request.get(`${panelUrl('pages', pageId)}/__data.json?throw=${kind}`, {
    headers
  });
  const { nodes } = await response.json();
  const node = nodes.find((node: { type?: string } | null) => node?.type === 'error');
  expect(node, `no error node for ?throw=${kind}`).toBeDefined();
  return node.error;
};

/****************************************************/
/* API
/****************************************************/

test('API create: an unknown error is a 500 that hides its message', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages?throw=unknown`, {
    headers,
    data: PAGE
  });
  expect(response.status()).toBe(500);
  expect((await response.json()).message).not.toContain('probe');
});

test('API create: an http error keeps its status', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages?throw=http`, { headers, data: PAGE });
  expect(response.status()).toBe(418);
});

test('API create: a RimeError keeps its status', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages?throw=rime`, { headers, data: PAGE });
  expect(response.status()).toBe(404);
});

test('API create: a form error is a 400 that names the field', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages?throw=form`, { headers, data: PAGE });
  expect(response.status()).toBe(400);
  // The message starts with the error code: "form_error — attributes.title: Not valid"
  expect((await response.json()).message).toContain('attributes.title: Not valid');
});

test('API read: an unknown error is a 500 that hides its message', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageId}?throw=unknown`, {
    headers
  });
  expect(response.status()).toBe(500);
  expect((await response.json()).message).not.toContain('probe');
});

test('API read: an http error keeps its status', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageId}?throw=http`, { headers });
  expect(response.status()).toBe(418);
});

test('API read: a RimeError keeps its status', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageId}?throw=rime`, { headers });
  expect(response.status()).toBe(404);
});

/****************************************************/
/* Form action
/****************************************************/

const FORM = {
  'attributes.title': 'Errors probe action',
  'attributes.slug': 'errors-probe-action',
  'attributes.template': 'basic'
};

test('Action: an unknown error is a 500 that hides its message', async ({ request }) => {
  const response = await panelCreate(request, 'unknown', FORM);
  expect(response.status()).toBe(500);
  const result = await response.json();
  expect(result.type).toBe('error');
  expect(result.error.message).not.toContain('probe');
});

test('Action: an http error keeps its status', async ({ request }) => {
  const response = await panelCreate(request, 'http', FORM);
  expect(response.status()).toBe(418);
  expect((await response.json()).type).toBe('error');
});

test('Action: a RimeError keeps its status', async ({ request }) => {
  const response = await panelCreate(request, 'rime', FORM);
  expect(response.status()).toBe(404);
  expect((await response.json()).type).toBe('error');
});

test('Action: a form error is a failure the form can show', async ({ request }) => {
  const response = await panelCreate(request, 'form', FORM);
  expect(response.status()).toBe(400);
  const result = await response.json();
  expect(result.type).toBe('failure');
  expect(result.data).toContain('attributes.title');
});

/****************************************************/
/* Panel load
/****************************************************/

test('Load: an unknown error is a 500 that hides its message', async ({ request }) => {
  const error = await loadError(request, 'unknown');
  expect(error.status).toBe(500);
  expect(error.message).not.toContain('probe');
});

test('Load: an http error keeps its status', async ({ request }) => {
  expect((await loadError(request, 'http')).status).toBe(418);
});

test('Load: a RimeError keeps its status', async ({ request }) => {
  expect((await loadError(request, 'rime')).status).toBe(404);
});
