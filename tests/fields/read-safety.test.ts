import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, BASE_URL, signIn } from '../util.js';

/**
 * What a reader gets back, whether it reads or writes, and what rime's own steps see on the way:
 * tests/fields/lib/+rime/safety.ts. Anonymous requests send no headers.
 */

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// Unique per run: names, emails and slugs no earlier run holds
const run = Date.now();
const EDITOR_EMAIL = `safety-editor-${run}@email.com`;

type Headers = { cookie: string };
let admin: Headers;
let editor: Headers;
let base64: string;

const json = async (response: Awaited<ReturnType<APIRequestContext['get']>>) => {
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
};

const uploadMedia = async (request: APIRequestContext, filename: string) =>
  (
    await json(
      await request.post(`${API_BASE_URL}/private-medias`, {
        headers: admin,
        data: { file: { base64, filename }, alt: filename }
      })
    )
  ).doc;

// Runs again in a fresh worker after a failure, so every test finds its accounts
test.beforeAll(async ({ request }) => {
  admin = await signInAdmin(request);
  const created = await request.post(`${API_BASE_URL}/staff`, {
    headers: admin,
    data: { email: EDITOR_EMAIL, name: 'Safety editor', roles: ['editor'], password: PASSWORD }
  });
  expect(created.status()).toBe(200);
  editor = await signIn(EDITOR_EMAIL, PASSWORD)(request);
  base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
});

/****************************************************/
/* Writes the caller may not read
/****************************************************/

test('a create the caller may not read answers its id alone, and its hook gets the whole document', async ({
  request
}) => {
  const data = { name: `Ann ${run}`, message: 'Hello', internalNote: 'vip' };
  const { doc } = await json(await request.post(`${API_BASE_URL}/contacts`, { data }));
  expect(doc).toEqual({ id: doc.id });

  // Written in full
  const stored = (
    await json(await request.get(`${API_BASE_URL}/contacts/${doc.id}`, { headers: admin }))
  ).doc;
  expect(stored).toMatchObject(data);

  // The afterCreate hook saw every field
  const { docs: logs } = await json(
    await request.get(`${API_BASE_URL}/contact-logs?limit=500`, { headers: admin })
  );
  const log = logs.map((entry: any) => JSON.parse(entry.payload)).find((p: any) => p.id === doc.id);
  expect(log).toEqual({ id: doc.id, ...data });

  // Still not readable
  expect((await request.get(`${API_BASE_URL}/contacts`)).status()).toBe(403);
  expect((await request.get(`${API_BASE_URL}/contacts/${doc.id}`)).status()).toBe(403);
});

/****************************************************/
/* Writes the caller may read in part
/****************************************************/

test('a create or update the caller may read in part answers without the hidden fields', async ({
  request
}) => {
  const created = (
    await json(
      await request.post(`${API_BASE_URL}/notices`, {
        data: { title: `Notice ${run}`, draftNote: 'hidden' }
      })
    )
  ).doc;
  expect(created.title).toBe(`Notice ${run}`);
  expect(created).not.toHaveProperty('draftNote');

  const updated = (
    await json(
      await request.patch(`${API_BASE_URL}/notices/${created.id}`, {
        data: { title: `Notice ${run} edited`, draftNote: 'still hidden' }
      })
    )
  ).doc;
  expect(updated.title).toBe(`Notice ${run} edited`);
  expect(updated).not.toHaveProperty('draftNote');

  // Staff reads it, the public does not
  const asAdmin = (
    await json(await request.get(`${API_BASE_URL}/notices/${created.id}`, { headers: admin }))
  ).doc;
  expect(asAdmin.draftNote).toBe('still hidden');
  const asAnyone = (await json(await request.get(`${API_BASE_URL}/notices/${created.id}`))).doc;
  expect(asAnyone).not.toHaveProperty('draftNote');
});

/****************************************************/
/* .system() stays system
/****************************************************/

test("an app's system create answers the whole document, to anyone", async ({ request }) => {
  const data = { name: `Bob ${run}`, message: 'Hi', internalNote: 'kept' };
  const { doc } = await json(await request.post(`${BASE_URL}/test-safety/contact`, { data }));
  expect(doc).toMatchObject(data);
});

test("an app's system upload creates its directories", async ({ request }) => {
  const _path = `root:safety${run}:deep`;
  const { doc } = await json(
    await request.post(`${BASE_URL}/test-safety/media`, {
      data: { file: { base64, filename: `dir-${run}.jpg` }, alt: 'dir', _path }
    })
  );
  expect(doc._path).toBe(_path);

  const directory = await request.get(
    `${API_BASE_URL}/private-medias-directories/${encodeURIComponent(_path)}`,
    { headers: admin }
  );
  expect(directory.status()).toBe(200);
});

test("an app's system delete keeps a file another media still uses", async ({ request }) => {
  const first = await uploadMedia(request, `shared-${run}.jpg`);
  const second = await uploadMedia(request, `shared-${run}.jpg`);
  // The same content: one file on disk for both
  expect(second.filename).toBe(first.filename);

  expect((await request.delete(`${BASE_URL}/test-safety/media?id=${first.id}`)).status()).toBe(200);
  const deleted = await request.get(`${API_BASE_URL}/private-medias/${first.id}`, {
    headers: admin
  });
  expect(deleted.status()).toBe(404);

  const kept = (
    await json(await request.get(`${API_BASE_URL}/private-medias/${second.id}`, { headers: admin }))
  ).doc;
  expect((await request.get(`${BASE_URL}${kept.url}`)).status()).toBe(404);
  expect((await request.get(`${BASE_URL}${kept.url}`, { headers: admin })).status()).toBe(200);
});

/****************************************************/
/* Files
/****************************************************/

test('a file of a media only staff reads is served to staff only', async ({ request }) => {
  const media = await uploadMedia(request, `invoice-${run}.jpg`);
  expect(media.url).toBe(`/uploads/private-medias/${media.filename}`);
  expect(media.sizes.thumbnail).toMatch(/^\/uploads\/private-medias\/invoice-.+-thumbnail-/);

  // The file and its size, to staff
  for (const url of [media.url, media.sizes.thumbnail]) {
    expect((await request.get(`${BASE_URL}${url}`)).status()).toBe(404);
    const asEditor = await request.get(`${BASE_URL}${url}`, { headers: editor });
    expect(asEditor.status()).toBe(200);
    expect(asEditor.headers()['content-type']).toBe('image/jpeg');
    expect(asEditor.headers()['cache-control']).toBe('private, no-cache');
  }

  // A name no media holds
  const missing = await request.get(`${BASE_URL}/uploads/private-medias/missing-${run}.jpg`, {
    headers: admin
  });
  expect(missing.status()).toBe(404);
});

test('a file of a media anyone reads is served to anyone', async ({ request }) => {
  const { doc } = await json(
    await request.post(`${API_BASE_URL}/medias`, {
      headers: admin,
      data: { file: { base64, filename: `public-${run}.jpg` }, alt: 'public' }
    })
  );
  expect(doc.url).toBe(`/uploads/medias/${doc.filename}`);
  const served = await request.get(`${BASE_URL}${doc.url}`);
  expect(served.status()).toBe(200);
  expect(served.headers()['cache-control']).toBe('public, max-age=86400');

  const missing = await request.get(`${BASE_URL}/uploads/medias/missing-${run}.jpg`);
  expect(missing.status()).toBe(404);
});

/****************************************************/
/* Rights checked once
/****************************************************/

test('an editor saves a version of a report they may not create, and its admin field stays', async ({
  request
}) => {
  const report = (
    await json(
      await request.post(`${API_BASE_URL}/reports`, {
        headers: admin,
        data: { title: `Report ${run}`, adminNote: 'admin only' }
      })
    )
  ).doc;

  const saved = (
    await json(
      await request.patch(`${API_BASE_URL}/reports/${report.id}?fork=true&latest=true`, {
        headers: editor,
        data: { title: `Report ${run} edited` }
      })
    )
  ).doc;
  expect(saved.title).toBe(`Report ${run} edited`);
  expect(saved).not.toHaveProperty('adminNote');

  // The new version is there, and it kept the field the editor may not read
  const { docs: versions } = await json(
    await request.get(`${API_BASE_URL}/reports--versions?where[ownerId][equals]=${report.id}`, {
      headers: admin
    })
  );
  expect(versions.length).toBe(2);
  const latest = (
    await json(
      await request.get(`${API_BASE_URL}/reports/${report.id}?latest=true`, { headers: admin })
    )
  ).doc;
  expect(latest.title).toBe(`Report ${run} edited`);
  expect(latest.adminNote).toBe('admin only');
});

/****************************************************/
/* Nested reads
/****************************************************/

test('a public read leaves out the thumbnail, relations and link it may not read, and keeps the document', async ({
  request
}) => {
  const media = await uploadMedia(request, `cover-${run}.jpg`);
  const privateDoc = (
    await json(
      await request.post(`${API_BASE_URL}/private-docs`, {
        headers: admin,
        data: { title: `Private ${run}`, secret: 'admins' }
      })
    )
  ).doc;
  const notice = (
    await json(
      await request.post(`${API_BASE_URL}/notices`, {
        headers: admin,
        data: {
          title: `Covered ${run}`,
          cover: media.id,
          related: [privateDoc.id],
          more: { type: 'privateDocs', value: privateDoc.id, target: '_self' }
        }
      })
    )
  ).doc;

  // The public list keeps the notice, with no thumbnail
  const { docs: listed } = await json(await request.get(`${API_BASE_URL}/notices?limit=500`));
  const publicNotice = listed.find((doc: any) => doc.id === notice.id);
  expect(publicNotice).toBeDefined();
  expect(publicNotice._thumbnail).toBeUndefined();

  // Staff gets the thumbnail
  const { docs: staffListed } = await json(
    await request.get(`${API_BASE_URL}/notices?limit=500`, { headers: admin })
  );
  expect(staffListed.find((doc: any) => doc.id === notice.id)._thumbnail).toBeTruthy();

  // One level down: the public gets no related document and no url
  const publicDeep = (await json(await request.get(`${API_BASE_URL}/notices/${notice.id}?depth=1`)))
    .doc;
  expect(publicDeep.related).toEqual([]);
  expect(publicDeep.more.url).toBeUndefined();

  // An editor gets them, without the admin-only field of the related document
  const editorDeep = (
    await json(
      await request.get(`${API_BASE_URL}/notices/${notice.id}?depth=1`, { headers: editor })
    )
  ).doc;
  expect(editorDeep.related.map((doc: any) => doc.id)).toEqual([privateDoc.id]);
  expect(editorDeep.related[0]).not.toHaveProperty('secret');
  expect(editorDeep.more.url).toBeTruthy();

  // An admin gets that field too
  const adminDeep = (
    await json(
      await request.get(`${API_BASE_URL}/notices/${notice.id}?depth=1`, { headers: admin })
    )
  ).doc;
  expect(adminDeep.related[0].secret).toBe('admins');

  // The link carries its target's id, url and title at any depth, for a reader of the target only.
  // A url a writer sends with the link is never stored.
  const target = (
    await json(
      await request.get(`${API_BASE_URL}/private-docs/${privateDoc.id}`, { headers: editor })
    )
  ).doc;
  const elsewhere = (
    await json(
      await request.post(`${API_BASE_URL}/notices`, {
        headers: editor,
        data: {
          title: `Elsewhere ${run}`,
          more: {
            type: 'privateDocs',
            value: privateDoc.id,
            target: '_self',
            url: 'https://elsewhere.test'
          }
        }
      })
    )
  ).doc;
  for (const depth of [0, 1]) {
    for (const id of [notice.id, elsewhere.id]) {
      const url = `${API_BASE_URL}/notices/${id}?depth=${depth}`;
      const publicMore = (await json(await request.get(url))).doc.more;
      expect(publicMore).not.toHaveProperty('id');
      expect(publicMore).not.toHaveProperty('url');
      expect(publicMore).not.toHaveProperty('title');

      const editorMore = (await json(await request.get(url, { headers: editor }))).doc.more;
      expect(editorMore).toMatchObject({
        id: privateDoc.id,
        url: target.url,
        title: `Private ${run}`
      });
    }
  }
});

test('a rich-text image of a media only staff reads has no url for the public', async ({
  request
}) => {
  const media = await uploadMedia(request, `embedded-${run}.jpg`);
  // Saved with what the editor sends: the node keeps its id and legend only
  const body = {
    type: 'doc',
    content: [
      {
        type: 'rich-text-upload-privateMedias',
        attrs: { id: media.id, legend: 'Embedded', url: media.url, filename: media.filename }
      }
    ]
  };
  const notice = (
    await json(
      await request.post(`${API_BASE_URL}/notices`, {
        headers: admin,
        data: { title: `Embedded ${run}`, body }
      })
    )
  ).doc;

  const url = `${API_BASE_URL}/notices/${notice.id}`;
  const publicNode = (await json(await request.get(url))).doc.body.content[0];
  expect(publicNode.attrs).toEqual({
    id: media.id,
    legend: 'Embedded',
    url: null,
    sizes: null,
    title: null,
    mimeType: null,
    filename: null
  });

  const editorNode = (await json(await request.get(url, { headers: editor }))).doc.body.content[0];
  expect(editorNode.attrs).toMatchObject({
    id: media.id,
    legend: 'Embedded',
    url: media.url,
    filename: media.filename,
    mimeType: 'image/jpeg'
  });
  expect(editorNode.attrs.sizes.thumbnail).toBe(media.sizes.thumbnail);
});

test('a rich-text resource reads its document as the reader sees it, and nothing it may not read', async ({
  request
}) => {
  const cover = await uploadMedia(request, `resource-cover-${run}.jpg`);
  const privateDoc = (
    await json(
      await request.post(`${API_BASE_URL}/private-docs`, {
        headers: admin,
        data: { title: `Resource private ${run}`, secret: 'admins' }
      })
    )
  ).doc;
  const target = (
    await json(
      await request.post(`${API_BASE_URL}/notices`, {
        headers: admin,
        data: { title: `Resource target ${run}`, cover: cover.id }
      })
    )
  ).doc;

  // Saved with what the editor sends: each node keeps its id only
  const resources = {
    type: 'doc',
    content: [
      {
        type: 'rich-text-resource-notices',
        attrs: { id: target.id, title: 'Stale', _type: 'notices', _thumbnail: '/medias/stale.jpg' }
      },
      { type: 'rich-text-resource-privateDocs', attrs: { id: privateDoc.id } }
    ]
  };
  const notice = (
    await json(
      await request.post(`${API_BASE_URL}/notices`, {
        headers: admin,
        data: { title: `Resources ${run}`, body: resources }
      })
    )
  ).doc;
  // The target names the notice back: each read reads the other once, not in turn
  const back = {
    type: 'doc',
    content: [{ type: 'rich-text-resource-notices', attrs: { id: notice.id } }]
  };
  await json(
    await request.patch(`${API_BASE_URL}/notices/${target.id}`, {
      headers: admin,
      data: { body: back }
    })
  );

  const url = `${API_BASE_URL}/notices/${notice.id}`;

  // The public reads the notice, not its thumbnail of a private media, and not the private doc
  const [publicNotice, publicPrivate] = (await json(await request.get(url))).doc.body.content;
  expect(publicNotice.attrs).toEqual({
    id: target.id,
    title: `Resource target ${run}`,
    _type: 'notices',
    _thumbnail: null
  });
  expect(publicPrivate.attrs).toEqual({
    id: privateDoc.id,
    title: null,
    _type: null,
    _thumbnail: null
  });

  // An editor reads both, and the notice's thumbnail
  const [editorNotice, editorPrivate] = (await json(await request.get(url, { headers: editor })))
    .doc.body.content;
  expect(editorNotice.attrs).toEqual({
    id: target.id,
    title: `Resource target ${run}`,
    _type: 'notices',
    _thumbnail: cover._thumbnail
  });
  expect(editorPrivate.attrs).toEqual({
    id: privateDoc.id,
    title: `Resource private ${run}`,
    _type: 'privateDocs',
    _thumbnail: null
  });
});

/****************************************************/
/* Filters and sorts on what the reader may not read
/****************************************************/

test('a filter or a sort on a field the reader may not read is refused, and staff may use it', async ({
  request
}) => {
  const filtered = `${API_BASE_URL}/notices?where[draftNote][like]=a%25`;

  expect((await request.get(filtered)).status()).toBe(403);
  expect((await request.get(`${API_BASE_URL}/notices?sort=draftNote`)).status()).toBe(403);

  // Staff reads draftNote, so it filters and sorts on it
  expect((await request.get(filtered, { headers: admin })).status()).toBe(200);
  const sorted = await request.get(`${API_BASE_URL}/notices?sort=draftNote`, { headers: admin });
  expect(sorted.status()).toBe(200);
});
