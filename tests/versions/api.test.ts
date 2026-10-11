import { PARAMS } from '#lib/core/constants.js';
import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// The tests share ids and rows: one failing skips the rest
test.describe.configure({ mode: 'serial' });

/*********************************************************
/* Handling versioned collection without draft enabled
/*********************************************************

To start create a media to use it in other collections/areas, test the upload version behaviours */

let mediaVersionId: string;
let mediaId: string;

test('Should create a Media', async ({ request }) => {
  const base64 = await filePathToBase64(
    path.resolve(process.cwd(), 'tests/versions/landscape.jpg')
  );

  const response = await request.post(`${API_BASE_URL}/medias`, {
    headers: await signInSuperAdmin(request),
    data: {
      file: { base64, filename: ' Land$scape+. +-3.JPG' },
      alt: 'alt'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBeDefined();
  mediaVersionId = doc.versionId;
  mediaId = doc.id;
});

test('Should update a Media (by creating a new version)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      alt: 'alt-2'
    }
  });

  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-2');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).not.toBe(mediaVersionId);
});

test('Should update (again) a Media (by creating a new version)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      alt: 'alt-3'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-3');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).not.toBe(mediaVersionId);
  expect(doc.id).toBe(mediaId);
});

test('Should get the latest Media', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-3');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).not.toBe(mediaVersionId);
  expect(doc.id).toBe(mediaId);
});

test('Should update the first created version of Media', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/medias/${mediaId}?versionId=${mediaVersionId}`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        alt: 'alt-1st'
      }
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1st');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBe(mediaVersionId);
});

test('Should then get the first created version of Media (latest updated)', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1st');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBe(mediaVersionId);
});

test('Should get a 404 when fetching a wrong Medias version', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // The media is there: only the version is wrong
  expect((await request.get(`${API_BASE_URL}/medias/${mediaId}`, { headers })).status()).toBe(200);

  const response = await request.get(`${API_BASE_URL}/medias/${mediaId}?versionId=123`, {
    headers
  });
  const status = response.status();
  expect(status).toBe(404);
});

let secondMediaId: string;
test('Should create an other Media', async ({ request }) => {
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/versions/leaves.jpg'));
  const response = await request.post(`${API_BASE_URL}/medias`, {
    headers: await signInSuperAdmin(request),
    data: {
      file: { base64, filename: ' Leav$e+s..JPG' },
      alt: 'alt leaves'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt leaves');
  expect(doc.filename).toBe('leaves.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBeDefined();
  secondMediaId = doc.id;
});

/****************************************************
/* Handling versioned areas without draft enabled
/****************************************************/

let infoVersionId: string;
let infosId: string;
test('Should get infos', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.title).toBe(null);
  expect(data.doc.versionId).toBeDefined();
  infoVersionId = data.doc.versionId;
  infosId = data.doc.id;
});

test('Should update infos (creating a new version)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'latest'
    }
  });

  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('latest');

  const verify = await request.get(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const verifyData = await verify.json();

  expect(verifyData.doc).toBeDefined();
  expect(verifyData.doc.id).toBe(infosId);
  expect(verifyData.doc.versionId).toBeDefined();
  expect(verifyData.doc.versionId).not.toBe(infoVersionId);
  expect(verifyData.doc.title).toBeDefined();
  expect(verifyData.doc.title).toBe('latest');
});

test('Should get the first infos version', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos?versionId=${infoVersionId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBe(infosId);
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.versionId).toBe(infoVersionId);
  expect(data.doc.title).toBe(null);
});

test('Should update a specific infos version', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos?versionId=${infoVersionId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'newer than latest',
      email: 'hello@gmail.com'
    }
  });
  expect(response.status()).toBe(200);

  const verify = await request.get(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const data = await verify.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.versionId).toBe(infoVersionId);
  expect(data.doc.title).toBe('newer than latest');
  expect(data.doc.id).toBe(infosId);
});

test('Should return 2 versions of infos', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos--versions`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.docs).toBeDefined();
  expect(data.docs).toHaveLength(2);
  expect(data.docs.at(0).title).toBe('newer than latest');
  expect(data.docs.at(1).title).toBe('latest');
});

test('Should return versions with only id versionId and email', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos?select=email`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.title).not.toBeDefined();
  expect(data.doc.email).toBeDefined();
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.email).toBe('hello@gmail.com');
});

test('Should get a 404 when fetching a wrong Infos version', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos/?versionId=123`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(404);
});

/****************************************************
/* Handling versioned areas with draft enabled
/****************************************************/

let settingVersionId: string;

test('Should get settings', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.title).toBe(null);
  expect(data.doc.versionId).toBeDefined();
  settingVersionId = data.doc.versionId;
});

test('Should update the published settings', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'initial settings',
      logo: [mediaId]
    }
  });

  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('initial settings');
  expect(responseData.doc.versionId).toBeDefined();
  expect(responseData.doc.versionId).toBe(settingVersionId);

  const verify = await request.get(`${API_BASE_URL}/settings`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const verifyData = await verify.json();

  expect(verifyData.doc).toBeDefined();
  expect(verifyData.doc.versionId).toBeDefined();
  expect(verifyData.doc.versionId).toBe(settingVersionId);
  expect(verifyData.doc.title).toBeDefined();
  expect(verifyData.doc.title).toBe('initial settings');
  expect(verifyData.doc.logo.map((ref: any) => ref.documentId)).toEqual([mediaId]);
});

test('Should update the settings and create a second settings version', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings?${PARAMS.FORK}=true`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'second settings version'
    }
  });
  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('second settings version');
  expect(responseData.doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(responseData.doc.versionId).toBeDefined();
  expect(responseData.doc.versionId).not.toBe(settingVersionId);
  expect(responseData.doc.logo.map((ref: any) => ref.documentId)).toEqual([mediaId]);
});

test('Should get the published settings', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('initial settings');
  expect(responseData.doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(responseData.doc.versionId).toBe(settingVersionId);
});

test('Should get the latest settings draft and publish it', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings?${PARAMS.LATEST}=true`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('second settings version');
  expect(responseData.doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(responseData.doc.versionId).not.toBe(settingVersionId);

  const publishResponse = await request.patch(
    `${API_BASE_URL}/settings?versionId=${responseData.doc.versionId}`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        status: VERSIONS_STATUS.PUBLISHED,
        maintenance: true
      }
    }
  );

  expect(publishResponse.status()).toBe(200);
  const publishResponseData = await publishResponse.json();
  expect(publishResponseData.doc).toBeDefined();
  expect(publishResponseData.doc.title).toBe('second settings version');
  expect(publishResponseData.doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
});

test('Should get the initial settings as a draft', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings?versionId=${settingVersionId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('initial settings');
  expect(responseData.doc.status).toBe(VERSIONS_STATUS.DRAFT);
});

test('Should return 2 versions of settings', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings--versions`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.docs).toBeDefined();
  expect(data.docs).toHaveLength(2);
  expect(data.docs.at(0).title).toBe('second settings version');
  expect(data.docs.at(0).status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(data.docs.at(1).title).toBe('initial settings');
  expect(data.docs.at(1).status).toBe(VERSIONS_STATUS.DRAFT);
});

test('Should get a 404 when fetching a wrong Settings version', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings?versionId=123`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(404);
});

test('Should get only maintenance field on published Settings', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings?select=maintenance`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const data = await response.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.id).toBeDefined();
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.maintenance).toBeDefined();
  expect(data.doc.maintenance).toBe(true);
  expect(data.doc.title).not.toBeDefined();
  expect(data.doc.logo).not.toBeDefined();
});

/*********************************************************
/* Handling versioned collection with draft enabled
/*********************************************************/

let newsId: string;
let newsVersionId: string;
let secondNewsVersionId: string;

test('Should create a News and publish it', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/news`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'News 1.1',
        slug: 'news-1',
        image: secondMediaId
      },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.attributes.title).toBe('News 1.1');
  expect(doc.attributes.slug).toBeDefined();
  expect(doc.attributes.slug).toBe('news-1');
  expect(doc.attributes.image.map((ref: any) => ref.documentId)).toEqual([secondMediaId]);
  expect(doc.versionId).toBeDefined();
  expect(doc.status).toBeDefined();
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  newsVersionId = doc.versionId;
  newsId = doc.id;
});

test('Should update the initial News by creating a new version', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/news/${newsId}?${PARAMS.FORK}=true`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'News 1.2 draft'
      }
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.attributes.title).toBe('News 1.2 draft');
  expect(doc.attributes.slug).toBeDefined();
  expect(doc.attributes.slug).toBe('news-1');
  expect(doc.attributes.image.map((ref: any) => ref.documentId)).toEqual([secondMediaId]);
  expect(doc.versionId).toBeDefined();
  expect(doc.versionId).not.toBe(newsVersionId);
});

test('Should get the published news', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('News 1.1');
  expect(responseData.doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(responseData.doc.versionId).toBe(newsVersionId);
});

test('Should get the draft news', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}?${PARAMS.LATEST}=true`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('News 1.2 draft');
  expect(responseData.doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(responseData.doc.versionId).not.toBe(newsVersionId);
  secondNewsVersionId = responseData.doc.versionId;
});

test('Should update the initial News and unpublish it', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/news/${newsId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: {
        title: 'News 1.1 unpublished'
      },
      status: VERSIONS_STATUS.DRAFT
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.attributes.title).toBe('News 1.1 unpublished');
  expect(doc.versionId).toBeDefined();
  expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(doc.versionId).toBe(newsVersionId);
});

test('Should not return any news (collection query)', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // The filter finds the news among the newest rows: only the published read leaves it out
  const latest = await request.get(
    `${API_BASE_URL}/news?where[attributes.slug][equals]=news-1&${PARAMS.LATEST}=true`,
    { headers }
  );
  expect(latest.status()).toBe(200);
  expect((await latest.json()).docs.map((doc: { id: string }) => doc.id)).toEqual([newsId]);

  const response = await request.get(`${API_BASE_URL}/news?where[attributes.slug][equals]=news-1`, {
    headers
  });
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(0);
});

test('News should have 2 versions', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/news--versions`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(2);
  expect(docs[0].attributes.title).toBe('News 1.1 unpublished');
  expect(docs[0].status).toBe(VERSIONS_STATUS.DRAFT);
  expect(docs[1].attributes.title).toBe('News 1.2 draft');
  expect(docs[1].status).toBe(VERSIONS_STATUS.DRAFT);
});

test('None should be published and 404 should be returned', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // The news is there, as drafts
  const latest = await request.get(`${API_BASE_URL}/news/${newsId}?${PARAMS.LATEST}=true`, {
    headers
  });
  expect(latest.status()).toBe(200);

  const response = await request.get(`${API_BASE_URL}/news/${newsId}`, {
    headers
  });
  const status = response.status();
  expect(status).toBe(404);
});

test('Should get second news version and publish it', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/news/${newsId}?${PARAMS.VERSION_ID}=${secondNewsVersionId}`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        attributes: {
          title: 'News 1.2 now published'
        },
        status: VERSIONS_STATUS.PUBLISHED
      }
    }
  );
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.attributes.title).toBe('News 1.2 now published');
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(doc.versionId).toBe(secondNewsVersionId);

  const verify = await request.get(`${API_BASE_URL}/news/${newsId}`, {
    headers: await signInSuperAdmin(request)
  });

  expect(verify.status()).toBe(200);
  const verifyData = await verify.json();
  expect(verifyData.doc).toBeDefined();
  expect(verifyData.doc.attributes.title).toBe('News 1.2 now published');
  expect(verifyData.doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
});

test('Now news by id should returned the 1.2 version', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/news/${newsId}`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.attributes.title).toBe('News 1.2 now published');
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(doc.versionId).toBe(secondNewsVersionId);
});

test('Should return one news (collection query)', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/news?where[attributes.slug][equals]=news-1`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(1);
  expect(docs[0].attributes.title).toBe('News 1.2 now published');
  expect(docs[0].versionId).toBe(secondNewsVersionId);
});

/*********************************************************
/* A body `ownerId` moves no version to another document
/*********************************************************/

/** A published news, created as the super admin. */
const createOwnedNews = async (
  request: APIRequestContext,
  headers: { cookie: string },
  title: string,
  extra: Record<string, unknown> = {}
) => {
  const slug = title.toLowerCase().replaceAll(' ', '-');
  return request.post(`${API_BASE_URL}/news`, {
    headers,
    data: { attributes: { title, slug }, status: VERSIONS_STATUS.PUBLISHED, ...extra }
  });
};

/** The titles of the version rows that hang off `id`. */
const versionTitles = async (
  request: APIRequestContext,
  headers: { cookie: string },
  id: string
) => {
  const response = await request.get(
    `${API_BASE_URL}/news--versions?where[ownerId][equals]=${id}`,
    {
      headers
    }
  );
  expect(response.status()).toBe(200);
  return (await response.json()).docs.map((doc: any) => doc.attributes.title);
};

test('A PATCH with another document as ownerId writes its own version', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const a = (await (await createOwnedNews(request, headers, 'Owner probe A')).json()).doc;
  const b = (await (await createOwnedNews(request, headers, 'Owner probe B')).json()).doc;

  const response = await request.patch(`${API_BASE_URL}/news/${a.id}`, {
    headers,
    data: { attributes: { title: 'Owner probe A edited' }, ownerId: b.id }
  });
  expect(response.status()).toBe(200);

  const readA = await request.get(`${API_BASE_URL}/news/${a.id}`, { headers });
  expect(readA.status()).toBe(200);
  expect((await readA.json()).doc.attributes.title).toBe('Owner probe A edited');

  const readB = await request.get(`${API_BASE_URL}/news/${b.id}`, { headers });
  expect((await readB.json()).doc.attributes.title).toBe('Owner probe B');
  expect(await versionTitles(request, headers, b.id)).toEqual(['Owner probe B']);

  await request.delete(`${API_BASE_URL}/news/${a.id}`, { headers });
  await request.delete(`${API_BASE_URL}/news/${b.id}`, { headers });
});

test('A POST with another document as ownerId makes a document of its own', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const b = (await (await createOwnedNews(request, headers, 'Owner probe D')).json()).doc;

  const response = await createOwnedNews(request, headers, 'Owner probe C', { ownerId: b.id });
  expect(response.status()).toBe(200);
  const { doc: c } = await response.json();
  expect(c.id).not.toBe(b.id);
  expect(c.attributes.title).toBe('Owner probe C');
  expect(await versionTitles(request, headers, c.id)).toEqual(['Owner probe C']);

  const readB = await request.get(`${API_BASE_URL}/news/${b.id}`, { headers });
  expect((await readB.json()).doc.attributes.title).toBe('Owner probe D');
  expect(await versionTitles(request, headers, b.id)).toEqual(['Owner probe D']);

  await request.delete(`${API_BASE_URL}/news/${b.id}`, { headers });
  await request.delete(`${API_BASE_URL}/news/${c.id}`, { headers });
});

/*********************************************************
/* Nested + versioned collection (never exercised before —
/* Pages combines nested: true with versions: { draft: true })
/*********************************************************/

let parentPageId: string;
let childPageId: string;
let childPageVersionId: string;

test('Should create a nested Page and publish it', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: { title: 'Parent page', slug: 'parent-page' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.attributes.title).toBe('Parent page');
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  parentPageId = doc.id;
});

test('Should create a child Page as a draft under the parent', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: { title: 'Child page', slug: 'child-page' },
      _parent: parentPageId
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.attributes.title).toBe('Child page');
  expect(doc._parent).toBe(parentPageId);
  // No status supplied on create -> defaults to draft (see
  // handle-new-version.server.ts's prepareDataForNewVersion).
  expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(doc.versionId).toBeDefined();
  childPageId = doc.id;
  childPageVersionId = doc.versionId;
});

test('Should not return the unpublished child in the public collection query', async ({
  request,
  playwright
}) => {
  // Staff find the child by its slug among the newest rows
  const latest = await request.get(
    `${API_BASE_URL}/pages?where[attributes.slug][equals]=child-page&${PARAMS.LATEST}=true`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(latest.status()).toBe(200);
  expect((await latest.json()).docs.map((doc: { id: string }) => doc.id)).toEqual([childPageId]);

  // A visitor does not
  const visitor = await playwright.request.newContext();
  const response = await visitor.get(
    `${API_BASE_URL}/pages?where[attributes.slug][equals]=child-page`
  );
  expect(response.status()).toBe(200);
  const { docs } = await response.json();
  expect(docs).toHaveLength(0);
  await visitor.dispose();
});

test('Should publish the child page and then find it by parent', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // A bare PATCH with no versionId targets "the published version", which
  // doesn't exist yet for a doc that was only ever created as a draft —
  // publishing an existing draft needs to target it explicitly, same
  // pattern the News tests above use.
  const publishResponse = await request.patch(
    `${API_BASE_URL}/pages/${childPageId}?${PARAMS.VERSION_ID}=${childPageVersionId}`,
    {
      headers,
      data: { status: VERSIONS_STATUS.PUBLISHED }
    }
  );
  expect(publishResponse.status()).toBe(200);
  const { doc: publishedDoc } = await publishResponse.json();
  expect(publishedDoc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  expect(publishedDoc.versionId).toBe(childPageVersionId);

  const response = await request.get(
    `${API_BASE_URL}/pages?where[_parent][equals]=${parentPageId}`
  );
  expect(response.status()).toBe(200);
  const { docs } = await response.json();
  expect(docs).toHaveLength(1);
  expect(docs[0].attributes.title).toBe('Child page');

  /**
   * And the other direction: the parent lists the child on `_children`.
   *
   * `nested` populates it on every read, and nothing asserted it — so the read it does could be
   * replaced with an empty array and the whole suite would stay green. It is a filter and an
   * order over columns the feature itself put on the row (`_parent`, `_position`), which is why
   * it can be an ordinary query rather than a method on the adapter named after the question.
   */
  const parent = await request.get(`${API_BASE_URL}/pages/${parentPageId}`, { headers });
  expect(parent.status()).toBe(200);
  const { doc: parentDoc } = await parent.json();
  expect(parentDoc._children).toEqual([childPageId]);
});

/**
 * Sorting a versioned collection by one of its **base-row** columns.
 *
 * `pages` is versioned and nested, so `_position` is on `pages` and every content column is on
 * `pages__versions`. `buildOrderByParam` only looked at the shadow's columns once a prototype had
 * one, so this warned `"_position" is not a property of pages` and silently ordered by `createdAt`
 * — which for two documents created in order is the same answer, and is why nothing caught it.
 *
 * Asserted in both directions for that reason: ascending agrees with creation order, descending
 * does not, so only a real sort passes both.
 */
test('Should sort a versioned collection by a base-row column', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // The parent was created first and the child second; give them the opposite `_position`.
  const parentMoved = await request.patch(`${API_BASE_URL}/pages/${parentPageId}`, {
    headers,
    data: { _position: 2 }
  });
  expect(parentMoved.status()).toBe(200);
  const childMoved = await request.patch(`${API_BASE_URL}/pages/${childPageId}`, {
    headers,
    data: { _position: 1 }
  });
  expect(childMoved.status()).toBe(200);

  const idsSortedBy = async (sort: string) => {
    const response = await request.get(`${API_BASE_URL}/pages?sort=${sort}`, { headers });
    expect(response.status()).toBe(200);
    const { docs } = await response.json();
    return docs
      .map((doc: { id: string }) => doc.id)
      .filter((id: string) => id === parentPageId || id === childPageId);
  };

  expect(await idsSortedBy('_position')).toEqual([childPageId, parentPageId]);
  expect(await idsSortedBy('-_position')).toEqual([parentPageId, childPageId]);
});

/*********************************************************
/* Duplicating a versioned document
/*********************************************************/

test('Should duplicate a published News as a draft copy with a new id', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const response = await request.post(`${API_BASE_URL}/news/${newsId}/duplicate`, { headers });
  expect(response.status()).toBe(200);
  const { id: duplicateId } = await response.json();
  expect(duplicateId).toBeDefined();
  expect(duplicateId).not.toBe(newsId);

  // Draft, not published — duplicating a published doc must not
  // auto-publish the copy (see duplicate.ts's prepareDuplicate).
  const draftResponse = await request.get(
    `${API_BASE_URL}/news/${duplicateId}?${PARAMS.LATEST}=true`,
    { headers }
  );
  expect(draftResponse.status()).toBe(200);
  const { doc: draftDoc } = await draftResponse.json();
  expect(draftDoc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(draftDoc.attributes.title).toBe('News 1.2 now published (copy)');

  // Unpublished, so the public/published read must 404.
  const publishedResponse = await request.get(`${API_BASE_URL}/news/${duplicateId}`, { headers });
  expect(publishedResponse.status()).toBe(404);

  // The original must be untouched.
  const originalResponse = await request.get(`${API_BASE_URL}/news/${newsId}`, { headers });
  const { doc: originalDoc } = await originalResponse.json();
  expect(originalDoc.attributes.title).toBe('News 1.2 now published');
  expect(originalDoc.status).toBe(VERSIONS_STATUS.PUBLISHED);
});

test('Should require create access to duplicate (no credentials)', async ({ request }) => {
  // News.access.create is admin-only — duplicate internally does a create,
  // so it must be gated the same way (see restDuplicate's error handling).
  const response = await request.post(`${API_BASE_URL}/news/${newsId}/duplicate`);
  expect(response.status()).toBe(403);
});

test('Should duplicate a News that was never published (draft-only source)', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  // No status supplied -> created as a draft with no published version at
  // all. duplicate.ts's initial fetch must pass latest: true or it 404s
  // trying to read a published version that doesn't exist.
  const createResponse = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: { attributes: { title: 'Never published', slug: 'never-published' } }
  });
  expect(createResponse.status()).toBe(200);
  const { doc: source } = await createResponse.json();
  expect(source.status).toBe(VERSIONS_STATUS.DRAFT);

  const dupResponse = await request.post(`${API_BASE_URL}/news/${source.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(source.id);

  const draftResponse = await request.get(
    `${API_BASE_URL}/news/${duplicateId}?${PARAMS.LATEST}=true`,
    { headers }
  );
  expect(draftResponse.status()).toBe(200);
  const { doc: draftDoc } = await draftResponse.json();
  expect(draftDoc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(draftDoc.attributes.title).toBe('Never published (copy)');

  const sourceAfter = await request.get(`${API_BASE_URL}/news/${source.id}?${PARAMS.LATEST}=true`, {
    headers
  });
  const { doc: sourceAfterDoc } = await sourceAfter.json();
  expect(sourceAfterDoc.attributes.title).toBe('Never published');
});

test('Should duplicate a nested child Page, keeping it under the same parent', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${childPageId}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(childPageId);

  const draftResponse = await request.get(
    `${API_BASE_URL}/pages/${duplicateId}?${PARAMS.LATEST}=true`,
    { headers }
  );
  expect(draftResponse.status()).toBe(200);
  const { doc: draftDoc } = await draftResponse.json();
  // _parent is preserved as-is by normalizeProps — a duplicated child stays
  // a child of the same parent, as a sibling of the page it was copied from.
  expect(draftDoc._parent).toBe(parentPageId);
  expect(draftDoc.attributes.title).toBe('Child page (copy)');
  expect(draftDoc.status).toBe(VERSIONS_STATUS.DRAFT);

  // Still just the one published child — the copy is a draft, so it must
  // not show up in the public parent query.
  const response = await request.get(
    `${API_BASE_URL}/pages?where[_parent][equals]=${parentPageId}`
  );
  const { docs } = await response.json();
  expect(docs).toHaveLength(1);
});

test('Should refuse to duplicate a Pdf, and a Pdf sharing its file must survive deleting it', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(
    path.resolve(process.cwd(), 'tests/versions/landscape.jpg')
  );
  const createPdf = async (alt: string) => {
    const response = await request.post(`${API_BASE_URL}/pdf`, {
      headers,
      data: {
        file: { base64, filename: 'landscape.jpg' },
        alt,
        status: VERSIONS_STATUS.PUBLISHED
      }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc;
  };

  const source = await createPdf('duplicate source pdf');

  // An upload document is a file on disk: it has no copy
  const dupResponse = await request.post(`${API_BASE_URL}/pdf/${source.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(400);

  // The same content uploaded again shares the file on disk (dedup in saveFile), which is the
  // case removeUnusedFiles's cross-document reference check protects.
  const sharing = await createPdf('sharing pdf');
  expect(sharing.filename).toBe(source.filename);

  const deleteResponse = await request.delete(`${API_BASE_URL}/pdf/${source.id}`, { headers });
  expect(deleteResponse.status()).toBe(200);

  // The other document still reads its file after the first one is gone
  const afterDeleteResponse = await request.get(
    `${API_BASE_URL}/pdf/${sharing.id}?${PARAMS.LATEST}=true`,
    { headers }
  );
  expect(afterDeleteResponse.status()).toBe(200);
  const { doc: survivingDoc } = await afterDeleteResponse.json();
  expect(survivingDoc.filename).toBe(source.filename);
  expect(survivingDoc.alt).toBe('sharing pdf');

  await request.delete(`${API_BASE_URL}/pdf/${sharing.id}`, { headers });
});

/*********************************************************
/* A filtered find with a limit pages the matching documents
/*********************************************************/

test('A filtered find with a limit finds a match that is not in the first rows', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const titles = ['Page limit A', 'Page limit B'];
  const ids: string[] = [];
  for (const title of titles) {
    const response = await request.post(`${API_BASE_URL}/news`, {
      headers,
      data: {
        attributes: { title, slug: title.toLowerCase().replaceAll(' ', '-') },
        status: VERSIONS_STATUS.PUBLISHED
      }
    });
    expect(response.status()).toBe(200);
    ids.push((await response.json()).doc.id);
  }
  for (const title of titles) {
    const query = `where[attributes.title][equals]=${encodeURIComponent(title)}&limit=1`;
    const response = await request.get(`${API_BASE_URL}/news?${query}`, { headers });
    const { docs } = await response.json();
    expect(docs.map((doc: any) => doc.attributes.title)).toEqual([title]);
  }
  for (const id of ids) await request.delete(`${API_BASE_URL}/news/${id}`, { headers });
});

/*********************************************************
/* maxVersions pruning (Pdf configured with maxVersions: 3)
/*********************************************************/

let pdfId: string;

test('Should create a Pdf and exceed maxVersions with draft updates', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  // The pdf collection has no imageSizes/mimetype restriction — reusing the
  // existing jpg fixture is fine, only alt is under test here.
  const base64 = await filePathToBase64(
    path.resolve(process.cwd(), 'tests/versions/landscape.jpg')
  );

  // Published from the start — ?fork=true means "branch a new draft from
  // the currently published version" (see defineVersionUpdateOperation /
  // NEW_VERSION, which starts from the published row), so it 404s
  // with nothing to branch from unless a published version already exists.
  const createResponse = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: { base64, filename: 'landscape.jpg' },
      alt: 'v0',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(createResponse.status()).toBe(200);
  const { doc } = await createResponse.json();
  pdfId = doc.id;

  // A second Pdf with 2 drafts of its own: pruning the first must leave them alone
  const otherResponse = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: { base64, filename: 'landscape.jpg' },
      alt: 'other v0',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(otherResponse.status()).toBe(200);
  const otherPdfId = (await otherResponse.json()).doc.id;
  for (let i = 1; i <= 2; i++) {
    const response = await request.patch(`${API_BASE_URL}/pdf/${otherPdfId}?${PARAMS.FORK}=true`, {
      headers,
      data: { alt: `other v${i}` }
    });
    expect(response.status()).toBe(200);
  }

  // maxVersions is 3 — branch 5 draft versions off the published one, so
  // pruning (which only ever touches non-published rows) has something to
  // prune down to 3. No file in the patch body on purpose: this exercises
  // prepareDataForNewVersion's copy-from-original-path fallback on every
  // branch, including branches created after earlier drafts have already
  // been pruned — a regression guard for removeUnusedFiles deleting a
  // still-shared file (dedup means every version points at the same
  // landscape.jpg) out from under the versions that still reference it.
  for (let i = 1; i <= 5; i++) {
    const response = await request.patch(`${API_BASE_URL}/pdf/${pdfId}?${PARAMS.FORK}=true`, {
      headers,
      data: { alt: `v${i}` }
    });
    expect(response.status()).toBe(200);
  }

  const versionsResponse = await request.get(
    `${API_BASE_URL}/pdf--versions?where[and][0][ownerId][equals]=${pdfId}&where[and][1][status][not_equals]=published&sort=-updatedAt`,
    { headers }
  );
  expect(versionsResponse.status()).toBe(200);
  const { docs } = await versionsResponse.json();
  // Only the newest maxVersions (3) unpublished versions survive.
  expect(docs).toHaveLength(3);
  expect(docs[0].alt).toBe('v5');
  expect(docs[1].alt).toBe('v4');
  expect(docs[2].alt).toBe('v3');

  // The published version is never a pruning candidate — it must survive
  // untouched regardless of maxVersions.
  const publishedResponse = await request.get(`${API_BASE_URL}/pdf/${pdfId}`, { headers });
  const { doc: publishedDoc } = await publishedResponse.json();
  expect(publishedDoc.alt).toBe('v0');
  expect(publishedDoc.status).toBe(VERSIONS_STATUS.PUBLISHED);

  // Pruning is per document: the other Pdf keeps both its drafts
  const otherDrafts = await request.get(
    `${API_BASE_URL}/pdf--versions?where[and][0][ownerId][equals]=${otherPdfId}&where[and][1][status][not_equals]=published`,
    { headers }
  );
  expect((await otherDrafts.json()).docs).toHaveLength(2);
  await request.delete(`${API_BASE_URL}/pdf/${otherPdfId}`, { headers });
});

test('Should keep the only version of a media when another media passes maxVersions', async ({
  request
}) => {
  // medias has `versions: true`, so maxVersions is 12 and every save writes a new version
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(
    path.resolve(process.cwd(), 'tests/versions/landscape.jpg')
  );
  const create = (alt: string) =>
    request
      .post(`${API_BASE_URL}/medias`, {
        headers,
        data: { file: { base64, filename: 'landscape.jpg' }, alt }
      })
      .then((response) => response.json())
      .then(({ doc }) => doc.id as string);

  const firstId = await create('first');
  const secondId = await create('second');
  for (let i = 1; i <= 13; i++) {
    const response = await request.patch(`${API_BASE_URL}/medias/${secondId}`, {
      headers,
      data: { alt: `second v${i}` }
    });
    expect(response.status()).toBe(200);
  }

  expect((await request.get(`${API_BASE_URL}/medias/${firstId}`, { headers })).status()).toBe(200);
  const secondVersions = await request.get(
    `${API_BASE_URL}/medias--versions?where[ownerId][equals]=${secondId}`,
    { headers }
  );
  expect((await secondVersions.json()).docs).toHaveLength(12);

  await request.delete(`${API_BASE_URL}/medias/${firstId}`, { headers });
  await request.delete(`${API_BASE_URL}/medias/${secondId}`, { headers });
});

/*********************************************************
/* Delete cascades to versions
/*********************************************************/

test('Should remove all versions when the owning document is deleted', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const deleteResponse = await request.delete(`${API_BASE_URL}/pdf/${pdfId}`, { headers });
  expect(deleteResponse.status()).toBe(200);

  const versionsResponse = await request.get(
    `${API_BASE_URL}/pdf--versions?where[ownerId][equals]=${pdfId}`,
    { headers }
  );
  expect(versionsResponse.status()).toBe(200);
  const { docs } = await versionsResponse.json();
  expect(docs).toHaveLength(0);

  const getResponse = await request.get(`${API_BASE_URL}/pdf/${pdfId}?${PARAMS.LATEST}=true`, {
    headers
  });
  expect(getResponse.status()).toBe(404);
});

/*********************************************************
/* Sorting a versioned list by a column that lives on the shadow
/*********************************************************/

/**
 * A versioned collection's sortable columns are not on the row being listed.
 *
 * `findMany` queries the base table and pulls the content in through a `with`, so ordering by a
 * content column has to go through a correlated subquery against the shadow — and, for a localized
 * one, a second subquery through the shadow's locales branch. `buildOrderByParam` used to decide
 * which of those to build by asking `config.versions` and then rebuilding the shadow's name with
 * the versions feature's own `withVersionsSuffix`; it is handed the table name now, and a wrong
 * one is silent: the sort simply falls back to `createdAt` and the list still returns 200.
 *
 * `attributes.slug` is localized, so this covers the deeper of the two branches.
 */
test('Should sort a versioned list by a localized content column', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // Two published news whose slugs sort the opposite way round from their creation order, so a
  // fallback to createdAt cannot pass by accident.
  for (const slug of ['sort-probe-b', 'sort-probe-a']) {
    const response = await request.post(`${API_BASE_URL}/news`, {
      headers,
      data: {
        attributes: { title: slug, slug },
        status: VERSIONS_STATUS.PUBLISHED
      }
    });
    expect(response.status()).toBe(200);
  }

  const positions = async (sort: string) => {
    const response = await request.get(`${API_BASE_URL}/news?sort=${sort}`, { headers });
    expect(response.status()).toBe(200);
    const { docs } = await response.json();
    const slugs = docs.map((doc: { attributes: { slug: string } }) => doc.attributes.slug);
    return [slugs.indexOf('sort-probe-a'), slugs.indexOf('sort-probe-b')];
  };

  const [ascA, ascB] = await positions('attributes.slug');
  expect(ascA).toBeGreaterThanOrEqual(0);
  expect(ascA).toBeLessThan(ascB);

  const [descA, descB] = await positions('-attributes.slug');
  expect(descB).toBeGreaterThanOrEqual(0);
  expect(descB).toBeLessThan(descA);
});

/*********************************************************
/* The file is actually removed when nothing references it
/*********************************************************/

/**
 * The other half of the duplicate test above, and the one that was missing.
 *
 * That test proves a shared file **survives** a delete; nothing proved an unshared one is
 * **removed**. The difference matters because the failure is one-sided: `removeUnusedFiles` asks
 * `isFilenameReferenced`, and every way of getting that wrong answers "yes, still referenced"
 * — so the file is silently kept forever and every assertion in the suite still passes.
 *
 * The check runs after the delete, over one table per upload collection, so the document's own
 * rows are gone by then and cannot keep its file.
 *
 * Bytes unique to this test, so `saveFile`'s dedup cannot point it at a file another test owns.
 */
test('Should delete the file from disk when the last document referencing it is deleted', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const filename = 'cleanup-probe.txt';
  // A data URI, which is what filePathToBase64 hands the API elsewhere in this file.
  const payload = Buffer.from(`unique-to-this-test-${Date.now()}`).toString('base64');
  const base64 = `data:text/plain;base64,${payload}`;

  const createResponse = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: { base64, filename },
      alt: 'cleanup probe',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(createResponse.status()).toBe(200);
  const { doc } = await createResponse.json();
  expect(doc.filename).toBe(filename);

  // On disk, and served.
  const beforeDelete = await request.get(`${BASE_URL}/uploads/pdf/${filename}`);
  expect(beforeDelete.status()).toBe(200);

  const deleteResponse = await request.delete(`${API_BASE_URL}/pdf/${doc.id}`, { headers });
  expect(deleteResponse.status()).toBe(200);

  const afterDelete = await request.get(`${BASE_URL}/uploads/pdf/${filename}`);
  expect(afterDelete.status()).toBe(404);
});

/*********************************************************
/* A file goes with the rows that used it, and only with them
/*********************************************************/

/** A text file whose bytes no other test uploads, so `saveFile` shares it with no other row. */
const uniqueTextFile = (name: string) => ({
  base64: `data:text/plain;base64,${Buffer.from(`${name}-${Date.now()}`).toString('base64')}`,
  filename: `${name}.txt`
});

/** One of the suite's images, uploaded under `filename`. */
const imageFile = async (image: string, filename: string) => ({
  base64: await filePathToBase64(path.resolve(process.cwd(), `tests/versions/${image}`)),
  filename
});

/** The status the site answers an uploaded file with, by url, or by name for a Pdf file. */
const servedStatus = async (request: APIRequestContext, file: string) =>
  (
    await request.get(
      file.startsWith('/') ? `${BASE_URL}${file}` : `${BASE_URL}/uploads/pdf/${file}`
    )
  ).status();

test('Replacing the file of the published Pdf keeps the file of its draft', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: uniqueTextFile('replace-published'),
      alt: 'replace probe',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc: published } = await created.json();

  // A newer draft with a file of its own
  const forked = await request.patch(`${API_BASE_URL}/pdf/${published.id}?${PARAMS.FORK}=true`, {
    headers,
    data: { file: uniqueTextFile('replace-draft') }
  });
  expect(forked.status()).toBe(200);
  const { doc: draft } = await forked.json();
  expect(draft.status).toBe(VERSIONS_STATUS.DRAFT);

  // No versionId: the published row is written in place
  const replaced = await request.patch(`${API_BASE_URL}/pdf/${published.id}`, {
    headers,
    data: { file: uniqueTextFile('replace-new') }
  });
  expect(replaced.status()).toBe(200);
  const { doc: republished } = await replaced.json();
  expect(republished.versionId).toBe(published.versionId);

  expect(await servedStatus(request, republished.filename)).toBe(200);
  expect(await servedStatus(request, draft.filename)).toBe(200);
  expect(await servedStatus(request, published.filename)).toBe(404);

  await request.delete(`${API_BASE_URL}/pdf/${published.id}`, { headers });
});

test('A Media given another image under the same name keeps both files', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const filename = `same-name-${Date.now()}.jpg`;

  const created = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: { file: await imageFile('landscape.jpg', filename), alt: 'same name probe' }
  });
  expect(created.status()).toBe(200);
  const { doc: first } = await created.json();
  expect(first.filename).toBe(filename);

  // No drafts: a new version, whose image is saved under a name of its own
  const updated = await request.patch(`${API_BASE_URL}/medias/${first.id}`, {
    headers,
    data: { file: await imageFile('leaves.jpg', filename) }
  });
  expect(updated.status()).toBe(200);
  const { doc: second } = await updated.json();
  expect(second.versionId).not.toBe(first.versionId);
  expect(second.filename).not.toBe(filename);

  expect(await servedStatus(request, second.url)).toBe(200);
  expect(await servedStatus(request, first.url)).toBe(200);

  const older = await request.get(
    `${API_BASE_URL}/medias/${first.id}?${PARAMS.VERSION_ID}=${first.versionId}`,
    { headers }
  );
  expect((await older.json()).doc.filename).toBe(filename);

  await request.delete(`${API_BASE_URL}/medias/${first.id}`, { headers });
});

test('Deleting a Media removes the files of all its versions', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const stamp = Date.now();

  const created = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: {
      file: await imageFile('landscape.jpg', `all-versions-a-${stamp}.jpg`),
      alt: 'all versions v1'
    }
  });
  expect(created.status()).toBe(200);
  const { doc: first } = await created.json();

  // Two more versions sharing the first file
  for (const alt of ['all versions v2', 'all versions v3']) {
    const response = await request.patch(`${API_BASE_URL}/medias/${first.id}`, {
      headers,
      data: { alt }
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).doc.filename).toBe(first.filename);
  }

  // A fourth with a file of its own
  const replaced = await request.patch(`${API_BASE_URL}/medias/${first.id}`, {
    headers,
    data: { file: await imageFile('leaves.jpg', `all-versions-b-${stamp}.jpg`) }
  });
  expect(replaced.status()).toBe(200);
  const { doc: last } = await replaced.json();
  expect(last.filename).not.toBe(first.filename);

  const files = [first.url, first.sizes.thumbnail, last.url, last.sizes.thumbnail];
  for (const file of files) {
    expect(await servedStatus(request, file)).toBe(200);
  }

  const deleted = await request.delete(`${API_BASE_URL}/medias/${first.id}`, { headers });
  expect(deleted.status()).toBe(200);

  for (const file of files) {
    expect(await servedStatus(request, file)).toBe(404);
  }
});

test('Removing the file of a Media leaves its new version with none', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/medias`, {
    headers,
    data: {
      file: await imageFile('landscape.jpg', `removed-file-${Date.now()}.jpg`),
      alt: 'removed file probe'
    }
  });
  expect(created.status()).toBe(200);
  const { doc: first } = await created.json();

  // No drafts: a new version, with no file
  const removed = await request.patch(`${API_BASE_URL}/medias/${first.id}`, {
    headers,
    data: { file: null }
  });
  expect(removed.status()).toBe(200);
  const { doc: second } = await removed.json();
  expect(second.versionId).not.toBe(first.versionId);
  expect(second.filename).toBeNull();
  expect(second.url).toBeNull();

  // The previous version still names its file, which stays on disk
  const older = await request.get(
    `${API_BASE_URL}/medias/${first.id}?${PARAMS.VERSION_ID}=${first.versionId}`,
    { headers }
  );
  expect((await older.json()).doc.filename).toBe(first.filename);
  expect(await servedStatus(request, first.url)).toBe(200);

  await request.delete(`${API_BASE_URL}/medias/${first.id}`, { headers });
});

/*********************************************************
/* Only the server names a document's file
/*********************************************************/

/**
 * `filename` and the size columns name files in `storage/uploads/pdf`, and the server sets them from
 * the file it saved. The path sent here names no file: run against a build that writes it, a
 * delete or a new version would touch nothing real.
 */
test('A Pdf keeps its own file name whatever names a PATCH sends', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: uniqueTextFile('filename-probe'),
      alt: 'filename probe',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  const outside = '../../rime-e2e-no-such-file.txt';
  const response = await request.patch(`${API_BASE_URL}/pdf/${doc.id}`, {
    headers,
    data: { filename: outside, thumbnail: outside }
  });
  expect(response.status()).toBe(200);
  const { doc: patched } = await response.json();
  expect(patched.filename).toBe(doc.filename);
  // A text file has no thumbnail of its own: the size names the file itself
  expect(patched.sizes.thumbnail).toBe(`/uploads/pdf/${doc.filename}`);

  await request.delete(`${API_BASE_URL}/pdf/${doc.id}`, { headers });
});

test('A Pdf branched with ?fork=true keeps no thumbnail a PATCH names', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const created = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: uniqueTextFile('fork-thumbnail-probe'),
      alt: 'fork thumbnail probe',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  // A new version, written by the server from the previous one and this body
  const response = await request.patch(`${API_BASE_URL}/pdf/${doc.id}?${PARAMS.FORK}=true`, {
    headers,
    data: { thumbnail: 'x' }
  });
  expect(response.status()).toBe(200);
  const { doc: draft } = await response.json();
  expect(draft.versionId).not.toBe(doc.versionId);
  // A text file has no thumbnail of its own: the size names the file itself
  expect(draft.sizes.thumbnail).toBe(`/uploads/pdf/${draft.filename}`);

  await request.delete(`${API_BASE_URL}/pdf/${doc.id}`, { headers });
});

/*********************************************************
/* The computed url is stored, on the row that holds the content
/*********************************************************/

/**
 * `populateURL` computes `$url` on every read and puts it on the document — so every assertion
 * about `doc.url` passes whether or not the value was ever written to the database.
 *
 * The write is what this asserts, by filtering on the column: a `where[url]` query reads the
 * stored value and nothing else does. Nothing covered it before, which is how the whole
 * `updateDocumentUrl` branch could be replaced with a silent no-op and stay green — writing `url`
 * to a versioned collection's *base* table simply finds no such column and writes nothing.
 */
test('Should store the computed url on the version row', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const slug = 'url-probe';
  const createResponse = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: { attributes: { title: 'url probe', slug }, status: VERSIONS_STATUS.PUBLISHED }
  });
  expect(createResponse.status()).toBe(200);
  const { doc } = await createResponse.json();

  const url = `${BASE_URL}/actualites/${slug}`;
  expect(doc.url).toBe(url);

  // The document is found by the *stored* url, not the computed one.
  const found = await request.get(
    `${API_BASE_URL}/news?where[url][equals]=${encodeURIComponent(url)}`,
    { headers }
  );
  expect(found.status()).toBe(200);
  const { docs } = await found.json();
  expect(docs.map((one: { id: string }) => one.id)).toContain(doc.id);
});

/*********************************************************
/* Authorship across versions — createdBy / updatedBy
/*********************************************************

`createdBy` is declared `$root()`, so it lives on the document's root row and reads the same
from every version. `updatedBy` is a plain field, so it lives on the version row and answers
"who wrote *this* version". These tests pin that difference. */

const signInReviser = signIn('reviser@email.com', PASSWORD);

let authorshipSuperAdminId: string;
let reviserId: string;

let authoredNewsId: string;
let authoredNewsFirstVersionId: string;

test('Should capture the superadmin id and create a reviser', async ({ request }) => {
  const login = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: PASSWORD }
  });
  expect(login.status()).toBe(200);
  authorshipSuperAdminId = (await login.json()).user.id;

  const reviser = await request.post(`${API_BASE_URL}/staff`, {
    headers: await signInSuperAdmin(request),
    data: {
      email: 'reviser@email.com',
      name: 'Reviser',
      roles: ['admin'],
      password: PASSWORD
    }
  });
  expect(reviser.status()).toBe(200);
  reviserId = (await reviser.json()).doc.id;
});

test('Creating a News stamps both columns with the author', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/news`, {
    headers: await signInSuperAdmin(request),
    data: {
      attributes: { title: 'Authored news', slug: 'authored-news' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(authorshipSuperAdminId);
  expect(doc.updatedBy?.id).toBe(authorshipSuperAdminId);
  authoredNewsId = doc.id;
  authoredNewsFirstVersionId = doc.versionId;
});

test('A new version keeps createdBy and stamps updatedBy with the reviser', async ({ request }) => {
  // `?fork=true` branches a new version off the published one. A plain PATCH rewrites the
  // version in place and would leave `versionId` alone.
  const response = await request.patch(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.FORK}=true`,
    {
      headers: await signInReviser(request),
      data: { attributes: { title: 'Authored news, revised' } }
    }
  );
  expect(response.status()).toBe(200);

  // Read the draft back rather than trusting the PATCH response to report the row it branched.
  const { doc } = await request
    .get(`${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.LATEST}=true`, {
      headers: await signInSuperAdmin(request)
    })
    .then((r) => r.json());

  expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(doc.versionId).not.toBe(authoredNewsFirstVersionId);
  // Base row, shared by every version.
  expect(doc.createdBy?.id).toBe(authorshipSuperAdminId);
  // Version row, written by whoever branched it.
  expect(doc.updatedBy?.id).toBe(reviserId);
});

test('The first version still reports its own writer', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.VERSION_ID}=${authoredNewsFirstVersionId}`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.versionId).toBe(authoredNewsFirstVersionId);
  // Shared with every other version — it hangs off the root row.
  expect(doc.createdBy?.id).toBe(authorshipSuperAdminId);
  // Per version — this one predates the reviser's write.
  expect(doc.updatedBy?.id).toBe(authorshipSuperAdminId);
});

test('The draft version reports the reviser', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.LATEST}=true`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy?.id).toBe(authorshipSuperAdminId);
  expect(doc.updatedBy?.id).toBe(reviserId);
});

let authorshipInfosVersionId: string;

test('An area version records the user that wrote it', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'authorship-1' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.updatedBy?.id).toBe(authorshipSuperAdminId);
  authorshipInfosVersionId = doc.versionId;
});

test('The next area version records the next user, the previous one is unchanged', async ({
  request
}) => {
  const update = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInReviser(request),
    data: { title: 'authorship-2' }
  });
  expect(update.status()).toBe(200);
  const updated = await update.json();
  expect(updated.doc.versionId).not.toBe(authorshipInfosVersionId);
  expect(updated.doc.updatedBy?.id).toBe(reviserId);

  const previous = await request.get(
    `${API_BASE_URL}/infos?${PARAMS.VERSION_ID}=${authorshipInfosVersionId}`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(previous.status()).toBe(200);
  const { doc } = await previous.json();
  expect(doc.title).toBe('authorship-1');
  expect(doc.updatedBy?.id).toBe(authorshipSuperAdminId);
});

/*********************************************************
/* Auto-save — the column, the guards, the reads (news opts in)
/*********************************************************/

test('A version reports the time it was written, not the time the document was', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const first = await request
    .get(
      `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.VERSION_ID}=${authoredNewsFirstVersionId}`,
      {
        headers
      }
    )
    .then((r) => r.json());
  const draft = await request
    .get(`${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.LATEST}=true`, { headers })
    .then((r) => r.json());

  // The draft was branched after the first version was last written.
  expect(new Date(first.doc.updatedAt).getTime()).toBeLessThan(
    new Date(draft.doc.updatedAt).getTime()
  );
});

test('A PATCH cannot set isAutoSave', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.VERSION_ID}=${authoredNewsFirstVersionId}`,
    { headers: await signInSuperAdmin(request), data: { isAutoSave: true } }
  );
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.isAutoSave).toBe(false);
});

test('?autoSave=true on the REST API is an ordinary update', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const versionsUrl = `${API_BASE_URL}/news--versions?where[ownerId][equals]=${authoredNewsId}`;
  const before = await request.get(versionsUrl, { headers }).then((r) => r.json());

  const response = await request.patch(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.VERSION_ID}=${authoredNewsFirstVersionId}&autoSave=true`,
    { headers, data: { attributes: { title: 'Authored news, via REST' } } }
  );
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.isAutoSave).toBe(false);
  expect(doc.versionId).toBe(authoredNewsFirstVersionId);

  const after = await request.get(versionsUrl, { headers }).then((r) => r.json());
  expect(after.docs).toHaveLength(before.docs.length);
});

test('The versions of a public collection are not readable without credentials', async ({
  request
}) => {
  const response = await request.get(`${API_BASE_URL}/news--versions`);
  expect(response.status()).toBe(403);
});

test('Emptying the API cache takes a staff member', async ({ request }) => {
  const anonymous = await request.post(`${API_BASE_URL}/clear-cache`);
  expect(anonymous.status()).toBe(403);

  const staff = await request.post(`${API_BASE_URL}/clear-cache`, {
    headers: await signInSuperAdmin(request)
  });
  expect(staff.status()).toBe(200);
});
