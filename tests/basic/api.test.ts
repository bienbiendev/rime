import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import { EDIT_LOCK_TTL_AFTER_CLOSE_MS } from '#lib/core/prototype/shared/metas/constant.js';
import test, { expect } from '@playwright/test';
import { readFileSync, rmSync } from 'fs';
import path from 'path';
import { API_BASE_URL, BASE_URL, panelUrl, signIn } from '../util.js';

// The tests run in order and share the ids they create: one failure skips the rest.
test.describe.configure({ mode: 'serial' });

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const signInAdmin = signIn('admin2@email.com', PASSWORD);
const signInEditor = signIn('editor@email.com', PASSWORD);
const signInRegular = signIn('anonym@gmail.com', PASSWORD);

let superAdminId: string;
let editorId: string;
let editor2Id: string;
let editor3Id: string;
let adminId: string;
let admin2Id: string;

/****************************************************/
/* Init
/****************************************************/

test('Second init should return 404', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/init`, {
    data: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(404);
});

/****************************************************/
/* Login
/****************************************************/

test('Login should not be successfull', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: ADMIN_EMAIL,
      password: '12345678'
    }
  });
  expect(response.status()).toBe(401);
});

test('Superadmin login should be successfull', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: ADMIN_EMAIL,
      password: PASSWORD
    }
  });
  const json = await response.json();
  expect(json.user).toBeDefined();
  expect(json.user.id).toBeDefined();
  superAdminId = json.user.id;
});

/****************************************************/
/* Collection create / update / delete / read
/****************************************************/

let homeId: string;
let pageId: string;

test('Should not create Page with missing required title', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {}
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toContain('attributes.title');
});

test('Should create Home', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Home',
        slug: 'home'
      }
    }
  });

  const { doc } = await response.json();
  expect(doc.attributes.title).toBe('Home');
  expect(doc.createdAt).toBeDefined();
  expect(doc.id).toBeDefined();
  homeId = doc.id;
});

test('Should create a page', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Page',
        slug: 'page',
        template: 'basic'
      },
      _parent: homeId
    }
  });
  const { doc } = await response.json();
  expect(doc.attributes.title).toBe('Page');
  expect(doc.createdAt).toBeDefined();
  expect(doc.id).toBeDefined();
  expect(doc._parent).toBe(homeId);
  expect(doc.attributes.template).toBe('basic');
  pageId = doc.id;
});

test('Should return the home page', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${homeId}`).then((response) => {
    return response.json();
  });

  expect(response.doc).toBeDefined();
  expect(response.doc.attributes.title).toBe('Home');
});

test('Should return 2 pages', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages`).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(2);
});

/** ---------------- SELECT ---------------- */

test('Should return 2 pages with only attributes.slug and id prop', async ({ request }) => {
  const response = await request
    .get(`${API_BASE_URL}/pages?select=attributes.slug`)
    .then((response) => {
      return response.json();
    });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(2);
  expect(response.docs[0].id).toBeDefined();
  expect(response.docs[0].attributes.slug).toBeDefined();
  expect(response.docs[0].attributes.title).toBeUndefined();
  expect(response.docs[0].attributes.template).toBeUndefined();
  expect(response.docs[0]._parent).toBeUndefined();
  expect(response.docs[1].id).toBeDefined();
  expect(response.docs[1].attributes.slug).toBeDefined();
  expect(response.docs[1].attributes.title).toBeUndefined();
  expect(response.docs[1].attributes.template).toBeUndefined();
  expect(response.docs[1]._parent).toBeUndefined();
});

test('Should return 2 pages with only attributes slug, title and id prop', async ({ request }) => {
  const response = await request
    .get(`${API_BASE_URL}/pages?select=attributes.slug,attributes.title`)
    .then((response) => {
      return response.json();
    });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(2);
  expect(response.docs[0].id).toBeDefined();
  expect(response.docs[0].attributes.slug).toBeDefined();
  expect(response.docs[0].attributes.title).toBeDefined();
  expect(response.docs[0].attributes.template).toBeUndefined();
  expect(response.docs[0]._parent).toBeUndefined();
  expect(response.docs[1].id).toBeDefined();
  expect(response.docs[1].attributes.slug).toBeDefined();
  expect(response.docs[1].attributes.title).toBeDefined();
  expect(response.docs[1].attributes.template).toBeUndefined();
  expect(response.docs[1]._parent).toBeUndefined();
});

test('Should return page (query)', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[_parent][equals]=${homeId}`;
  const response = await request.get(url).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
  expect(response.docs[0].attributes.title).toBe('Page');
});

test('Should delete page', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/pages/${pageId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('Should return 1 page', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages`).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
});

/****************************************************/
/* Check server config has been generated (hooks should be active)
/****************************************************/

test('Server config should have hooks configured', async ({ request }) => {
  // Written by the pages beforeRead hook in lib/+rime/pages/module.server.ts
  const probeFile = path.resolve(process.cwd(), 'test-results', 'probe-hook.txt');
  rmSync(probeFile, { force: true });
  await request.get(`${API_BASE_URL}/pages`);
  expect(readFileSync(probeFile, 'utf-8')).toBe('pages beforeRead');
});

/****************************************************/
/* Offset / Limit
/****************************************************/

test('Should get correct offset / limit', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // Every page this test makes, deleted at the end
  const created: string[] = [];

  // Home leaves for the test, and is made again at the end
  const homeRemoved = await request.delete(`${API_BASE_URL}/pages/${homeId}`, { headers });
  expect(homeRemoved.status()).toBe(200);

  const COUNT = 25;
  const pad = (n: number) => n.toString().padStart(3, '0');

  // "Page 001" to "Page 025"
  for (let i = 1; i <= COUNT; i++) {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Page ' + pad(i), slug: 'page-' + pad(i) } }
    });
    expect(response.status()).toBe(200);
    created.push((await response.json()).doc.id);
  }

  // Pages of 10 by title: 001-010, 011-020, then 021-025
  for (let offset = 0; offset < COUNT; offset += 10) {
    const response = await request
      .get(`${API_BASE_URL}/pages?limit=10&offset=${offset}&sort=attributes.title`)
      .then((response) => {
        return response.json();
      });
    const titles = response.docs.map((doc: { title: string }) => doc.title);
    const last = Math.min(offset + 10, COUNT);
    expect(titles.length).toBe(last - offset);
    expect(titles.at(0)).toBe('Page ' + pad(offset + 1));
    expect(titles.at(-1)).toBe('Page ' + pad(last));
  }

  // "Other 001" to "Other 025", dated backwards: "Other 025" is the oldest, one second apart
  for (let i = 1; i <= COUNT; i++) {
    const { doc } = await request
      .post(`${API_BASE_URL}/pages`, {
        headers,
        data: { attributes: { title: 'Other ' + pad(i), slug: 'other-' + pad(i) } }
      })
      .then((r) => r.json());
    created.push(doc.id);

    const dated = await request.patch(`${API_BASE_URL}/pages/${doc.id}`, {
      headers,
      data: { createdAt: new Date(Date.UTC(2025, 4, 22) - i * 1000).toISOString() }
    });
    expect(dated.status()).toBe(200);
  }

  // Oldest first: only the dates written above put "Other 025" before "Other 001"
  for (let offset = 0; offset < COUNT; offset += 10) {
    const response = await request
      .get(
        `${API_BASE_URL}/pages?where[attributes.slug][like]=other-&limit=10&offset=${offset}&sort=createdAt`
      )
      .then((response) => {
        return response.json();
      });
    const titles = response.docs.map((doc: { title: string }) => doc.title);
    const last = Math.min(offset + 10, COUNT);
    expect(titles.length).toBe(last - offset);
    expect(titles.at(0)).toBe('Other ' + pad(COUNT - offset));
    expect(titles.at(-1)).toBe('Other ' + pad(COUNT + 1 - last));
  }

  const removed = await request.delete(
    `${API_BASE_URL}/pages?where[id][in_array]=${created.join(',')}`,
    { headers }
  );
  expect(removed.status()).toBe(200);

  // Re-create home
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: {
        title: 'Home',
        slug: 'home'
      }
    }
  });

  const { doc } = await response.json();
  homeId = doc.id;
});

/****************************************************/
/* Duplicate
/****************************************************/

test('Should duplicate a page with a new id and identical field values', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const original = await request
    .post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: {
          title: 'Duplicate source',
          slug: 'duplicate-source',
          template: 'basic'
        }
      }
    })
    .then((r) => r.json())
    .then((r) => r.doc);

  const response = await request.post(`${API_BASE_URL}/pages/${original.id}/duplicate`, {
    headers
  });
  expect(response.status()).toBe(200);
  const { id: duplicateId } = await response.json();
  expect(duplicateId).toBeDefined();
  expect(duplicateId).not.toBe(original.id);

  const duplicate = await request
    .get(`${API_BASE_URL}/pages/${duplicateId}`, { headers })
    .then((r) => r.json())
    .then((r) => r.doc);

  expect(duplicate.attributes.title).toBe('Duplicate source (copy)');
  expect(duplicate.attributes.template).toBe('basic');

  // The original must survive untouched — duplicating is not a move.
  const originalAfter = await request
    .get(`${API_BASE_URL}/pages/${original.id}`, { headers })
    .then((r) => r.json())
    .then((r) => r.doc);
  expect(originalAfter.attributes.title).toBe('Duplicate source');
  expect(originalAfter.id).toBe(original.id);

  await request.delete(`${API_BASE_URL}/pages/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
});

/****************************************************/
/* Upload Collection
/****************************************************/

let mediaId: string;
test('Should create a Media', async ({ request }) => {
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  const response = await request.post(`${API_BASE_URL}/medias`, {
    headers: await signInSuperAdmin(request),
    data: {
      file: { base64, filename: 'Land$scape -3.JPG' },
      alt: 'alt'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  mediaId = doc.id;
  expect(doc.alt).toBe('alt');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.sizes).toBeDefined();
  expect(doc.sizes.sm).toBe('/uploads/medias/landscape-3-sm-640.webp');
  expect(doc.sizes.md).toBe('/uploads/medias/landscape-3-md-1024.webp');
  expect(doc.sizes.lg).toBe('/uploads/medias/landscape-3-lg-1536.webp');
  expect(doc.sizes.xl).toBe('/uploads/medias/landscape-3-xl-2048.webp');
  expect(doc.sizes.thumbnail).toBe('/uploads/medias/landscape-3-thumbnail-400.jpg');
  expect(doc._path).toBe('root');
});

test("Should update a media path (path doesn't exists)", async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      _path: 'root:baz:biz'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc._path).toBe('root:baz:biz');
});

/****************************************************/
/* AUTH Collection
/****************************************************/

test('Should not get users', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff`);
  expect(response.status()).toBe(403);
});

// users is read by anyone. `authUserId` is a column of every auth collection that no field declares
test('Should refuse an anonymous users filter on a column no field declares', async ({
  request
}) => {
  const response = await request.get(`${API_BASE_URL}/users?where[authUserId][like]=a%25`);
  expect(response.status()).toBe(400);
});

test('Should let anyone filter users on a field anyone reads', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/users?where[website][like]=a%25`);
  expect(response.status()).toBe(200);
});

test('SuperAdmin sould not delete himself', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(403);
});

test('SuperAdmin sould not change isSuperAdmin', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      isSuperAdmin: false
    }
  });
  expect(response.status()).toBe(403);
});

test('Should get super admin user', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBe(superAdminId);
  expect(data.doc.roles).toContain('admin');
  expect(data.doc.name).toBe('Admin');
  expect(data.doc.isSuperAdmin).toBeUndefined();
});

test('Should create a user editor', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'editor@email.com',
      name: 'Chesster',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBeDefined();
  editorId = data.doc.id;
});

test('Should create a 2nd user editor', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'editor2@email.com',
      name: 'Chesster',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBeDefined();
  editor2Id = data.doc.id;
});

test('Should create another admin', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'admin2@email.com',
      name: 'Admin2',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBeDefined();
  adminId = data.doc.id;
});

test('Should create another admin (again)', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'admin3@email.com',
      name: 'Admin3',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBeDefined();
  admin2Id = data.doc.id;
});

test('Should get editor user', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${editorId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBe(editorId);
  expect(data.doc.roles).toContain('editor');
  expect(data.doc.roles).not.toContain('admin');
  expect(data.doc.name).toBe('Chesster');

  // A staff member made by an admin, not an admin, has better-auth's `staff` role
  const session = await request
    .get(`${API_BASE_URL}/auth/get-session`, { headers: await signInEditor(request) })
    .then((r) => r.json());
  expect(session.user.role).toBe('staff');
});

test('Should logout super admin', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const response = await request
    .post(`${API_BASE_URL}/auth/sign-out`, {
      headers
    })
    .then((r) => r.json());

  expect(response.success).toBe(true);
  const responseSession = await request.get(`${API_BASE_URL}/auth/get-session`, { headers });
  expect(responseSession.status()).toBe(200);
  const json = await responseSession.json();
  expect(json).toBeNull();
});

test('Should not update Home', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    data: {
      attributes: {
        title: 'Accueil',
        slug: 'accueil'
      }
    }
  });
  expect(response.status()).toBe(403);
});

test('Should not delete home', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/pages/${homeId}`);
  expect(response.status()).toBe(403);
});

test('Should not create a page', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    data: {
      attributes: {
        title: 'Page 3',
        slug: 'page-3'
      }
    }
  });
  expect(response.status()).toBe(403);
});

test('Should not update area', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    data: {
      maintenance: true
    }
  });
  expect(response.status()).toBe(403);
});

test('Admin login should be successfull', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: 'admin2@email.com',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
  const json = await response.json();
  expect(json.user).toBeDefined();
  expect(json.user.id).toBeDefined();
  adminId = json.user.id;
});

test('Admin should not delete superAdmin', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInAdmin(request)
  });
  expect(response.status()).toBe(403);
});

test('Admin should create a user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInAdmin(request),
    data: {
      email: 'editor3@foo.com',
      name: 'editor3',
      password: 'a&1Aa&1A'
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  editor3Id = data.doc.id;
});

test('Default role should be editor', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${editor3Id}`, {
    headers: await signInAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc.roles.includes('admin')).toBe(false);
  expect(data.doc.roles.includes('editor')).toBe(true);
});

test('Admin should not create an admin with isSuperAdmin', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInAdmin(request),
    data: {
      email: 'admin2@foo.com',
      name: 'admin2',
      roles: ['admin'],
      password: 'a&1Aa&1A',
      isSuperAdmin: true
    }
  });
  expect(response.status()).toBe(403);
});

// On their own document, so only the `isSuperAdmin` key can be refused, not the target
test('Admin should not update isSuperAdmin', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${adminId}`, {
    headers: await signInAdmin(request),
    data: {
      isSuperAdmin: true
    }
  });
  expect(response.status()).toBe(403);
});

test('Admin should not change superAdmin roles', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInAdmin(request),
    data: {
      roles: ['editor']
    }
  });
  expect(response.status()).toBe(403);
});

/****************************************************/
/* Area
/****************************************************/

test('Should get settings', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('Should update settings', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    headers,
    data: {
      maintenance: true
    }
  });
  expect(response.status()).toBe(200);

  const { doc } = await request.get(`${API_BASE_URL}/settings`, { headers }).then((r) => r.json());
  expect(doc.maintenance).toBe(true);
});

test('Should not get settings', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings`);
  expect(response.status()).toBe(403);
});

/** SELECT */

test('Should get settings with only id and maintenance', async ({ request }) => {
  const response = await request
    .get(`${API_BASE_URL}/settings?select=maintenance`, {
      headers: await signInSuperAdmin(request)
    })
    .then((r) => r.json());
  expect(response.doc.maintenance).toBe(true);
  expect(response.doc.id).toBeDefined();
  expect(Object.keys(response.doc).length).toBe(2);
});

/****************************************************/
/* Editor access
/****************************************************/

test('Should not logout admin user', async ({ request }) => {
  const headersAdmin = await signInSuperAdmin(request);
  const headersUser = await signInEditor(request);
  await request.post(`${API_BASE_URL}/auth/sign-out`);
  await request.post(`${API_BASE_URL}/auth/sign-out`, {
    headers: headersUser
  });
  const response = await request.get(`${API_BASE_URL}/auth/get-session`, {
    headers: headersAdmin
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.user).toBeDefined();
  expect(data.user.email).toBe(ADMIN_EMAIL);
  expect(data.session).toBeDefined();
});

test('Should login editor', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: 'editor@email.com',
      password: PASSWORD
    }
  });

  const status = response.status();
  expect(status).toBe(200);
});

test('Editor should not change its roles', async ({ request }) => {
  await request.patch(`${API_BASE_URL}/staff/${editorId}`, {
    headers: await signInEditor(request),
    data: {
      roles: ['admin']
    }
  });

  const verification = await request.get(`${API_BASE_URL}/staff/${editorId}`, {
    headers: await signInSuperAdmin(request)
  });

  const data = await verification.json();
  expect(data.doc.roles.includes('admin')).toBe(false);
  expect(data.doc.roles.includes('editor')).toBe(true);
});

test('Editor should not create a user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInEditor(request),
    data: {
      email: 'admin-by-editor@email.com',
      name: 'Admin',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(403);
});

test('Editor should not create a page', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInEditor(request),
    data: {
      attributes: {
        title: 'Page that will not be created',
        slug: 'page-that-will-not-be-created'
      }
    }
  });
  expect(response.status()).toBe(403);
});

test('Editor should not duplicate a page (duplicate requires create access)', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages/${homeId}/duplicate`, {
    headers: await signInEditor(request)
  });
  expect(response.status()).toBe(403);
});

test('Editor should update home', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    headers: await signInEditor(request),
    data: {
      attributes: {
        title: 'Home edited by editor'
      }
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc.title).toBe('Home edited by editor');
});

test('Editor should not delete superadmin', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInEditor(request)
  });
  expect(response.status()).toBe(403);
});

test('Editor should not delete admin', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${adminId}`, {
    headers: await signInEditor(request)
  });
  expect(response.status()).toBe(403);
});

test('Editor should not delete other editors', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${editor2Id}`, {
    headers: await signInEditor(request)
  });
  expect(response.status()).toBe(403);
});

test('Editor should not update admin', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${adminId}`, {
    headers: await signInEditor(request),
    data: {
      roles: ['editor']
    }
  });
  expect(response.status()).toBe(403);
});

test('Editor should not update superadmin', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInEditor(request),
    data: {
      roles: ['editor']
    }
  });
  expect(response.status()).toBe(403);
});

test('Editor should not update other editors', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${editor2Id}`, {
    headers: await signInEditor(request),
    data: {
      roles: ['editor']
    }
  });
  expect(response.status()).toBe(403);
});

test('Should logout editor', async ({ request }) => {
  const headers = await signInEditor(request);
  const response = await request
    .post(`${API_BASE_URL}/auth/sign-out`, {
      headers
    })
    .then((r) => r.json());

  expect(response.success).toBe(true);
  const responseSession = await request.get(`${API_BASE_URL}/auth/get-session`, { headers });
  expect(responseSession.status()).toBe(200);
  const json = await responseSession.json();
  expect(json).toBeNull();
});

/****************************************************/
/* Users access
/****************************************************/

test('Should not create a user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/users`, {
    data: {
      name: 'Regular',
      email: 'anonym@gmail.com',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(403);
});

test('Should create a user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/users`, {
    headers: await signInAdmin(request),
    data: {
      name: 'Regular',
      email: 'anonym@gmail.com',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
});

let regularId: string;
test('Should login user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: 'anonym@gmail.com',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.user).toBeDefined();
  regularId = data.user.id;
});

let editorMadeId: string;
const signInEditorMade = signIn('editor-made@email.com', PASSWORD);

test('Editor should create a user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/users`, {
    headers: await signInEditor(request),
    data: { name: 'Editor made', email: 'editor-made@email.com', password: PASSWORD }
  });
  expect(response.status()).toBe(200);
  editorMadeId = (await response.json()).doc.id;

  // A member made by a staff member has better-auth's `user` role
  const session = await request
    .get(`${API_BASE_URL}/auth/get-session`, { headers: await signInEditorMade(request) })
    .then((r) => r.json());
  expect(session.user.role).toBe('user');
});

test('A user should delete their own account', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/users/${editorMadeId}`, {
    headers: await signInEditorMade(request)
  });
  expect(response.status()).toBe(200);

  // The better-auth account went with the document
  const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email: 'editor-made@email.com', password: PASSWORD }
  });
  expect(signInResponse.status()).toBe(401);
});

test('Editor should not reach the better-auth admin endpoints', async ({ request }) => {
  const headers = await signInEditor(request);

  const list = await request.get(`${API_BASE_URL}/auth/admin/list-users`, { headers });
  expect(list.status()).toBe(404);

  const remove = await request.post(`${API_BASE_URL}/auth/admin/remove-user`, {
    headers,
    data: { userId: regularId }
  });
  expect(remove.status()).toBe(404);
});

test('Admin should not reach the super-admin through the better-auth admin endpoints', async ({
  request
}) => {
  // get-session answers the better-auth user, whose id the admin endpoints take
  const superAdminSession = await request
    .get(`${API_BASE_URL}/auth/get-session`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());
  const superAdminAuthUserId = superAdminSession.user.id;
  const headers = await signInAdmin(request);

  const setPassword = await request.post(`${API_BASE_URL}/auth/admin/set-user-password`, {
    headers,
    data: { userId: superAdminAuthUserId, newPassword: 'b&2Bb&2B' }
  });
  expect(setPassword.status()).toBe(404);

  const remove = await request.post(`${API_BASE_URL}/auth/admin/remove-user`, {
    headers,
    data: { userId: superAdminAuthUserId }
  });
  expect(remove.status()).toBe(404);

  const signInResponse = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: PASSWORD }
  });
  expect(signInResponse.status()).toBe(200);
});

test('A staff member should not delete their own account through better-auth', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/auth/delete-user`, {
    headers: await signInEditor(request),
    data: { password: PASSWORD }
  });
  expect(response.status()).toBe(404);

  const staff = await request.get(`${API_BASE_URL}/staff/${editorId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(staff.status()).toBe(200);
});

test('A user should not move their session to another collection', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/update-user`, {
    headers: await signInEditor(request),
    data: { type: 'apps' }
  });
  expect(response.status()).toBe(404);
});

test('A user who is not staff cannot claim an edit lock', async ({ request }) => {
  const claim = await request.post(`${API_BASE_URL}/users/${regularId}/lock`, {
    headers: await signInRegular(request)
  });
  expect(claim.status()).toBe(403);
});

test('An anonymous delete of a whole list is refused', async ({ request }) => {
  // A filter that matches every user: the refusal is the delete access, not the missing filter
  const response = await request.delete(`${API_BASE_URL}/users?where[email][like]=%25`);
  expect(response.status()).toBe(403);
});

test('Should not link a new user to an existing account', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/users`, {
    data: { name: 'Intruder', email: 'intruder@gmail.com', authUserId: regularId }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not create pages', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInRegular(request),
    data: {
      attributes: {
        title: 'not working',
        slug: 'not-working'
      }
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not create other users', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/users`, {
    headers: await signInRegular(request),
    data: {
      name: 'Nope',
      email: 'nope@nope.fr',
      password: 'nop3Z0PEE!'
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not update infos', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInRegular(request),
    data: {
      email: 'nope@nope.fr'
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not update settings', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    headers: await signInRegular(request),
    data: {
      maintenance: false
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not create news', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/news`, {
    headers: await signInRegular(request),
    data: {
      attributes: {
        title: 'not working',
        slug: 'not-working'
      }
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should update his website', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/users/${regularId}`, {
    headers: await signInRegular(request),
    data: {
      website: 'www.regular.com'
    }
  });
  expect(response.status()).toBe(200);
});

test('Regular should not update his email', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/users/${regularId}`, {
    headers: await signInRegular(request),
    data: {
      email: 'foo@regular.com'
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not update his own roles', async ({ request }) => {
  await request.patch(`${API_BASE_URL}/users/${regularId}`, {
    headers: await signInRegular(request),
    data: { roles: ['member'] }
  });

  const { doc } = await request
    .get(`${API_BASE_URL}/users/${regularId}`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());
  expect(doc.roles).toEqual(['user']);
});

test('Regular should not update a page', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    headers: await signInRegular(request),
    data: {
      attributes: {
        title: "Haha I've changed the title!"
      }
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not create a staff user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInRegular(request),
    data: {
      email: 'admin@regular.com',
      name: 'Regular',
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(403);
});

test('Regular should not update a staff user', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${editorId}`, {
    headers: await signInRegular(request),
    data: {
      roles: ['admin']
    }
  });
  expect(response.status()).toBe(403);
});

// The member's own `users` document: only the `roles` field rule can keep the role out
for (const role of ['admin', 'app', 'editor', 'other-role']) {
  test(`Regular should not give himself the ${role} role`, async ({ request }) => {
    await request.patch(`${API_BASE_URL}/users/${regularId}`, {
      headers: await signInRegular(request),
      data: { roles: [role] }
    });

    const { doc } = await request
      .get(`${API_BASE_URL}/users/${regularId}`, { headers: await signInSuperAdmin(request) })
      .then((r) => r.json());
    expect(doc.roles).toEqual(['user']);
  });
}

test('Regular should not update a media', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInRegular(request),
    data: {
      _path: 'root',
      alt: 'hacked'
    }
  });
  const status = response.status();
  expect(status).toBe(403);
});

test('Admin should delete editor', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${editorId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('Admin should delete admin', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${admin2Id}`, {
    headers: await signInAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('SuperAdmin should delete admin', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/staff/${adminId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

/****************************************************/
/* Signup
/****************************************************/

test('Should not public sign-up as staff', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
    data: {
      email: 'public@public.com',
      password: 'e"3Ee"3E',
      type: 'staff'
    }
  });
  expect(response.status()).toBe(401);

  // No account was written
  const signInAfter = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email: 'public@public.com', password: 'e"3Ee"3E' }
  });
  expect(signInAfter.status()).toBe(401);
});

// users lets anyone create: a public sign-up goes through
test('Should public sign-up as a user', async ({ request }) => {
  const email = `signup-${Date.now()}@public.com`;
  const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
    data: { email, name: 'Signed up', password: 'e"3Ee"3E', type: 'users' }
  });
  expect(response.status()).toBe(200);

  const signedIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email, password: 'e"3Ee"3E' }
  });
  expect(signedIn.status()).toBe(200);

  // A public sign-up has better-auth's `user` role
  const session = await request
    .get(`${API_BASE_URL}/auth/get-session`, {
      headers: await signIn(email, 'e"3Ee"3E')(request)
    })
    .then((r) => r.json());
  expect(session.user.role).toBe('user');

  const { docs } = await request
    .get(`${API_BASE_URL}/users?where[email][equals]=${encodeURIComponent(email)}`, {
      headers: await signInSuperAdmin(request)
    })
    .then((r) => r.json());
  expect(docs).toHaveLength(1);
});

// apps is an API-key collection, pages is no auth collection, nope is none at all: each is refused
// before an account is written
for (const [type, extra] of [
  ['apps', {}],
  ['pages', { attributes: { title: 'Signed-up page', slug: 'signed-up-page' } }],
  ['nope', {}]
] as const) {
  test(`Should not public sign-up to ${type}`, async ({ request }) => {
    const email = `signup-${type}-${Date.now()}@public.com`;
    const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
      data: { email, name: 'Refused', password: 'e"3Ee"3E', type, ...extra }
    });
    expect(response.status()).toBe(401);

    const signedIn = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: { email, password: 'e"3Ee"3E' }
    });
    expect(signedIn.status()).toBe(401);

    if (type === 'pages') {
      const { docs } = await request
        .get(`${API_BASE_URL}/pages?where[attributes.title][equals]=Signed-up page`, {
          headers: await signInSuperAdmin(request)
        })
        .then((r) => r.json());
      expect(docs).toHaveLength(0);
    }
  });
}

/****************************************************/
/* Duplicate — deeply nested structure (relation
/* inside a group, a block, a tree inside a block, and
/* a blocks field nested inside another block), checking
/* every relation and nested item survives the copy
/* with its own id (relation targets untouched)
/****************************************************/

test('Should duplicate a page with nested relations, blocks, and a tree inside a block', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const mediaA = await request
    .post(`${API_BASE_URL}/medias`, {
      headers,
      data: {
        file: {
          base64: await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg')),
          filename: 'dup-nested-a.jpg'
        },
        alt: 'Media A'
      }
    })
    .then((r) => r.json())
    .then((r) => r.doc);

  const mediaB = await request
    .post(`${API_BASE_URL}/medias`, {
      headers,
      data: {
        file: {
          base64: await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg')),
          filename: 'dup-nested-b.jpg'
        },
        alt: 'Media B'
      }
    })
    .then((r) => r.json())
    .then((r) => r.doc);

  const original = await request
    .post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: {
          title: 'Nested source',
          slug: 'nested-source',
          summary: { thumbnail: mediaA.id }
        },
        layout: {
          hero: { title: 'Hero', image: mediaB.id },
          sections: [
            { type: 'image', image: mediaA.id },
            {
              type: 'keyFacts',
              facts: [
                { title: 'Fact one', icon: 'one', image: mediaA.id },
                { title: 'Fact two', icon: 'two', image: mediaB.id }
              ]
            },
            { type: 'black', title: 'Black section', text: [{ type: 'image', image: mediaB.id }] }
          ]
        }
      }
    })
    .then((r) => r.json())
    .then((r) => r.doc);

  expect(original.layout.sections).toHaveLength(3);

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(original.id);

  const duplicate = await request
    .get(`${API_BASE_URL}/pages/${duplicateId}`, { headers })
    .then((r) => r.json())
    .then((r) => r.doc);

  // Relation nested inside a group — same target, untouched.
  expect(duplicate.attributes.summary.thumbnail.map((ref: any) => ref.documentId)).toContain(
    mediaA.id
  );
  // Relation directly on a group field.
  expect(duplicate.layout.hero.image.map((ref: any) => ref.documentId)).toContain(mediaB.id);

  expect(duplicate.layout.sections).toHaveLength(3);

  // Relation on a plain block.
  expect(duplicate.layout.sections[0].type).toBe('image');
  expect(duplicate.layout.sections[0].image.map((ref: any) => ref.documentId)).toContain(mediaA.id);
  expect(duplicate.layout.sections[0].id).not.toBe(original.layout.sections[0].id);

  // Tree nested inside a block, three levels deep (sections.N.facts.M.image)
  // — each fact's own relation must follow it, and every level gets a fresh id.
  const dupKeyFacts = duplicate.layout.sections[1];
  const origKeyFacts = original.layout.sections[1];
  expect(dupKeyFacts.type).toBe('keyFacts');
  expect(dupKeyFacts.id).not.toBe(origKeyFacts.id);
  expect(dupKeyFacts.facts).toHaveLength(2);
  expect(dupKeyFacts.facts[0].title).toBe('Fact one');
  expect(dupKeyFacts.facts[0].image.map((ref: any) => ref.documentId)).toContain(mediaA.id);
  expect(dupKeyFacts.facts[0].id).not.toBe(origKeyFacts.facts[0].id);
  expect(dupKeyFacts.facts[1].title).toBe('Fact two');
  expect(dupKeyFacts.facts[1].image.map((ref: any) => ref.documentId)).toContain(mediaB.id);
  expect(dupKeyFacts.facts[1].id).not.toBe(origKeyFacts.facts[1].id);

  // A blocks field nested inside another block — its own relation must
  // survive too, and its id must be fresh, same as any other block.
  const dupBlack = duplicate.layout.sections[2];
  const origBlack = original.layout.sections[2];
  expect(dupBlack.type).toBe('black');
  expect(dupBlack.id).not.toBe(origBlack.id);
  expect(dupBlack.text).toHaveLength(1);
  expect(dupBlack.text[0].type).toBe('image');
  expect(dupBlack.text[0].image.map((ref: any) => ref.documentId)).toContain(mediaB.id);
  expect(dupBlack.text[0].id).not.toBe(origBlack.text[0].id);

  // The original must be entirely untouched — same ids throughout.
  const originalAfter = await request
    .get(`${API_BASE_URL}/pages/${original.id}`, { headers })
    .then((r) => r.json())
    .then((r) => r.doc);
  expect(originalAfter.layout.sections[1].facts[0].id).toBe(origKeyFacts.facts[0].id);
  expect(
    originalAfter.layout.sections[1].facts[0].image.map((ref: any) => ref.documentId)
  ).toContain(mediaA.id);

  await request.delete(`${API_BASE_URL}/pages/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${mediaA.id}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${mediaB.id}`, { headers });
});

/****************************************************/
/* API Key (apps collection)
/****************************************************/

let appId: string;
let appApiKey: string;

test('Regular should not create an api key app', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/apps`, {
    headers: await signInRegular(request),
    data: { name: 'Should fail' }
  });
  expect(response.status()).toBe(403);
});

test('Admin should create an api key app', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/apps`, {
    headers: await signInSuperAdmin(request),
    data: { name: 'My App' }
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc.id).toBeDefined();
  // apiKeyId is server-side only (PRIVATE_FIELDS), never exposed to clients
  expect(data.doc.apiKeyId).toBeUndefined();
  // The plaintext key is only ever exposed once, on creation
  expect(data.doc.apiKey).toBeDefined();
  appId = data.doc.id;
  appApiKey = data.doc.apiKey;
});

test('A key alone is its app: the `apps` role reads nothing, every time', async ({ request }) => {
  // No session in this context: the key is the only credential
  for (let i = 0; i < 12; i++) {
    const response = await request.get(`${API_BASE_URL}/apps`, {
      headers: { 'x-api-key': appApiKey }
    });
    // 403, never the 401 of a key past a daily quota
    expect(response.status()).toBe(403);
  }
});

test('A key never opens the panel', async ({ request }) => {
  const response = await request.get(panelUrl(), {
    headers: { 'x-api-key': appApiKey },
    maxRedirects: 0
  });
  expect(response.status()).toBe(401);
});

test('Admin should create an api key app even when the body carries an authUserId', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const response = await request.post(`${API_BASE_URL}/apps`, {
    headers,
    data: { name: 'Other App', authUserId: regularId }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  // The key exists: the request took the API-key path, not the sign-up one
  expect(doc.apiKey).toBeDefined();
  await request.delete(`${API_BASE_URL}/apps/${doc.id}`, { headers });
});

test('Should list apps as admin', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/apps`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('An app read carries no private auth field', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/apps/${appId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.id).toBe(appId);
  // PRIVATE_FIELDS, core/auth/constant.server.ts: both are columns of an api-key collection
  expect(doc.apiKeyId).toBeUndefined();
  expect(doc.authUserId).toBeUndefined();
});

test('An invalid api key should be rejected', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const response = await request.get(`${API_BASE_URL}/apps`, {
    headers: { ...headers, 'x-api-key': 'not-a-real-key' }
  });
  expect(response.status()).toBe(401);
});

test('A valid api key overrides the request roles to its own scope', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // Even though the session belongs to a superadmin, the api key only
  // carries the 'apps' role, so admin-gated access should now be denied
  const response = await request.get(`${API_BASE_URL}/apps`, {
    headers: { ...headers, 'x-api-key': appApiKey }
  });
  expect(response.status()).toBe(403);
});

test('Changing the roles of an app changes the roles of its key', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const update = await request.patch(`${API_BASE_URL}/apps/${appId}`, {
    headers,
    data: { roles: ['reports'] }
  });
  expect(update.status()).toBe(200);

  // `reports` may read the apps, `apps` may not
  const response = await request.get(`${API_BASE_URL}/apps`, {
    headers: { ...headers, 'x-api-key': appApiKey }
  });
  expect(response.status()).toBe(200);
});

test('An admin should delete a key another admin created', async ({ request }) => {
  const superAdminHeaders = await signInSuperAdmin(request);
  const keysAdmin = await request.post(`${API_BASE_URL}/staff`, {
    headers: superAdminHeaders,
    data: {
      email: 'keys-admin@email.com',
      name: 'Keys admin',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(keysAdmin.status()).toBe(200);
  const keysAdminId = (await keysAdmin.json()).doc.id;

  const created = await request.post(`${API_BASE_URL}/apps`, {
    headers: await signIn('keys-admin@email.com', PASSWORD)(request),
    data: { name: 'Keys admin app' }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  const deleted = await request.delete(`${API_BASE_URL}/apps/${doc.id}`, {
    headers: superAdminHeaders
  });
  expect(deleted.status()).toBe(200);

  const withKey = await request.get(`${API_BASE_URL}/apps`, {
    headers: { ...superAdminHeaders, 'x-api-key': doc.apiKey }
  });
  expect(withKey.status()).toBe(401);

  await request.delete(`${API_BASE_URL}/staff/${keysAdminId}`, { headers: superAdminHeaders });
});

test('An admin key passes while the staff member who made it is an admin', async ({
  request,
  playwright
}) => {
  const superAdminHeaders = await signInSuperAdmin(request);
  const maker = await request.post(`${API_BASE_URL}/staff`, {
    headers: superAdminHeaders,
    data: { email: 'key-maker@email.com', name: 'Key maker', roles: ['admin'], password: PASSWORD }
  });
  expect(maker.status()).toBe(200);
  const makerId = (await maker.json()).doc.id;

  const created = await request.post(`${API_BASE_URL}/apps`, {
    headers: await signIn('key-maker@email.com', PASSWORD)(request),
    data: { name: 'Admin app', roles: ['admin'] }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  // A context with no cookie: the key alone
  const keyOnly = await playwright.request.newContext();
  const asAdmin = await keyOnly.get(`${API_BASE_URL}/apps`, {
    headers: { 'x-api-key': doc.apiKey }
  });
  expect(asAdmin.status()).toBe(200);

  // Demoted: the member's better-auth role becomes `staff`, and the key carries `admin` no more
  const demoted = await request.patch(`${API_BASE_URL}/staff/${makerId}`, {
    headers: superAdminHeaders,
    data: { roles: ['editor'] }
  });
  expect(demoted.status()).toBe(200);
  const afterDemotion = await keyOnly.get(`${API_BASE_URL}/apps`, {
    headers: { 'x-api-key': doc.apiKey }
  });
  expect(afterDemotion.status()).toBe(401);

  await keyOnly.dispose();
  await request.delete(`${API_BASE_URL}/apps/${doc.id}`, { headers: superAdminHeaders });
  await request.delete(`${API_BASE_URL}/staff/${makerId}`, { headers: superAdminHeaders });
});

test('Admin should delete the api key app', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/apps/${appId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('A deleted api key should no longer authenticate', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const response = await request.get(`${API_BASE_URL}/apps`, {
    headers: { ...headers, 'x-api-key': appApiKey }
  });
  expect(response.status()).toBe(401);
});

/****************************************************/
/* Authorship — createdBy / updatedBy
/****************************************************/

const signInAuthor = signIn('author@email.com', PASSWORD);
const signInReviser = signIn('reviser@email.com', PASSWORD);

let authorId: string;
let reviserId: string;
let authoredPageId: string;

test('Should create the two authorship users', async ({ request }) => {
  const author = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'author@email.com',
      name: 'Author',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(author.status()).toBe(200);
  authorId = (await author.json()).doc.id;

  const reviser = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'reviser@email.com',
      name: 'Reviser',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  expect(reviser.status()).toBe(200);
  reviserId = (await reviser.json()).doc.id;
});

test('A staff document carries the user that created it', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${authorId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(superAdminId);
  expect(doc.updatedBy?.id).toBe(superAdminId);
});

test('Create stamps createdBy and updatedBy with the same user', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInAuthor(request),
    data: {
      attributes: {
        title: 'Authored page',
        slug: 'authored-page'
      }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(authorId);
  expect(doc.updatedBy?.id).toBe(authorId);
  authoredPageId = doc.id;
});

test('Update moves updatedBy and leaves createdBy alone', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInReviser(request),
    data: {
      attributes: {
        title: 'Authored page, revised'
      }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(authorId);
  expect(doc.updatedBy?.id).toBe(reviserId);
});

test('A read leaves both stamps untouched', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(authorId);
  expect(doc.updatedBy?.id).toBe(reviserId);
});

test('A second update by the original author moves updatedBy back', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInAuthor(request),
    data: {
      attributes: {
        title: 'Authored page, revised twice'
      }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(authorId);
  expect(doc.updatedBy?.id).toBe(authorId);
});

test('Deleting the author nulls createdBy and leaves the document', async ({ request }) => {
  // One last write by the reviser, so the two columns hold different users going in.
  const update = await request.patch(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInReviser(request),
    data: { attributes: { title: 'Authored page, last revision' } }
  });
  expect(update.status()).toBe(200);

  const remove = await request.delete(`${API_BASE_URL}/staff/${authorId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(remove.status()).toBe(200);

  // `onDelete: 'set null'` — the document outlives its author and loses the attribution.
  const response = await request.get(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy).toBeFalsy();
  expect(doc.updatedBy?.id).toBe(reviserId);
});

/****************************************************/
/* Field exposure — auth fields and metas
/****************************************************/

test('An editor can read a staff document', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInReviser(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.name).toBeDefined();
  expect(doc.email).toBe(ADMIN_EMAIL);
});

test('An editor does not get roles back', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInReviser(request)
  });
  const { doc } = await response.json();
  // The collection is readable by any staff member, the `roles` field only by an admin.
  expect(doc.roles).toBeUndefined();
});

test('An admin does get roles back', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await response.json();
  expect(Array.isArray(doc.roles)).toBe(true);
});

test('Private auth fields never leave the server', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/staff/${superAdminId}`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await response.json();
  expect(doc.id).toBe(superAdminId);
  // PRIVATE_FIELDS, core/auth/constant.server.ts — stripped for everyone, superadmin included.
  // These two are columns of staff; an app's `apiKeyId` is checked with the api keys above.
  expect(doc.isSuperAdmin).toBeUndefined();
  expect(doc.authUserId).toBeUndefined();
});

test('An anonymous read of a public collection carries no lock metas', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${authoredPageId}`);
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  // `currentlyEditedBy` / `currentlyEditedAt` are `.access({ read: isStaff })`.
  expect(doc.currentlyEditedBy).toBeUndefined();
  expect(doc.currentlyEditedAt).toBeUndefined();
});

test('An anonymous read carries no authorship stamps', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${authoredPageId}`);
  const { doc } = await response.json();
  // Staff user ids, on a collection anybody can read.
  expect(doc.createdBy).toBeUndefined();
  expect(doc.updatedBy).toBeUndefined();
});

test('A staff read carries the authorship stamps', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await response.json();
  expect(doc.updatedBy?.id).toBe(reviserId);
});

test('A staff user can claim the edit lock', async ({ request }) => {
  const claim = await request.post(`${API_BASE_URL}/pages/${authoredPageId}/lock`, {
    headers: await signInReviser(request)
  });
  expect(claim.status()).toBe(200);
  expect((await claim.json()).held).toBe(true);
});

test('Claiming a document somebody else holds answers held: false', async ({ request }) => {
  const claim = await request.post(`${API_BASE_URL}/pages/${authoredPageId}/lock`, {
    headers: await signInSuperAdmin(request)
  });
  expect(claim.status()).toBe(200);
  expect((await claim.json()).held).toBe(false);
});

test('The lock never reaches an API read, staff or not', async ({ request, playwright }) => {
  // `deletePanelLockMetas` drops both fields off every read that is not a panel read, so a
  // superadmin over REST sees no more than an anonymous visitor.
  const asStaff = await request
    .get(`${API_BASE_URL}/pages/${authoredPageId}`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());
  expect(asStaff.doc.currentlyEditedBy).toBeUndefined();
  expect(asStaff.doc.currentlyEditedAt).toBeUndefined();

  // A fresh context: `request` keeps the superadmin's cookie from the sign-in above
  const anonymousContext = await playwright.request.newContext();
  const anonymous = await anonymousContext
    .get(`${API_BASE_URL}/pages/${authoredPageId}`)
    .then((r) => r.json());
  await anonymousContext.dispose();
  expect(anonymous.doc.currentlyEditedBy).toBeUndefined();
  expect(anonymous.doc.currentlyEditedAt).toBeUndefined();
});

test('Neither claim nor release works without credentials', async ({ request }) => {
  const claim = await request.post(`${API_BASE_URL}/pages/${authoredPageId}/lock`);
  expect(claim.status()).toBe(403);

  const release = await request.delete(`${API_BASE_URL}/pages/${authoredPageId}/lock`);
  expect(release.status()).toBe(403);
});

test('Releasing frees the document for somebody else', async ({ request }) => {
  test.setTimeout(45_000);
  const release = await request.delete(`${API_BASE_URL}/pages/${authoredPageId}/lock`, {
    headers: await signInReviser(request)
  });
  expect(release.status()).toBe(200);

  // A release leaves the claim alive for EDIT_LOCK_TTL_AFTER_CLOSE_MS, so a refresh can take it
  // back. After that, anybody's claim takes the document. Without the release, the reviser's
  // claim would hold for EDIT_LOCK_TTL_MS and this claim would answer held: false.
  await new Promise((resolve) => setTimeout(resolve, EDIT_LOCK_TTL_AFTER_CLOSE_MS + 1000));
  const claim = await request.post(`${API_BASE_URL}/pages/${authoredPageId}/lock`, {
    headers: await signInSuperAdmin(request)
  });
  expect(claim.status()).toBe(200);
  expect((await claim.json()).held).toBe(true);
});

test('None of that moved updatedBy', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${authoredPageId}`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await response.json();
  // The lock endpoint writes through `updateWhere`, so it cuts no version and stamps nobody.
  expect(doc.updatedBy?.id).toBe(reviserId);
});

/****************************************************/
/* Urls
/****************************************************/

// $url puts the page marked isHome at the root, and leaves the root `home` segment out of the
// pages under it. The front route serves each page at its url.
test('The home page is at the root; its children have no home segment', async ({
  request,
  playwright
}) => {
  const headers = await signInSuperAdmin(request);
  const BASE = BASE_URL;

  const marked = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    headers,
    data: { attributes: { isHome: true } }
  });
  const { doc: home } = await marked.json();
  expect(home._slug).toBe('home');
  expect(home.url).toBe(`${BASE}/`);

  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { attributes: { title: 'About us', slug: 'about-us' }, _parent: homeId }
  });
  const { doc: about } = await created.json();
  expect(about._urlPath).toBe('home/about-us');
  expect(about.url).toBe(`${BASE}/about-us`);

  const found = await request
    .get(`${API_BASE_URL}/pages?where[url][equals]=${encodeURIComponent(`${BASE}/`)}`)
    .then((response) => response.json());
  expect(found.docs.map((doc: { id: string }) => doc.id)).toEqual([homeId]);

  // A list answers the same urls as the pages read one by one.
  const { docs } = await request
    .get(`${API_BASE_URL}/pages?where[_parent][equals]=${homeId}`)
    .then((response) => response.json());
  expect(docs.map((doc: { id: string }) => doc.id)).toEqual([about.id]);
  for (const doc of docs) {
    const { doc: one } = await request
      .get(`${API_BASE_URL}/pages/${doc.id}`)
      .then((response) => response.json());
    expect(doc.url).toBe(one.url);
  }

  const { doc: team } = await request
    .post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Team', slug: 'team' }, _parent: about.id }
    })
    .then((response) => response.json());
  expect(team.url).toBe(`${BASE}/about-us/team`);

  // A `home` page that is not at the root keeps its segment. The address slug comes from the title.
  const { doc: blog } = await request
    .post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Blog', slug: 'blog' } }
    })
    .then((response) => response.json());
  const { doc: blogHome } = await request
    .post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Home', slug: 'home' }, _parent: blog.id }
    })
    .then((response) => response.json());
  expect(blogHome._urlPath).toBe('blog/home');
  expect(blogHome.url).toBe(`${BASE}/blog/home`);

  // A fresh context: `request` keeps the superadmin's cookie from the sign-in above
  const anonymous = await playwright.request.newContext();
  expect((await anonymous.get(`${BASE}/about-us`)).status()).toBe(200);
  expect((await anonymous.get(`${BASE}/about-us/team`)).status()).toBe(200);
  await anonymous.dispose();

  await request.delete(`${API_BASE_URL}/pages/${blogHome.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${blog.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${team.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${about.id}`, { headers });
  await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    headers,
    data: { attributes: { isHome: false } }
  });
});

// One page at a time is marked home: marking another one un-marks the first
test('Marking a second page as home un-marks the first', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    headers,
    data: { attributes: { isHome: true } }
  });

  const { doc: other } = await request
    .post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Other home', slug: 'other-home', isHome: true } }
    })
    .then((response) => response.json());
  expect(other.attributes.isHome).toBe(true);

  const { doc: home } = await request
    .get(`${API_BASE_URL}/pages/${homeId}`, { headers })
    .then((response) => response.json());
  expect(home.attributes.isHome).toBe(false);

  await request.delete(`${API_BASE_URL}/pages/${other.id}`, { headers });
});

// The news url is the address the `(front)/[parentSlug=news]` route serves
test('A news item is served at its url', async ({ request, playwright }) => {
  const headers = await signInSuperAdmin(request);
  const { doc } = await request
    .post(`${API_BASE_URL}/news`, {
      headers,
      data: { attributes: { title: 'Hello news', slug: 'hello-news' } }
    })
    .then((response) => response.json());
  expect(doc.url).toBe(`${BASE_URL}/news/${doc.attributes.slug}`);

  // A fresh context: `request` keeps the superadmin's cookie from the sign-in above
  const anonymous = await playwright.request.newContext();
  expect((await anonymous.get(doc.url)).status()).toBe(200);
  await anonymous.dispose();

  await request.delete(`${API_BASE_URL}/news/${doc.id}`, { headers });
});

/****************************************************
/* CORS
/****************************************************/

test('Should allow credentials on a preflight from a trusted origin', async ({ request }) => {
  const response = await request.fetch(`${API_BASE_URL}/pages`, {
    method: 'OPTIONS',
    headers: { origin: BASE_URL, 'access-control-request-method': 'PATCH' }
  });
  expect(response.status()).toBe(204);
  expect(response.headers()['access-control-allow-credentials']).toBe('true');
  expect(response.headers()['access-control-allow-origin']).toBe(BASE_URL);
});

// No page has the slug `apiary`: the front route answers its own 404, not a CORS 403
test('Should leave a site path that starts with /api out of the CORS check', async ({
  request
}) => {
  const response = await request.get(`${BASE_URL}/apiary`, {
    headers: { origin: 'https://untrusted.example' }
  });
  expect(response.status()).toBe(404);
});

// At depth 0 a relation reads as a reference (`documentId`), at depth 1 as the related document
test('Should read an empty ?depth= as 0, on an area and on a collection document', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const logo = await request.patch(`${API_BASE_URL}/settings`, {
    headers,
    data: { logo: mediaId }
  });
  expect(logo.status()).toBe(200);
  const area = await request.get(`${API_BASE_URL}/settings?depth=`, { headers });
  expect(area.status()).toBe(200);
  const areaLogo = (await area.json()).doc.logo[0];
  expect(areaLogo.documentId).toBe(mediaId);
  expect(areaLogo.filename).toBeUndefined();

  const created = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: 'Depth page', slug: 'depth-page', summary: { thumbnail: mediaId } }
    }
  });
  expect(created.status()).toBe(200);
  const { id } = (await created.json()).doc;
  const one = await request.get(`${API_BASE_URL}/pages/${id}?depth=`, { headers });
  expect(one.status()).toBe(200);
  const thumbnail = (await one.json()).doc.attributes.summary.thumbnail[0];
  expect(thumbnail.documentId).toBe(mediaId);
  expect(thumbnail.filename).toBeUndefined();

  await request.delete(`${API_BASE_URL}/pages/${id}`, { headers });
});
