import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);
const signInEditor = signIn('editor@email.com', PASSWORD);

// The tests run in order and share the ids they create: one failure skips the rest.
test.describe.configure({ mode: 'serial' });

/** The JSON of a response that must be a 200: a failed write stops the test where it happened. */
const okJson = async (response: APIResponse) => {
  expect(response.status()).toBe(200);
  return response.json();
};

/** The ids of a list of documents, or of relations read at depth 1. */
const idsOf = (docs: { id: string }[]) => docs.map((doc) => doc.id);

let adminUserId: string;

// The super admin's id, which the pages below take as their author. tests/basic/api.test.ts
// covers the sign-in itself.
test.beforeAll(async ({ request }) => {
  const { user } = await okJson(
    await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
      data: { email: ADMIN_EMAIL, password: PASSWORD }
    })
  );
  adminUserId = user.id;
});

/****************************************************
/* Collections
/****************************************************/

let homeId: string;
let pageId: string;
let editorUserId: string;

/**
 * Offset limit
 */
test('Should get correct offset / limit', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const to3digits = (n: number) => n.toString().padStart(3, '0');
  const COUNT = 25;

  // "Page 001" to "Page 025"
  for (let i = 1; i <= COUNT; i++) {
    const response = await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: {
          title: 'Page ' + to3digits(i),
          slug: 'page-' + to3digits(i)
        }
      }
    });
    expect(response.status()).toBe(200);
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
    expect(titles.at(0)).toBe('Page ' + to3digits(offset + 1));
    expect(titles.at(-1)).toBe('Page ' + to3digits(last));
  }

  // "Other 001" to "Other 025"
  for (let i = 1; i <= COUNT; i++) {
    await okJson(
      await request.post(`${API_BASE_URL}/pages`, {
        headers,
        data: {
          attributes: {
            title: 'Other ' + to3digits(i),
            slug: 'other-' + to3digits(i)
          }
        }
      })
    );
  }

  // The same pages of 10, filtered and oldest first
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
    expect(titles.at(0)).toBe('Other ' + to3digits(offset + 1));
    expect(titles.at(-1)).toBe('Other ' + to3digits(last));
  }

  // Clean, delete all pages
  let allPages = await request
    .get(`${API_BASE_URL}/pages`)
    .then((r) => r.json())
    .then((r) => r.docs);

  expect(allPages).toBeDefined();
  expect(allPages.length).toBe(COUNT * 2);

  const ids = allPages.map((p: { id: string }) => p.id).join(',');
  await okJson(
    await request.delete(`${API_BASE_URL}/pages?where[id][in_array]=${ids}`, {
      headers
    })
  );

  allPages = await request
    .get(`${API_BASE_URL}/pages`)
    .then((r) => r.json())
    .then((r) => r.docs);
  expect(allPages).toBeDefined();
  expect(allPages.length).toBe(0);
});

test('Should create Home', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Accueil',
        slug: 'accueil',
        isHome: true,
        author: adminUserId
      }
    }
  });

  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Accueil');
  expect(doc.attributes.isHome).toBe(true);
  expect(doc.id).toBeDefined();
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('fr');
  expect(doc.createdAt).toBeDefined();
  expect(doc.attributes.author).toBeDefined();
  expect(doc.attributes.author).toHaveLength(1);
  expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
  homeId = doc.id;
});

test('Should get Home EN with FR data', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${homeId}?locale=en`);
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Accueil');
  expect(doc.locale).toBe('en');
  expect(doc.attributes.slug).toBe('accueil');
  expect(doc.attributes.author).toBeDefined();
  expect(doc.attributes.author).toHaveLength(1);
  expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should set Home title/slug EN to Home/home', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${homeId}?locale=en`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Home',
        slug: 'home'
      }
    }
  });

  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Home');
  expect(doc.locale).toBe('en');
  expect(doc.attributes.slug).toBe('home');
  expect(doc.attributes.author).toBeDefined();
  expect(doc.attributes.author).toHaveLength(1);
  expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should get Home FR with still FR data', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${homeId}?locale=fr`);
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Accueil');
  expect(doc.attributes.slug).toBe('accueil');
  expect(doc.attributes.author).toBeDefined();
  expect(doc.attributes.author).toHaveLength(1);
  expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should get Home EN with EN data', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${homeId}?locale=en`);
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Home');
  expect(doc.attributes.slug).toBe('home');
  expect(doc.attributes.author).toBeDefined();
  expect(doc.attributes.author).toHaveLength(1);
  expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

// `formatslug` leaves out the page being saved: writing back its own slug keeps it
test('Should keep the slug a page writes back', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
    headers: await signInSuperAdmin(request),
    data: { attributes: { slug: 'accueil' } }
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.slug).toBe('accueil');
});

test('Should create a page', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Page',
        slug: 'page'
      },
      // status: 'published',
      layout: {
        components: [
          {
            text: 'Foo',
            type: 'paragraph'
          },
          {
            type: 'image',
            legend: 'legend'
          }
        ]
      }
    }
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Page');
  expect(doc.locale).toBe('fr');
  expect(doc.createdAt).toBeDefined();
  expect(doc.id).toBeDefined();
  expect(doc.layout.components.length).toBe(2);
  expect(doc.layout.components.at(0).text).toBe('Foo');
  expect(doc.layout.components.at(1).legend).toBe('legend');
  pageId = doc.id;
});

test('Should get only the layout page prop', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/pages/?where[id][equals]=${pageId}&select=layout.components`,
    {
      headers: await signInSuperAdmin(request)
    }
  );
  expect(response.status()).toBe(200);
  const { docs } = await response.json();
  const doc = docs[0];
  expect(Object.keys(doc).length).toBe(2);
  expect(doc.id).toBeDefined();
  expect(doc.layout).toBeDefined();
  expect(doc.layout.components).toBeDefined();
  expect(doc.layout.components.length).toBe(2);
  expect(doc.layout.components.at(0).text).toBe('Foo');
  expect(doc.layout.components.at(1).legend).toBe('legend');
});

/**
 * The same select, on the by-id endpoint rather than the list one. It reaches `findById` and the
 * adapter the same way, and has to narrow the document identically.
 */
test('Should get only the layout page prop by id', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageId}?select=layout.components`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(Object.keys(doc).length).toBe(2);
  expect(doc.id).toBe(pageId);
  expect(doc.layout.components.length).toBe(2);
  expect(doc.layout.components.at(0).text).toBe('Foo');
  expect(doc.layout.components.at(1).legend).toBe('legend');
});

test('Should return the home page', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${homeId}`).then((response) => {
    return response.json();
  });
  expect(response.doc).toBeDefined();
  expect(response.doc.attributes.title).toBe('Accueil');
  expect(response.doc.attributes.author).toBeDefined();
  expect(response.doc.attributes.author).toHaveLength(1);
  expect(response.doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should return 2 pages', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages`).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(2);
});

/**
 *  Queries
 */
test('Should return home EN (query)', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.title][equals]=Home&locale=en`;
  const response = await request.get(url).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
  expect(response.docs[0].attributes.title).toBe('Home');
});

test('Should return home EN (query) with select', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.title][equals]=Home&locale=en&select=attributes.title`;
  const response = await request.get(url).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
  expect(response.docs[0].attributes.title).toBe('Home');
  expect(response.docs[0].id).toBeDefined();
  expect(Object.keys(response.docs[0]).length).toBe(2);
});

test('Should return home FR (query)', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.author][like]=${adminUserId}`;
  const response = await request.get(url).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
  expect(response.docs[0].attributes.title).toBe('Accueil');
});

test('Should return home FR (query) with select', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.author][like]=${adminUserId}&select=attributes.title`;
  const response = await request.get(url).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
  expect(response.docs[0].attributes.title).toBe('Accueil');
  expect(response.docs[0].id).toBeDefined();
  expect(Object.keys(response.docs[0]).length).toBe(2);
});

let pageWithAuthorId: string;
test('Should create an other page with author', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Page 2',
        slug: 'page-2',
        author: adminUserId
      }
    }
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Page 2');
  expect(doc.attributes.slug).toBe('page-2');
  expect(doc.locale).toBe('fr');
  expect(doc.id).toBeDefined();
  pageWithAuthorId = doc.id;
});

test('Should return last created page with author depth', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageWithAuthorId}?depth=1`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Page 2');
  expect(doc.attributes.slug).toBe('page-2');
  expect(doc.attributes.author).toBeDefined();
  expect(doc.attributes.author.at(0).name).toBe('Admin');
});

test('Should populate relations across a list', async ({ request }) => {
  const { docs } = await request
    .get(`${API_BASE_URL}/pages?depth=1`, { headers: await signInSuperAdmin(request) })
    .then((response) => response.json());
  const page = docs.find((doc: any) => doc.id === pageWithAuthorId);
  expect(page.attributes.author.at(0).name).toBe('Admin');
});

test('Should leave out a related document the reader may not see', async ({
  request,
  playwright
}) => {
  const headers = await signInSuperAdmin(request);
  const { doc: note } = await okJson(
    await request.post(`${API_BASE_URL}/notes`, { headers, data: { body: 'Internal' } })
  );
  const { doc: page } = await okJson(
    await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'With a note', slug: 'with-a-note', notes: [note.id] } }
    })
  );

  // An admin sees the note
  const signedIn = await request
    .get(`${API_BASE_URL}/pages/${page.id}?depth=1`, { headers })
    .then((response) => response.json());
  expect(signedIn.doc.attributes.notes.at(0).body).toBe('Internal');

  // Signed out, the page reads, alone and in a list, without its note
  const anonymous = await playwright.request.newContext();
  const one = await anonymous.get(`${API_BASE_URL}/pages/${page.id}?depth=1`);
  expect(one.status()).toBe(200);
  expect((await one.json()).doc.attributes.notes).toEqual([]);
  const { docs } = await anonymous
    .get(`${API_BASE_URL}/pages?depth=1`)
    .then((response) => response.json());
  expect(docs.find((doc: any) => doc.id === page.id)?.attributes.notes).toEqual([]);
  await anonymous.dispose();

  await request.delete(`${API_BASE_URL}/pages/${page.id}`, { headers });
  await request.delete(`${API_BASE_URL}/notes/${note.id}`, { headers });
});

test('Should find a page by its url, each locale by its own', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  for (const locale of ['fr', 'en']) {
    const { doc: page } = await request
      .get(`${API_BASE_URL}/pages/${pageWithAuthorId}?locale=${locale}`, { headers })
      .then((response) => response.json());
    // The EN slug falls back to the FR one
    expect(page.url).toBe(`${BASE_URL}/${locale}/page-2`);

    const { docs } = await request
      .get(
        `${API_BASE_URL}/pages?where[url][equals]=${encodeURIComponent(page.url)}&locale=${locale}`,
        {
          headers
        }
      )
      .then((response) => response.json());
    expect(docs.map((doc: any) => doc.id)).toEqual([pageWithAuthorId]);
  }

  // The FR url names no page in EN
  const { docs } = await request
    .get(
      `${API_BASE_URL}/pages?where[url][equals]=${encodeURIComponent(`${BASE_URL}/fr/page-2`)}&locale=en`,
      { headers }
    )
    .then((response) => response.json());
  expect(docs).toEqual([]);
});

// `xx` is no locale, and the front route takes one segment after its locale
test('Should not serve a page under an unknown locale prefix', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/xx/page-2`);
  expect(response.status()).toBe(404);
});

// An area's url is stored per locale, as a page's is, and a read joins it
test("Should read an area's url in each locale", async ({ request }) => {
  for (const locale of ['fr', 'en']) {
    const { doc } = await request
      .get(`${API_BASE_URL}/infos?locale=${locale}`)
      .then((response) => response.json());
    expect(doc.url).toBe(`${BASE_URL}/${locale}/about`);
  }
});

test("Should read an area's url alone with select", async ({ request }) => {
  const { doc } = await request
    .get(`${API_BASE_URL}/infos?locale=fr&select=url`)
    .then((response) => response.json());
  expect(doc.url).toBe(`${BASE_URL}/fr/about`);
});

// Relations queries: author (single) should work with equals and in_array. Three pages exist
// here, and "Page" has no author.
test('Should find pages by author equals', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.author][equals]=${adminUserId}`;
  const response = await request.get(url).then((r) => r.json());
  expect(idsOf(response.docs).sort()).toEqual([homeId, pageWithAuthorId].sort());
});

test('Should find pages by author in_array', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.author][in_array]=${adminUserId}`;
  const response = await request.get(url).then((r) => r.json());
  expect(idsOf(response.docs).sort()).toEqual([homeId, pageWithAuthorId].sort());
});

// Querying relation properties (e.g., author.name) should work and reuse the same query builder
test('Should find pages by author.name equals', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.author.name][equals]=Admin`;
  // `name` reads for a signed-in user only, so an anonymous filter on it is refused
  expect((await request.get(url)).status()).toBe(403);
  const headers = await signInSuperAdmin(request);
  const response = await request.get(url, { headers }).then((r) => r.json());
  expect(idsOf(response.docs).sort()).toEqual([homeId, pageWithAuthorId].sort());
});

// `staff` reads for anyone here, its `email` for a signed-in user only
test('Should not find pages by author.email anonymously', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.author.email][like]=a%25`;
  expect((await request.get(url)).status()).toBe(403);
  const headers = await signInSuperAdmin(request);
  expect((await request.get(url, { headers })).status()).toBe(200);
});

test('Should return Page 2 (query)', async ({ request }) => {
  const qs = `where[and][0][attributes.author][in_array]=${adminUserId}&where[and][1][attributes.slug][equals]=page-2&locale=en`;
  const url = `${API_BASE_URL}/pages?${qs}`;
  const response = await request.get(url).then((response) => {
    return response.json();
  });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(1);
  expect(response.docs[0].attributes.title).toBe('Page 2');
  expect(response.docs[0].locale).toBe('en');
});

test('A field inside tabs, in a localized group, keeps one value per locale', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const { doc: note } = await okJson(
    await request.post(`${API_BASE_URL}/notes?locale=fr`, {
      headers,
      data: { body: 'Soldes', meta: { seo: { metaTitle: 'Soldes' } } }
    })
  );

  const update = await request.patch(`${API_BASE_URL}/notes/${note.id}?locale=en`, {
    headers,
    data: { meta: { seo: { metaTitle: 'Sale' } } }
  });
  expect(update.status()).toBe(200);

  const read = (locale: string) =>
    request
      .get(`${API_BASE_URL}/notes/${note.id}?locale=${locale}`, { headers })
      .then((r) => r.json())
      .then((r) => r.doc.meta.seo.metaTitle);
  expect(await read('fr')).toBe('Soldes');
  expect(await read('en')).toBe('Sale');

  await request.delete(`${API_BASE_URL}/notes/${note.id}`, { headers });
});

test('Should delete page', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/pages/${pageId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

test('Should return 2 page', async ({ request }) => {
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
  for (const doc of response.docs) {
    expect(doc.id).toBeDefined();
    expect(Object.keys(doc.attributes).sort()).toEqual(['slug']);
  }
});

test('Should return 2 pages with only attributes slug, title and id prop', async ({ request }) => {
  const response = await request
    .get(`${API_BASE_URL}/pages?select=attributes.slug,attributes.title`)
    .then((response) => {
      return response.json();
    });
  expect(response.docs).toBeDefined();
  expect(response.docs.length).toBe(2);
  for (const doc of response.docs) {
    expect(doc.id).toBeDefined();
    expect(Object.keys(doc.attributes).sort()).toEqual(['slug', 'title']);
  }
});

/**
 * `select` on the by-id endpoint, alongside the list-endpoint cases above. The `title` case is the
 * one worth having: `title` is derived from `asTitle`, so a narrowed read that drops that field
 * hands back a document titled with its own id.
 */

test('Should return one page by id with only attributes.slug and id prop', async ({ request }) => {
  const response = await request
    .get(`${API_BASE_URL}/pages/${homeId}?select=attributes.slug`)
    .then((response) => response.json());
  expect(response.doc).toBeDefined();
  expect(response.doc.id).toBe(homeId);
  expect(Object.keys(response.doc.attributes)).toEqual(['slug']);
});

test('Should resolve title from asTitle when selecting title by id', async ({ request }) => {
  const response = await request
    .get(`${API_BASE_URL}/pages/${homeId}?select=title`)
    .then((response) => response.json());
  expect(response.doc).toBeDefined();
  // Not the document id: the fallback in setDocumentTitle when the asTitle
  // column was narrowed out of the read.
  expect(response.doc.title).not.toBe(homeId);
  expect(response.doc.title).toBe('Accueil');
});

/****************************************************
/* LOCALE-FALLBACK HOOK PROPAGATION (createMarker regression)
/****************************************************/

test('Should run a non-idempotent $beforeSave once, whatever locale reads it', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  // Default locale is 'fr' — creating without a locale param writes 'fr' and nothing else.
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: {
        title: 'Fallback hook test',
        slug: 'fallback-hook-test',
        createMarker: 'seed'
      }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(doc.locale).toBe('fr');
  // $beforeSave ran exactly once on the primary locale's write.
  expect(doc.attributes.createMarker).toBe('seed-created');

  const enResponse = await request.get(`${API_BASE_URL}/pages/${doc.id}?locale=en`, { headers });
  const { doc: enDoc } = await enResponse.json();
  // createMarker isn't .localized() — same underlying column as 'fr', read as it was written.
  expect(enDoc.attributes.createMarker).toBe('seed-created');

  await request.delete(`${API_BASE_URL}/pages/${doc.id}`, { headers });
});

/****************************************************
/* BLOCKS Localized
/****************************************************/

let pageWithBlockID: string;
let imageID: string;
test('Should create a page with blocks', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // The media the image blocks below link to
  const { doc: media } = await okJson(
    await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: {
        file: {
          base64: await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg')),
          filename: 'blocks-image.jpg'
        },
        alt: 'alt'
      }
    })
  );
  imageID = media.id;

  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: {
        title: 'Page with blocks',
        slug: 'page-with-blocks'
      },
      layout: {
        components: [
          { type: 'paragraph', text: 'paragraph text' },
          { type: 'slider', image: 'image value' },
          { type: 'image', image: [imageID], legend: 'légende' }
        ]
      }
    }
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Page with blocks');
  expect(doc.attributes.slug).toBe('page-with-blocks');
  expect(doc.layout.components).toHaveLength(3);
  expect(doc.locale).toBe('fr');
  expect(doc.id).toBeDefined();
  pageWithBlockID = doc.id;
});

test('Should read the FR fields in EN by fallback, and no EN blocks', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageWithBlockID}?locale=en`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await okJson(response);
  // A localized field falls back to the locale that has it; a localized blocks field is the
  // blocks written in this locale, and none were.
  expect(doc.attributes.title).toBe('Page with blocks');
  expect(doc.attributes.slug).toBe('page-with-blocks');
  expect(doc.layout.components).toHaveLength(0);
  expect(doc.locale).toBe('en');
});

test('Should update EN content of page with blocks', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${pageWithBlockID}?locale=en`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'Page with blocks but EN',
        slug: 'page-with-blocks-en'
      },
      layout: {
        components: [
          { type: 'slider', image: 'image value en' },
          { type: 'paragraph', text: 'paragraph text' },
          { type: 'image', image: [imageID], legend: 'legend EN' },
          { type: 'slider', image: 'image value but en' }
        ]
      }
    }
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Page with blocks but EN');
  expect(doc.attributes.slug).toBe('page-with-blocks-en');
  expect(doc.layout.components).toHaveLength(4);
  expect(doc.layout.components[0].type).toBe('slider');
  expect(doc.layout.components[0].image).toBe('image value en');
  expect(doc.layout.components[1].type).toBe('paragraph');
  expect(doc.layout.components[1].text).toBe('paragraph text');
  expect(doc.layout.components[2].type).toBe('image');
  expect(doc.layout.components[2].legend).toBe('legend EN');
  expect(doc.layout.components[2].image[0].documentId).toBe(imageID);
  expect(doc.layout.components[3].type).toBe('slider');
  expect(doc.layout.components[3].image).toBe('image value but en');
  expect(doc.locale).toBe('en');
  expect(doc.id).toBeDefined();
});

test('Should still get the FR content of page with blocks', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${pageWithBlockID}`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await okJson(response);
  expect(doc.attributes.title).toBe('Page with blocks');
  expect(doc.attributes.slug).toBe('page-with-blocks');
  expect(doc.layout.components).toHaveLength(3);
  expect(doc.layout.components[0].type).toBe('paragraph');
  expect(doc.layout.components[0].text).toBe('paragraph text');
  expect(doc.layout.components[1].type).toBe('slider');
  expect(doc.layout.components[1].image).toBe('image value');
  expect(doc.layout.components[2].type).toBe('image');
  expect(doc.layout.components[2].legend).toBe('légende');
  expect(doc.layout.components[2].image[0].documentId).toBe(imageID);
  expect(doc.locale).toBe('fr');
});

/****************************************************
/* TREE Localized
/****************************************************/

test('Should create some treeBlocks in Area Menu EN', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/menu?locale=en`, {
    headers: await signInSuperAdmin(request),
    data: {
      nav: [
        {
          link: {
            type: 'pages',
            value: homeId,
            target: '_self'
          }
        }
      ],
      mainNav: [
        {
          link: {
            type: 'url',
            value: 'http://fooo.baz',
            target: '_self'
          }
        },
        {
          link: {
            type: 'url',
            value: 'http://fooo-2.baz',
            target: '_blank'
          }
        }
      ]
    }
  });
  const { doc } = await okJson(response);
  expect(doc.nav).toHaveLength(1);
  expect(doc.nav[0].link).toBeDefined();
  expect(doc.mainNav).toHaveLength(2);
  expect(doc.mainNav[0].link).toBeDefined();
  expect(doc.mainNav[0].link.type).toBe('url');
  expect(doc.mainNav[0].link.value).toBe('http://fooo.baz');
  expect(doc.mainNav[0].link.target).toBe('_self');
  expect(doc.mainNav[1].link).toBeDefined();
  expect(doc.mainNav[1].link.type).toBe('url');
  expect(doc.mainNav[1].link.value).toBe('http://fooo-2.baz');
  expect(doc.mainNav[1].link.target).toBe('_blank');
  expect(doc.locale).toBe('en');
});

test('Should not get localized treeBlocks in Area Menu FR', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/menu`, {
    headers: await signInSuperAdmin(request)
  });
  const { doc } = await okJson(response);
  expect(doc.nav).toHaveLength(1);
  expect(doc.nav[0].link).toBeDefined();
  expect(doc.mainNav).toHaveLength(0);
  expect(doc.locale).toBe('fr');
});

test('Should create some treeBlocks in Area Menu FR', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/menu`, {
    headers: await signInSuperAdmin(request),
    data: {
      mainNav: [
        {
          link: {
            type: 'url',
            value: 'http://fooo-fr.baz',
            target: '_self'
          }
        }
      ]
    }
  });
  const { doc } = await okJson(response);
  expect(doc.nav).toHaveLength(1);
  expect(doc.nav[0].link).toBeDefined();
  expect(doc.mainNav).toHaveLength(1);
  expect(doc.mainNav[0].link).toBeDefined();
  expect(doc.mainNav[0].link.type).toBe('url');
  expect(doc.mainNav[0].link.value).toBe('http://fooo-fr.baz');
  expect(doc.mainNav[0].link.target).toBe('_self');
  expect(doc.locale).toBe('fr');

  // EN keeps its own two items
  const { doc: en } = await okJson(
    await request.get(`${API_BASE_URL}/menu?locale=en`, {
      headers: await signInSuperAdmin(request)
    })
  );
  expect(en.mainNav.map((item: { link: { value: string } }) => item.link.value)).toEqual([
    'http://fooo.baz',
    'http://fooo-2.baz'
  ]);
});

test('Should refuse a new nav item sent without its required link', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/menu`, {
    headers: await signInSuperAdmin(request),
    data: { nav: [{}] }
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toContain('nav.0.link: ');
});

// A link to a page or to an area carries its target's id, url and title in the read's locale
test("Should give a nav link its target's id, url and title at depth 0", async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const { doc: infos } = await request.get(`${API_BASE_URL}/infos`).then((r) => r.json());
  const saved = await request.patch(`${API_BASE_URL}/menu`, {
    headers,
    data: {
      nav: [
        { link: { type: 'pages', value: homeId, target: '_self' } },
        { link: { type: 'infos', value: infos.id, target: '_self' } }
      ]
    }
  });
  expect(saved.status()).toBe(200);

  const { doc: home } = await request
    .get(`${API_BASE_URL}/pages/${homeId}?locale=fr`)
    .then((r) => r.json());
  const { doc: menu } = await request.get(`${API_BASE_URL}/menu?locale=fr`).then((r) => r.json());

  expect(menu.nav[0].link).toMatchObject({ id: homeId, url: home.url, title: home.title });
  expect(menu.nav[1].link).toMatchObject({
    id: infos.id,
    url: `${BASE_URL}/fr/about`,
    title: 'Infos'
  });

  // `nav` is shared by both locales; its links read in the locale asked for. A page's address
  // keeps the slug its title gave it on creation, so the EN url is read, not built.
  const { doc: homeEn } = await request
    .get(`${API_BASE_URL}/pages/${homeId}?locale=en`)
    .then((r) => r.json());
  expect(homeEn.url).toMatch(new RegExp(`^${BASE_URL}/en/`));
  const { doc: menuEn } = await request.get(`${API_BASE_URL}/menu?locale=en`).then((r) => r.json());
  expect(menuEn.nav[0].link).toMatchObject({ id: homeId, url: homeEn.url, title: 'Home' });
  expect(menuEn.nav[1].link).toMatchObject({ id: infos.id, url: `${BASE_URL}/en/about` });
});

/****************************************************
/* AUTH Collection
/****************************************************/

test('Should create a staff editor', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'editor@email.com',
      name: 'Chesster',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  const data = await response.json();

  expect(response.status()).toBe(200);
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBeDefined();
  editorUserId = data.doc.id;
});

/****************************************************
/* Duplicate — Pages here is localized but NOT versioned,
/* the one combination not exercised by the versions/
/* versions-multilang suites' duplicate tests
/****************************************************/

test('Should require create access to duplicate a page (no credentials)', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages/${homeId}/duplicate`);
  expect(response.status()).toBe(403);
});

test('Should duplicate a page keeping each locale’s own title', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const createResponse = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: { attributes: { title: 'Dup FR', slug: 'dup-source' } }
  });
  const { doc: original } = await okJson(createResponse);
  expect(original.locale).toBe('fr');

  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${original.id}?locale=en`, {
      headers,
      data: { attributes: { title: 'Dup EN' } }
    })
  );

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(original.id);

  const frResponse = await request.get(`${API_BASE_URL}/pages/${duplicateId}?locale=fr`, {
    headers
  });
  const { doc: frDoc } = await frResponse.json();
  expect(frDoc.attributes.title).toBe('Dup FR (copy)');

  const enResponse = await request.get(`${API_BASE_URL}/pages/${duplicateId}?locale=en`, {
    headers
  });
  const { doc: enDoc } = await enResponse.json();
  expect(enDoc.attributes.title).toBe('Dup EN (copy)');

  // Non-versioned collections have no draft/published split — the copy is
  // immediately live, and the original must be untouched by the duplicate.
  const originalAfter = await request.get(`${API_BASE_URL}/pages/${original.id}?locale=fr`, {
    headers
  });
  const { doc: originalAfterDoc } = await originalAfter.json();
  expect(originalAfterDoc.attributes.title).toBe('Dup FR');

  await request.delete(`${API_BASE_URL}/pages/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
});

test('Should duplicate a page first written in EN, its FR copy taking the required values it shows', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const createResponse = await request.post(`${API_BASE_URL}/pages?locale=en`, {
    headers,
    data: { attributes: { title: 'Concert', slug: 'concert-en-only' } }
  });
  expect(createResponse.status()).toBe(200);
  const { doc: original } = await okJson(createResponse);

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();

  const read = async (locale: string) =>
    (
      await request
        .get(`${API_BASE_URL}/pages/${duplicateId}?locale=${locale}`, { headers })
        .then((r) => r.json())
    ).doc;
  const frDoc = await read('fr');
  expect(frDoc.attributes.title).toBe('Concert (copy)');
  // The EN slug, made free by the fixture's own `formatslug` hook
  expect(frDoc.attributes.slug).toBe('concert-en-only-1');
  const enDoc = await read('en');
  expect(enDoc.attributes.title).toBe('Concert (copy)');

  await request.delete(`${API_BASE_URL}/pages/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
});

test('Should duplicate a page with localized blocks, each locale keeping its own content and relation', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const { doc: mediaFr } = await okJson(
    await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: {
        file: {
          base64: await filePathToBase64(
            path.resolve(process.cwd(), 'tests/multilang/landscape.jpg')
          ),
          filename: 'dup-blocks-fr.jpg'
        },
        alt: 'FR media'
      }
    })
  );

  const { doc: mediaEn } = await okJson(
    await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: {
        file: {
          base64: await filePathToBase64(
            path.resolve(process.cwd(), 'tests/multilang/landscape.jpg')
          ),
          filename: 'dup-blocks-en.jpg'
        },
        alt: 'EN media'
      }
    })
  );

  // layout.components is .localized() — created (fr) with one block, then
  // patched (en) with a *different* block, to prove the locale loop's
  // id-remapping doesn't cross-contaminate content between locales.
  const createResponse = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: 'Blocks FR', slug: 'dup-blocks-source' },
      layout: { components: [{ type: 'image', image: mediaFr.id, legend: 'FR legend' }] }
    }
  });
  const { doc: original } = await okJson(createResponse);
  expect(original.layout.components).toHaveLength(1);
  const originalFrBlockId = original.layout.components[0].id;

  const patchEnResponse = await request.patch(`${API_BASE_URL}/pages/${original.id}?locale=en`, {
    headers,
    data: {
      layout: { components: [{ type: 'image', image: mediaEn.id, legend: 'EN legend' }] }
    }
  });
  const { doc: originalEn } = await okJson(patchEnResponse);
  const originalEnBlockId = originalEn.layout.components[0].id;

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();

  const frResponse = await request.get(`${API_BASE_URL}/pages/${duplicateId}?locale=fr&depth=1`, {
    headers
  });
  const { doc: frDoc } = await frResponse.json();
  expect(frDoc.layout.components).toHaveLength(1);
  expect(frDoc.layout.components[0].legend).toBe('FR legend');
  // Relation fields are always array-wrapped, even single (non-many) ones
  // at depth > 0 — see transform.server.ts's flatDoc[relationPath] push.
  expect(frDoc.layout.components[0].image.at(0).id).toBe(mediaFr.id);
  // Localized blocks get a fresh id per locale, not reused from the source.
  expect(frDoc.layout.components[0].id).not.toBe(originalFrBlockId);

  const enResponse = await request.get(`${API_BASE_URL}/pages/${duplicateId}?locale=en&depth=1`, {
    headers
  });
  const { doc: enDoc } = await enResponse.json();
  expect(enDoc.layout.components).toHaveLength(1);
  expect(enDoc.layout.components[0].legend).toBe('EN legend');
  expect(enDoc.layout.components[0].image.at(0).id).toBe(mediaEn.id);
  expect(enDoc.layout.components[0].id).not.toBe(originalEnBlockId);
  // The two locales' copied blocks must not share an id with each other either.
  expect(enDoc.layout.components[0].id).not.toBe(frDoc.layout.components[0].id);

  // Original untouched, in both locales.
  const originalFrAfter = await request.get(
    `${API_BASE_URL}/pages/${original.id}?locale=fr&depth=1`,
    { headers }
  );
  const { doc: originalFrAfterDoc } = await originalFrAfter.json();
  expect(originalFrAfterDoc.layout.components[0].id).toBe(originalFrBlockId);
  expect(originalFrAfterDoc.layout.components[0].legend).toBe('FR legend');

  await request.delete(`${API_BASE_URL}/pages/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${mediaFr.id}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${mediaEn.id}`, { headers });
});

test('Should duplicate a page with a shared blocks list, every block in every locale', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  // layout.sections is shared: one set of rows, each block's text translated
  const { doc: original } = await okJson(
    await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: {
        attributes: { title: 'Sections FR', slug: 'dup-sections-source' },
        layout: {
          sections: [
            { type: 'note', label: 'Note FR' },
            { type: 'quote', text: 'Citation', author: 'Ann' }
          ]
        }
      }
    })
  );
  expect(original.layout.sections).toHaveLength(2);
  const [note, quote] = original.layout.sections;

  const translated = await request.patch(`${API_BASE_URL}/pages/${original.id}?locale=en`, {
    headers,
    data: {
      attributes: { title: 'Sections EN' },
      layout: {
        sections: [
          { id: note.id, type: 'note', label: 'Note EN' },
          { id: quote.id, type: 'quote', text: 'Quote', author: 'Ann' }
        ]
      }
    }
  });
  expect(translated.status()).toBe(200);

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();

  const sections = (locale: string) =>
    request
      .get(`${API_BASE_URL}/pages/${duplicateId}?locale=${locale}`, { headers })
      .then((r) => r.json())
      .then((r) => r.doc.layout.sections);
  const fr = await sections('fr');
  const en = await sections('en');

  expect(fr.map((block: { type: string }) => block.type)).toEqual(['note', 'quote']);
  expect(fr[0].label).toBe('Note FR');
  expect(fr[1].text).toBe('Citation');
  expect(fr[1].author).toBe('Ann');

  expect(en.map((block: { type: string }) => block.type)).toEqual(['note', 'quote']);
  expect(en[0].label).toBe('Note EN');
  expect(en[1].text).toBe('Quote');
  expect(en[1].author).toBe('Ann');

  // One set of rows, the copy's own: the same ids in both locales, none of the source's
  const ids = (blocks: { id: string }[]) => blocks.map((block) => block.id);
  expect(ids(en)).toEqual(ids(fr));
  expect(ids(fr)).not.toContain(note.id);
  expect(ids(fr)).not.toContain(quote.id);

  await request.delete(`${API_BASE_URL}/pages/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
});

/****************************************************
/* Area
/****************************************************/

test('Should update settings', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    headers: await signInSuperAdmin(request),
    data: {
      maintenance: true,
      legalMention: 'mentions légales'
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(doc.legalMention).toBe('mentions légales');
});

test('Should update settings EN', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings?locale=en`, {
    headers: await signInSuperAdmin(request),
    data: {
      legalMention: 'legals'
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(doc.legalMention).toBe('legals');
});

test('Should get settings FR with still FR data', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings?locale=fr`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(doc.legalMention).toBe('mentions légales');
});

test('Should update infos', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request),
    data: {
      instagram: '@fooo',
      legals: {
        label: 'Google',
        type: 'url',
        value: 'http://google.fr',
        target: '_self'
      }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(doc.legals).toBeDefined();
  expect(doc.legals.type).toBe('url');
  expect(doc.legals.value).toBe('http://google.fr');
});

test('Should update infos EN', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos?locale=en`, {
    headers: await signInSuperAdmin(request),
    data: {
      legals: {
        label: 'Google-en',
        type: 'url',
        value: 'http://google.com',
        target: '_blank'
      }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await okJson(response);
  expect(doc.legals).toBeDefined();
  expect(doc.legals.label).toBe('Google-en');
  expect(doc.legals.value).toBe('http://google.com');
  // The save answers the url of the locale it wrote
  expect(doc.url).toBe(`${BASE_URL}/en/about`);
});

test('Should get infos FR', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos`).then((r) => r.json());
  expect(response.doc.legals).toBeDefined();
  expect(response.doc.legals.value).toBe('http://google.fr');
  expect(response.doc.legals.label).toBe('Google');
});

test('Should get infos EN', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos?locale=en`).then((r) => r.json());
  expect(response.doc.legals).toBeDefined();
  expect(response.doc.legals.value).toBe('http://google.com');
  expect(response.doc.legals.label).toBe('Google-en');
});

test('Should get informations', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos`).then((r) => r.json());
  expect(response.doc.instagram).toBe('@fooo');
});

/****************************************************
/* Relations
/****************************************************/

let page2Id: string;
let editor2Id: string;

test('Should create editor user for testing', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'editor2@email.com',
      name: 'Editor2',
      roles: ['editor'],
      password: PASSWORD
    }
  });
  const { doc } = await okJson(response);
  editor2Id = doc.id;
  expect(doc.name).toBe('Editor2');
});

test('Should create page with multiple relations', async ({ request }) => {
  const payload = {
    attributes: {
      title: 'Relations Test',
      slug: 'relations-test',
      author: [adminUserId],
      contributors: [adminUserId, editor2Id],
      ambassadors: [editor2Id]
    }
  };

  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: payload
  });

  const { doc } = await okJson(response);
  page2Id = doc.id;

  const verifyResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?depth=1`);
  const { doc: verifyDoc } = await verifyResponse.json();

  // At depth 1 each relation reads as the related staff documents
  expect(verifyDoc.attributes.title).toBe('Relations Test');
  expect(idsOf(verifyDoc.attributes.author)).toEqual([adminUserId]);
  expect(idsOf(verifyDoc.attributes.contributors)).toEqual([adminUserId, editor2Id]);
  expect(idsOf(verifyDoc.attributes.ambassadors)).toEqual([editor2Id]);
});

// Contributors exact-match and membership tests (isolated)

test('Contributors equality/membership (isolated)', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // Create an isolated page with two contributors
  const createRes = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: {
        title: 'Contributors Test',
        slug: 'contributors-test',
        author: [editor2Id],
        contributors: [adminUserId, editor2Id]
      }
    }
  });
  const { doc } = await okJson(createRes);
  const pid = doc.id;

  // equals should find the page when searching one author
  const authorIsEqualRes = await request
    .get(`${API_BASE_URL}/pages?where[attributes.author][equals]=${editor2Id}`)
    .then((r) => r.json());
  expect(authorIsEqualRes.docs).toBeDefined();
  expect(authorIsEqualRes.docs).toHaveLength(1);
  expect(authorIsEqualRes.docs[0].attributes.author).toHaveLength(1);
  expect(authorIsEqualRes.docs[0].attributes.author[0].documentId).toBe(editor2Id);

  // in_array with a single id should NOT match the page (subset semantics require a superset)
  const inArrayRes = await request
    .get(`${API_BASE_URL}/pages?where[attributes.contributors][in_array]=${adminUserId}`)
    .then((r) => r.json());
  expect(inArrayRes.docs).toBeDefined();
  const idsIn = inArrayRes.docs.map((d: any) => d.id);
  expect(idsIn).not.toContain(pid);

  // in_array with both ids should match the page (provided set is a superset)
  const inArrayCsv = await request
    .get(
      `${API_BASE_URL}/pages?where[attributes.contributors][in_array]=${adminUserId},${editor2Id}`
    )
    .then((r) => r.json());
  expect(inArrayCsv.docs).toBeDefined();
  const idsInCsv = inArrayCsv.docs.map((d: any) => d.id);
  expect(idsInCsv).toContain(pid);

  // in_array with a superset (extra id) should still match
  const inArraySuperset = await request
    .get(
      `${API_BASE_URL}/pages?where[attributes.contributors][in_array]=${adminUserId},${editor2Id},00000000-0000-0000-0000-000000000000`
    )
    .then((r) => r.json());
  expect(inArraySuperset.docs).toBeDefined();
  const idsInSup = inArraySuperset.docs.map((d: any) => d.id);
  expect(idsInSup).toContain(pid);

  // not_in_array with a single id should match (provided set is not a superset)
  const notInSingle = await request
    .get(`${API_BASE_URL}/pages?where[attributes.contributors][not_in_array]=${adminUserId}`)
    .then((r) => r.json());
  expect(notInSingle.docs).toBeDefined();
  const idsNotIn = notInSingle.docs.map((d: any) => d.id);
  expect(idsNotIn).toContain(pid);

  // not_in_array with both ids should NOT match (provided set is superset)
  const notInCsv = await request
    .get(
      `${API_BASE_URL}/pages?where[attributes.contributors][not_in_array]=${adminUserId},${editor2Id}`
    )
    .then((r) => r.json());
  expect(notInCsv.docs).toBeDefined();
  const idsNotInCsv = notInCsv.docs.map((d: any) => d.id);
  expect(idsNotInCsv).not.toContain(pid);

  // not_equals with single id should match (sets differ)
  const notEqSingle = await request
    .get(`${API_BASE_URL}/pages?where[attributes.contributors][not_equals]=${adminUserId}`)
    .then((r) => r.json());
  expect(notEqSingle.docs).toBeDefined();
  const idsNotEqSingle = notEqSingle.docs.map((d: any) => d.id);
  expect(idsNotEqSingle).toContain(pid);

  // not_equals with exact set should NOT match
  const notEqCsv = await request
    .get(
      `${API_BASE_URL}/pages?where[attributes.contributors][not_equals]=${adminUserId},${editor2Id}`
    )
    .then((r) => r.json());
  expect(notEqCsv.docs).toBeDefined();
  const idsNotEqCsv = notEqCsv.docs.map((d: any) => d.id);
  expect(idsNotEqCsv).not.toContain(pid);

  // cleanup
  await request.delete(`${API_BASE_URL}/pages/${pid}`, { headers });
});

// Ambassadors (localized) tests
test('Should match ambassadors equals for locale FR', async ({ request }) => {
  const url = `${API_BASE_URL}/pages?where[attributes.ambassadors][equals]=${editor2Id}&locale=fr`;
  const response = await request.get(url).then((r) => r.json());
  expect(idsOf(response.docs)).toEqual([page2Id]);
});

test('Should NOT match ambassadors equals for locale EN', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // EN gets ambassadors of its own, a different set from FR's
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
      headers,
      data: {
        attributes: {
          ambassadors: [adminUserId, editor2Id]
        }
      }
    })
  );
  const ids = (where: string) =>
    request
      .get(`${API_BASE_URL}/pages?where[attributes.ambassadors][equals]=${where}&locale=en`)
      .then((r) => r.json())
      .then((r) => idsOf(r.docs));
  // FR's set does not match in EN; EN's own set does
  expect(await ids(editor2Id)).not.toContain(page2Id);
  expect(await ids(`${adminUserId},${editor2Id}`)).toContain(page2Id);
});

test('Should empty author relation', async ({ request }) => {
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
      headers: await signInSuperAdmin(request),
      data: {
        attributes: { author: [] }
      }
    })
  );

  const verifyResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?depth=1`);
  const { doc: verifyDoc } = await verifyResponse.json();

  expect(verifyDoc.attributes.author).toHaveLength(0);
  expect(idsOf(verifyDoc.attributes.contributors)).toEqual([adminUserId, editor2Id]);
  expect(idsOf(verifyDoc.attributes.ambassadors)).toEqual([editor2Id]);
});

test('Should reduce contributors array', async ({ request }) => {
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
      headers: await signInSuperAdmin(request),
      data: {
        attributes: { contributors: [adminUserId] }
      }
    })
  );

  const verifyResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?depth=1`);
  const { doc: verifyDoc } = await verifyResponse.json();

  expect(idsOf(verifyDoc.attributes.contributors)).toEqual([adminUserId]);
});

/** Page 2's ambassadors and contributors in `locale`, as ids. */
const relationsOfPage2 = async (request: APIRequestContext, locale: string) => {
  const { doc } = await okJson(
    await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=${locale}&depth=1`)
  );
  return {
    ambassadors: idsOf(doc.attributes.ambassadors),
    contributors: idsOf(doc.attributes.contributors)
  };
};

// Each write below changes the values it sends: going in, FR ambassadors are [editor2], EN
// ambassadors [admin, editor2], contributors [admin].

test('Should handle localized relations', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=fr`, {
      headers,
      data: {
        attributes: { ambassadors: [adminUserId] }
      }
    })
  );
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
      headers,
      data: {
        attributes: { ambassadors: [editor2Id] }
      }
    })
  );

  expect((await relationsOfPage2(request, 'fr')).ambassadors).toEqual([adminUserId]);
  expect((await relationsOfPage2(request, 'en')).ambassadors).toEqual([editor2Id]);
});

test('Should handle multiple locales with different relations', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // A single id, not a list
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=fr`, {
      headers,
      data: {
        attributes: {
          ambassadors: editor2Id
        }
      }
    })
  );
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
      headers,
      data: {
        attributes: {
          ambassadors: [adminUserId]
        }
      }
    })
  );

  expect((await relationsOfPage2(request, 'fr')).ambassadors).toEqual([editor2Id]);
  expect((await relationsOfPage2(request, 'en')).ambassadors).toEqual([adminUserId]);
});

test('Should handle mixed localized and non-localized updates', async ({ request }) => {
  // One EN write: ambassadors are localized, contributors are not
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
      headers: await signInSuperAdmin(request),
      data: {
        attributes: {
          ambassadors: [adminUserId, editor2Id],
          contributors: [adminUserId, editor2Id]
        }
      }
    })
  );

  const en = await relationsOfPage2(request, 'en');
  const fr = await relationsOfPage2(request, 'fr');
  expect(en.ambassadors).toEqual([adminUserId, editor2Id]);
  expect(fr.ambassadors).toEqual([editor2Id]);
  expect(en.contributors).toEqual([adminUserId, editor2Id]);
  expect(fr.contributors).toEqual([adminUserId, editor2Id]);
});

test('Should handle emptying relations in specific locale', async ({ request }) => {
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
      headers: await signInSuperAdmin(request),
      data: {
        attributes: {
          ambassadors: []
        }
      }
    })
  );

  expect((await relationsOfPage2(request, 'en')).ambassadors).toEqual([]);
  expect((await relationsOfPage2(request, 'fr')).ambassadors).toEqual([editor2Id]);
});

test('Should handle updates with missing locale', async ({ request }) => {
  // No locale: the default one, and contributors are shared by both
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
      headers: await signInSuperAdmin(request),
      data: {
        attributes: {
          contributors: [editor2Id]
        }
      }
    })
  );

  expect((await relationsOfPage2(request, 'en')).contributors).toEqual([editor2Id]);
  expect((await relationsOfPage2(request, 'fr')).contributors).toEqual([editor2Id]);
});

test('Should delete test page', async ({ request }) => {
  const response = await request.delete(`${API_BASE_URL}/pages/${page2Id}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
});

/****************************************************
/* The locale of a write
/****************************************************/

test('Should write each locale of a page whose body carries its own id', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const { doc } = await okJson(
    await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Id FR', slug: 'id-in-body' } }
    })
  );

  // The en row beside the fr one the create wrote
  const en = await request.patch(`${API_BASE_URL}/pages/${doc.id}?locale=en`, {
    headers,
    data: { attributes: { title: 'Id EN' } }
  });
  expect(en.status()).toBe(200);

  // The body carries the page's own id, as a document read from the API does
  const frWithId = await request.patch(`${API_BASE_URL}/pages/${doc.id}?locale=fr`, {
    headers,
    data: { id: doc.id, attributes: { title: 'Id FR, again' } }
  });
  expect(frWithId.status()).toBe(200);
  const enWithId = await request.patch(`${API_BASE_URL}/pages/${doc.id}?locale=en`, {
    headers,
    data: { id: doc.id, attributes: { title: 'Id EN, again' } }
  });
  expect(enWithId.status()).toBe(200);

  const title = (locale: string) =>
    request
      .get(`${API_BASE_URL}/pages/${doc.id}?locale=${locale}`, { headers })
      .then((r) => r.json())
      .then((r) => r.doc.attributes.title);
  expect(await title('fr')).toBe('Id FR, again');
  expect(await title('en')).toBe('Id EN, again');

  await request.delete(`${API_BASE_URL}/pages/${doc.id}`, { headers });
});

test('Should refuse a locale named in the body, each locale keeping its title', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const { doc } = await okJson(
    await request.post(`${API_BASE_URL}/pages`, {
      headers,
      data: { attributes: { title: 'Body FR', slug: 'locale-in-body' } }
    })
  );
  await okJson(
    await request.patch(`${API_BASE_URL}/pages/${doc.id}?locale=en`, {
      headers,
      data: { attributes: { title: 'Body EN' } }
    })
  );

  // `?locale=` names the locale of a REST call, never the body
  const response = await request.patch(`${API_BASE_URL}/pages/${doc.id}`, {
    headers,
    data: { locale: 'en', attributes: { title: 'x' } }
  });
  expect(response.status()).toBe(400);

  const title = (locale: string) =>
    request
      .get(`${API_BASE_URL}/pages/${doc.id}?locale=${locale}`, { headers })
      .then((r) => r.json())
      .then((r) => r.doc.attributes.title);
  expect(await title('fr')).toBe('Body FR');
  expect(await title('en')).toBe('Body EN');

  await request.delete(`${API_BASE_URL}/pages/${doc.id}`, { headers });
});

/****************************************************
/* Editor access
/****************************************************/

test('Should logout admin user', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const response = await request
    .post(`${API_BASE_URL}/auth/sign-out`, { headers })
    .then((r) => r.json());
  expect(response.success).toBe(true);

  // The session the sign-out named is gone
  const session = await request.get(`${API_BASE_URL}/auth/get-session`, { headers });
  expect(session.status()).toBe(200);
  expect(await session.json()).toBeNull();
});

// An editor may update no staff document at all, so the 403 does not single out the password
test('Editor should not update an admin', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/staff/${adminUserId}`, {
    headers: await signInEditor(request),
    data: {
      password: PASSWORD
    }
  });
  expect(response.status()).toBe(403);
});

/****************************************************
/* Authorship metas
/*
/* `createdBy` answers who made the document and is never rewritten; `updatedBy` answers who
/* wrote the revision being read. Home is created by the super admin in this file's first tests
/* and updated by the editor below, so the two must disagree, in every locale.
/****************************************************/

test('Should keep createdBy and move updatedBy to whoever wrote last, in every locale', async ({
  request
}) => {
  const headers = await signInEditor(request);
  const { doc: updated } = await okJson(
    await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
      headers,
      data: { attributes: { title: 'Home edited by editor' } }
    })
  );
  expect(updated.attributes.title).toBe('Home edited by editor');

  // The write was FR; the stamps belong to the document, so EN reads the same ones
  for (const locale of ['fr', 'en']) {
    const { doc } = await okJson(
      await request.get(`${API_BASE_URL}/pages/${homeId}?locale=${locale}`, { headers })
    );
    expect(doc.createdBy?.id).toBe(adminUserId);
    expect(doc.updatedBy?.id).toBe(editorUserId);
  }
});

test('Should claim the edit lock without becoming the last editor', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages/${homeId}/lock`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).held).toBe(true);

  // Authenticated: the stamps are `.access({ read: isStaff })`.
  const { doc } = await request
    .get(`${API_BASE_URL}/pages/${homeId}`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());

  // The lock write is not an edit: the editor who wrote the content is still the last editor.
  expect(doc.updatedBy?.id).toBe(editorUserId);
  expect(doc.createdBy?.id).toBe(adminUserId);
});

// The super admin holds the lock from the test above
test('Should not expose the edit lock outside the panel', async ({ request }) => {
  const { doc } = await request
    .get(`${API_BASE_URL}/pages/${homeId}`, { headers: await signInSuperAdmin(request) })
    .then((response) => response.json());

  expect(doc.currentlyEditedBy).toBeUndefined();
  expect(doc.currentlyEditedAt).toBeUndefined();
});

test('An unauthenticated claim leaves the holder alone', async ({ request }) => {
  const anonymous = await request.post(`${API_BASE_URL}/pages/${homeId}/lock`);
  expect(anonymous.status()).toBe(403);

  // The super admin still holds it: the editor's claim finds it held
  const claim = await request.post(`${API_BASE_URL}/pages/${homeId}/lock`, {
    headers: await signInEditor(request)
  });
  expect(claim.status()).toBe(200);
  expect((await claim.json()).held).toBe(false);
});

test('Should logout editor', async ({ request }) => {
  const headers = await signInEditor(request);
  const response = await request
    .post(`${API_BASE_URL}/auth/sign-out`, { headers })
    .then((r) => r.json());
  expect(response.success).toBe(true);

  // The session the sign-out named is gone
  const session = await request.get(`${API_BASE_URL}/auth/get-session`, { headers });
  expect(session.status()).toBe(200);
  expect(await session.json()).toBeNull();
});
