import test, { expect } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const signInSuperAdmin = signIn('admin@bienoubien.studio', 'a&1Aa&1A');
const signInEditor = signIn('editor@bienoubien.com', 'a&1Aa&1A');

let docId: string;
let targetAId: string;
let targetBId: string;

/****************************************************/
/* Setup: editor staff account + relation targets
/****************************************************/

test('Should create an editor staff account', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'editor@bienoubien.com',
      name: 'Editor',
      roles: ['editor'],
      password: 'a&1Aa&1A'
    }
  });
  expect(response.status()).toBe(200);
});

test('Should create relation targets', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const a = await request.post(`${API_BASE_URL}/targets`, {
    headers,
    data: { title: 'Target A' }
  });
  expect(a.status()).toBe(200);
  targetAId = (await a.json()).doc.id;

  const b = await request.post(`${API_BASE_URL}/targets`, {
    headers,
    data: { title: 'Target B' }
  });
  expect(b.status()).toBe(200);
  targetBId = (await b.json()).doc.id;
});

test('Should create the hooks-test document', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/hooks-test`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Doc' }
  });
  expect(response.status()).toBe(200);
  docId = (await response.json()).doc.id;
});

/** ---------------- BEFOREVALIDATE -> VALIDATE ("foo"), TEXT ---------------- */

test('Should coerce magicText to foo on create', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/hooks-test`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'Magic', magicText: 'anything' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.magicText).toBe('foo');
});

test('Should keep coercing magicText to foo on update', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { magicText: 'something else entirely' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.magicText).toBe('foo');
});

/** ---------------- BEFOREVALIDATE -> VALIDATE ("foo"), LOCALIZED TEXT ---------------- */

test('Should coerce magicTextLocalized to foo for locale EN', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}?locale=en`, {
    headers: await signInSuperAdmin(request),
    data: { magicTextLocalized: 'bar' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.magicTextLocalized).toBe('foo');
});

test('Should coerce magicTextLocalized to foo for locale FR', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}?locale=fr`, {
    headers: await signInSuperAdmin(request),
    data: { magicTextLocalized: 'baz' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.magicTextLocalized).toBe('foo');
});

/** ---------------- $BEFORESAVE (server-only) ---------------- */

test('Should append -tagged to taggedText via $beforeSave', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { taggedText: 'hello' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.taggedText).toBe('hello-tagged');
});

/** ---------------- $BEFOREREAD (server-only), STRING ---------------- */

test('Should uppercase shoutedText via $beforeRead', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers,
    data: { shoutedText: 'quiet' }
  });
  const response = await request.get(`${API_BASE_URL}/hooks-test/${docId}`, { headers });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.shoutedText).toBe('QUIET');
});

/** ---------------- BEFOREVALIDATE -> VALIDATE ("published"), SELECT ---------------- */

test('Should coerce status to published, overriding the built-in select validator', async ({
  request
}) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { status: 'draft' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.status).toBe('published');
});

/** ---------------- BUILT-IN SELECT VALIDATION, SINGLE ---------------- */

test('Should reject statusPlain with an out-of-list option', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { statusPlain: 'not-an-option' }
  });
  expect(response.status()).toBe(400);
});

test('Should accept statusPlain with a valid option', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { statusPlain: 'draft' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.statusPlain).toBe('draft');
});

/** ---------------- BUILT-IN SELECT VALIDATION, MANY ---------------- */

test('Should reject tags containing an out-of-list option', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { tags: ['a', 'x'] }
  });
  expect(response.status()).toBe(400);
});

test('Should accept tags with only valid options', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { tags: ['a', 'b'] }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect([...doc.tags].sort()).toEqual(['a', 'b']);
});

/** ---------------- $BEFOREREAD (server-only), STRUCTURED VALUE (RICHTEXT) ---------------- */

test('Should stamp readAt on body via $beforeRead without losing the original content', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  // A doc with an empty content array is considered empty by richText's own
  // isEmpty() check, which would make set-default-values overwrite it with
  // the field's default (null) before any hook sees it — so this needs real
  // (non-empty) content to actually exercise $beforeRead.
  await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers,
    data: {
      body: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }]
      }
    }
  });
  const response = await request.get(`${API_BASE_URL}/hooks-test/${docId}`, { headers });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.body.type).toBe('doc');
  expect(doc.body.readAt).toBe(true);
});

/** ---------------- BEFOREVALIDATE VIA $rime/runtime, RELATION SINGLE ---------------- */

test('Should keep a valid related reference', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { related: targetAId }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.related.map((ref: any) => ref.documentId)).toContain(targetAId);
});

test('Should filter out a related reference to a nonexistent document', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { related: '00000000-0000-0000-0000-000000000000' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  const ids = (doc.related ?? []).map((ref: any) => ref.documentId);
  expect(ids).not.toContain('00000000-0000-0000-0000-000000000000');
});

/** ---------------- BEFOREVALIDATE VIA $rime/runtime, RELATION MANY ---------------- */

test('Should keep only valid references in relatedMany', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      relatedMany: [targetAId, targetBId, '00000000-0000-0000-0000-000000000000']
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  const ids = doc.relatedMany.map((ref: any) => ref.documentId);
  expect(ids.sort()).toEqual([targetAId, targetBId].sort());
});

/** ---------------- FIELD-LEVEL ACCESS (adminOnly) ---------------- */

test('Should let a super admin set adminOnly', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { adminOnly: 'secret' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.adminOnly).toBe('secret');
});

test('Should hide adminOnly from an editor on read', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInEditor(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect('adminOnly' in doc).toBe(false);
});

test('Should silently drop an editor write to adminOnly', async ({ request }) => {
  const patchResponse = await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInEditor(request),
    data: { adminOnly: 'hacked' }
  });
  expect(patchResponse.status()).toBe(200);

  const verifyResponse = await request.get(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await verifyResponse.json();
  expect(doc.adminOnly).toBe('secret');
});

test('Should let a super admin update adminOnly', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  await request.patch(`${API_BASE_URL}/hooks-test/${docId}`, {
    headers,
    data: { adminOnly: 'updated' }
  });
  const response = await request.get(`${API_BASE_URL}/hooks-test/${docId}`, { headers });
  const { doc } = await response.json();
  expect(doc.adminOnly).toBe('updated');
});
