import test, { expect, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Default values through the API, on the `defaults` fixture: each kind of field twice, once per
 * fill. Every assertion reads the document back.
 *
 * ```
 *                                    fill: 'create'   fill: 'save'
 * POST   sent a value                the value        the value
 * POST   not sent                    the default      the default
 * POST   sent empty                  empty            the default
 * PATCH  sent a value                the value        the value
 * PATCH  not sent, stored a value    unchanged        unchanged
 * PATCH  not sent, stored empty      empty            (unit spec)
 * PATCH  sent empty                  empty            the default
 * read   stored empty                empty            (unit spec)
 * ```
 *
 * The API cannot store a `save` field empty, so its two "stored empty" lines are in
 * `src/lib/core/pipeline/hooks/default-values.spec.ts`.
 */

// The ids the fixture's relation defaults name.
const TARGET_ID = 'defaults-target-1';
const OTHER_TARGET_ID = 'defaults-target-2';

type Kind = {
  name: string;
  value: unknown;
  empty: unknown;
  isValue: (value: any) => boolean;
  isDefault: (value: any) => boolean;
  isEmpty: (value: any) => boolean;
};

const isNull = (value: unknown) => value === null;
const isEmptyList = (value: unknown) => Array.isArray(value) && value.length === 0;

const kinds: Kind[] = [
  {
    name: 'text',
    value: 'Hello',
    empty: null,
    isValue: (value) => value === 'Hello',
    isDefault: (value) => value === 'Default',
    isEmpty: isNull
  },
  {
    name: 'number',
    value: 0,
    empty: null,
    isValue: (value) => value === 0,
    isDefault: (value) => value === 5,
    isEmpty: isNull
  },
  {
    name: 'toggle',
    value: false,
    empty: null,
    isValue: (value) => value === false,
    isDefault: (value) => value === true,
    isEmpty: isNull
  },
  {
    name: 'checkbox',
    value: false,
    empty: null,
    isValue: (value) => value === false,
    isDefault: (value) => value === true,
    isEmpty: isNull
  },
  {
    name: 'date',
    value: '2026-01-01T00:00:00.000Z',
    empty: null,
    isValue: (value) => Date.parse(value) === Date.parse('2026-01-01T00:00:00.000Z'),
    isDefault: (value) => typeof value === 'string' && Date.now() - Date.parse(value) < 60_000,
    isEmpty: isNull
  },
  {
    name: 'relation',
    value: [{ relationTo: 'targets', documentId: OTHER_TARGET_ID }],
    empty: [],
    isValue: (value) => value?.length === 1 && value[0].documentId === OTHER_TARGET_ID,
    isDefault: (value) => value?.length === 1 && value[0].documentId === TARGET_ID,
    isEmpty: isEmptyList
  },
  {
    name: 'blocks',
    value: [{ type: 'memo', text: 'Mine' }],
    empty: [],
    isValue: (value) => value?.length === 1 && value[0].text === 'Mine',
    isDefault: (value) => value?.length === 1 && value[0].text === 'Default',
    isEmpty: isEmptyList
  },
  {
    name: 'tree',
    value: [{ label: 'Mine' }],
    empty: [],
    isValue: (value) => value?.length === 1 && value[0].label === 'Mine',
    isDefault: (value) => value?.length === 1 && value[0].label === 'Default',
    isEmpty: isEmptyList
  }
];

let headers: { cookie: string };

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext();
  headers = await signInSuperAdmin(api);
  for (const id of [TARGET_ID, OTHER_TARGET_ID]) {
    const exists = await api.get(`${API_BASE_URL}/targets/${id}`, { headers });
    if (exists.ok()) continue;
    const response = await api.post(`${API_BASE_URL}/targets`, {
      headers,
      data: { id, title: id }
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).doc.id).toBe(id);
  }
  await api.dispose();
});

const post = async (request: APIRequestContext, data: Record<string, unknown>) => {
  const response = await request.post(`${API_BASE_URL}/defaults`, {
    headers,
    data: { title: 'Defaults', ...data }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc.id as string;
};

const patch = async (request: APIRequestContext, id: string, data: Record<string, unknown>) => {
  const response = await request.patch(`${API_BASE_URL}/defaults/${id}`, { headers, data });
  expect(response.status()).toBe(200);
};

const read = async (request: APIRequestContext, id: string, field: string) => {
  const response = await request.get(`${API_BASE_URL}/defaults/${id}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).doc[field];
};

for (const kind of kinds) {
  const field = `${kind.name}Create`;

  test.describe(`${kind.name}, fill 'create'`, () => {
    test('POST sent a value: the value', async ({ request }) => {
      const id = await post(request, { [field]: kind.value });
      expect(kind.isValue(await read(request, id, field))).toBe(true);
    });

    test('POST not sent: the default', async ({ request }) => {
      const id = await post(request, {});
      expect(kind.isDefault(await read(request, id, field))).toBe(true);
    });

    test('POST sent empty: empty, and read empty', async ({ request }) => {
      const id = await post(request, { [field]: kind.empty });
      expect(kind.isEmpty(await read(request, id, field))).toBe(true);
    });

    test('PATCH sent a value: the value', async ({ request }) => {
      const id = await post(request, { [field]: kind.empty });
      await patch(request, id, { [field]: kind.value });
      expect(kind.isValue(await read(request, id, field))).toBe(true);
    });

    test('PATCH not sent, stored a value: unchanged', async ({ request }) => {
      const id = await post(request, { [field]: kind.value });
      await patch(request, id, { title: 'Patched' });
      expect(kind.isValue(await read(request, id, field))).toBe(true);
    });

    test('PATCH not sent, stored empty: empty', async ({ request }) => {
      const id = await post(request, { [field]: kind.empty });
      await patch(request, id, { title: 'Patched' });
      expect(kind.isEmpty(await read(request, id, field))).toBe(true);
    });

    test('PATCH sent empty: empty', async ({ request }) => {
      const id = await post(request, { [field]: kind.value });
      await patch(request, id, { [field]: kind.empty });
      expect(kind.isEmpty(await read(request, id, field))).toBe(true);
    });
  });
}

for (const kind of kinds) {
  const field = `${kind.name}Save`;

  test.describe(`${kind.name}, fill 'save'`, () => {
    test('POST sent a value: the value', async ({ request }) => {
      const id = await post(request, { [field]: kind.value });
      expect(kind.isValue(await read(request, id, field))).toBe(true);
    });

    test('POST not sent: the default', async ({ request }) => {
      const id = await post(request, {});
      expect(kind.isDefault(await read(request, id, field))).toBe(true);
    });

    test('POST sent empty: the default', async ({ request }) => {
      const id = await post(request, { [field]: kind.empty });
      expect(kind.isDefault(await read(request, id, field))).toBe(true);
    });

    test('PATCH sent a value: the value', async ({ request }) => {
      const id = await post(request, {});
      await patch(request, id, { [field]: kind.value });
      expect(kind.isValue(await read(request, id, field))).toBe(true);
    });

    test('PATCH not sent, stored a value: unchanged', async ({ request }) => {
      const id = await post(request, { [field]: kind.value });
      await patch(request, id, { title: 'Patched' });
      expect(kind.isValue(await read(request, id, field))).toBe(true);
    });

    test('PATCH sent empty: the default', async ({ request }) => {
      const id = await post(request, { [field]: kind.value });
      await patch(request, id, { [field]: kind.empty });
      expect(kind.isDefault(await read(request, id, field))).toBe(true);
    });
  });
}

test("An area's first boot writes its defaults, blocks and tree items included", async ({
  request
}) => {
  const response = await request.get(`${API_BASE_URL}/homepage`, { headers });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.title).toBe('Home');
  expect(doc.sections).toHaveLength(1);
  expect(doc.sections[0]).toMatchObject({ type: 'intro', text: 'Welcome' });
  expect(doc.menu).toHaveLength(1);
  expect(doc.menu[0].label).toBe('Home');
  expect(doc.menu[0]._children.map((item: { label: string }) => item.label)).toEqual(['About']);
});

test("a text sent as '' is empty like null", async ({ request }) => {
  const id = await post(request, { textSave: '' });
  expect(await read(request, id, 'textSave')).toBe('Default');
});
