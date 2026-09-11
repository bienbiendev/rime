import { PARAMS } from '$lib/core/constants';
import { filePathToBase64 } from '$lib/core/prototype/collection/upload/util/converter.server.js';
import { VERSIONS_STATUS } from '$lib/core/prototype/shared/versions/constant';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

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
});

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
  const response = await request.get(`${API_BASE_URL}/medias/${mediaId}?versionId=123`, {
    headers: await signInSuperAdmin(request)
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

test('Should not return infos versions without credentials', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos--versions`);
  expect(response.status()).toBe(403);
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
  expect(verifyData.doc.logo).toBeDefined();
});

test('Should update the settings and create a second settings version', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/settings?${PARAMS.DRAFT}=true`, {
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
  expect(responseData.doc.logo).toBeDefined();
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
  const response = await request.get(`${API_BASE_URL}/settings?${PARAMS.DRAFT}=true`, {
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

test('Should not return settings versions without credentials', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/settings--versions`);
  expect(response.status()).toBe(403);
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
  expect(doc.attributes.image).toBeDefined();
  expect(doc.versionId).toBeDefined();
  expect(doc.status).toBeDefined();
  expect(doc.status).toBe(VERSIONS_STATUS.PUBLISHED);
  newsVersionId = doc.versionId;
  newsId = doc.id;
});

test('Should update the initial News by creating a new version', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/news/${newsId}?${PARAMS.DRAFT}=true`, {
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
  expect(doc.attributes.image).toBeDefined();
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
  const response = await request.get(`${API_BASE_URL}/news/${newsId}?${PARAMS.DRAFT}=true`, {
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
  const response = await request.get(`${API_BASE_URL}/news?where[attributes.slug][equals]=news-1`, {
    headers: await signInSuperAdmin(request)
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
  const response = await request.get(`${API_BASE_URL}/news/${newsId}`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(404);
});

test('Should get second news version and publish it', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/news/${newsId}?${PARAMS.VERSION_ID}=${secondNewsVersionId}&{PARAMS.DRAFT}=true`,
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
  request
}) => {
  const response = await request.get(
    `${API_BASE_URL}/pages?where[attributes.slug][equals]=child-page`
  );
  expect(response.status()).toBe(200);
  const { docs } = await response.json();
  expect(docs).toHaveLength(0);
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
  await request.patch(`${API_BASE_URL}/pages/${parentPageId}`, { headers, data: { _position: 2 } });
  await request.patch(`${API_BASE_URL}/pages/${childPageId}`, { headers, data: { _position: 1 } });

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
    `${API_BASE_URL}/news/${duplicateId}?${PARAMS.DRAFT}=true`,
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
  // all. duplicate.ts's initial fetch must pass draft: true or it 404s
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
    `${API_BASE_URL}/news/${duplicateId}?${PARAMS.DRAFT}=true`,
    { headers }
  );
  expect(draftResponse.status()).toBe(200);
  const { doc: draftDoc } = await draftResponse.json();
  expect(draftDoc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(draftDoc.attributes.title).toBe('Never published (copy)');

  const sourceAfter = await request.get(`${API_BASE_URL}/news/${source.id}?${PARAMS.DRAFT}=true`, {
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
    `${API_BASE_URL}/pages/${duplicateId}?${PARAMS.DRAFT}=true`,
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

test('Should duplicate a Pdf, and the copy must survive deleting the original', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(
    path.resolve(process.cwd(), 'tests/versions/landscape.jpg')
  );

  const createResponse = await request.post(`${API_BASE_URL}/pdf`, {
    headers,
    data: {
      file: { base64, filename: 'landscape.jpg' },
      alt: 'duplicate source pdf',
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(createResponse.status()).toBe(200);
  const { doc: source } = await createResponse.json();

  const dupResponse = await request.post(`${API_BASE_URL}/pdf/${source.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(source.id);

  const draftResponse = await request.get(
    `${API_BASE_URL}/pdf/${duplicateId}?${PARAMS.DRAFT}=true`,
    { headers }
  );
  expect(draftResponse.status()).toBe(200);
  const { doc: duplicateDoc } = await draftResponse.json();
  // filename isn't the title field here, so it's carried over unchanged —
  // both documents share the same underlying file on disk (dedup in
  // saveFile), which is exactly the scenario cleanUpDocumentFile's
  // cross-document reference check exists to protect.
  expect(duplicateDoc.filename).toBe('landscape.jpg');
  expect(duplicateDoc.alt).toBe('duplicate source pdf');

  const deleteResponse = await request.delete(`${API_BASE_URL}/pdf/${source.id}`, { headers });
  expect(deleteResponse.status()).toBe(200);

  // The duplicate — a wholly separate document — must still be intact,
  // filename and all, after the original it shared a file with is gone.
  const afterDeleteResponse = await request.get(
    `${API_BASE_URL}/pdf/${duplicateId}?${PARAMS.DRAFT}=true`,
    { headers }
  );
  expect(afterDeleteResponse.status()).toBe(200);
  const { doc: survivingDoc } = await afterDeleteResponse.json();
  expect(survivingDoc.filename).toBe('landscape.jpg');
  expect(survivingDoc.alt).toBe('duplicate source pdf');

  await request.delete(`${API_BASE_URL}/pdf/${duplicateId}`, { headers });
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

  // Published from the start — ?draft=true means "branch a new draft from
  // the currently published version" (see defineVersionUpdateOperation /
  // NEW_DRAFT_FROM_PUBLISHED, which fetches with draft: false), so it 404s
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

  // maxVersions is 3 — branch 5 draft versions off the published one, so
  // pruning (which only ever touches non-published rows) has something to
  // prune down to 3. No file in the patch body on purpose: this exercises
  // prepareDataForNewVersion's copy-from-original-path fallback on every
  // branch, including branches created after earlier drafts have already
  // been pruned — a regression guard for cleanUpDocumentFile deleting a
  // still-shared file (dedup means every version points at the same
  // landscape.jpg) out from under the versions that still reference it.
  for (let i = 1; i <= 5; i++) {
    const response = await request.patch(`${API_BASE_URL}/pdf/${pdfId}?${PARAMS.DRAFT}=true`, {
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

  const getResponse = await request.get(`${API_BASE_URL}/pdf/${pdfId}?${PARAMS.DRAFT}=true`, {
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
  expect(descB).toBeLessThan(descA);
});

/*********************************************************
/* The file is actually removed when nothing references it
/*********************************************************/

/**
 * The other half of the duplicate test above, and the one that was missing.
 *
 * That test proves a shared file **survives** a delete; nothing proved an unshared one is
 * **removed**. The difference matters because the failure is one-sided: `cleanUpDocumentFile` asks
 * `isFilenameStillReferenced`, and every way of getting that wrong answers "yes, still referenced"
 * — so the file is silently kept forever and every assertion in the suite still passes.
 *
 * That is exactly what happens if the scan looks at the *base* table of a versioned upload
 * collection as well as its shadow: the base row comes back under a different slug than `selfSlug`,
 * counts as somebody else, and the document protects its own file from deletion. The scan is built
 * to hit one table per collection for that reason.
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
  const beforeDelete = await request.get(`${BASE_URL}/medias/${filename}`);
  expect(beforeDelete.status()).toBe(200);

  const deleteResponse = await request.delete(`${API_BASE_URL}/pdf/${doc.id}`, { headers });
  expect(deleteResponse.status()).toBe(200);

  const afterDelete = await request.get(`${BASE_URL}/medias/${filename}`);
  expect(afterDelete.status()).toBe(404);
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

  const url = `${process.env.PUBLIC_RIME_URL}/actualites/${slug}`;
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

`createdBy` is declared `._root()`, so it lives on the document's root row and reads the same
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
  expect(doc.createdBy).toBe(authorshipSuperAdminId);
  expect(doc.updatedBy).toBe(authorshipSuperAdminId);
  authoredNewsId = doc.id;
  authoredNewsFirstVersionId = doc.versionId;
});

test('A new version keeps createdBy and stamps updatedBy with the reviser', async ({ request }) => {
  // `?draft=true` branches a new version off the published one. A plain PATCH rewrites the
  // version in place and would leave `versionId` alone.
  const response = await request.patch(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.DRAFT}=true`,
    {
      headers: await signInReviser(request),
      data: { attributes: { title: 'Authored news, revised' } }
    }
  );
  expect(response.status()).toBe(200);

  // Read the draft back rather than trusting the PATCH response to report the row it branched.
  const { doc } = await request
    .get(`${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.DRAFT}=true`, {
      headers: await signInSuperAdmin(request)
    })
    .then((r) => r.json());

  expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(doc.versionId).not.toBe(authoredNewsFirstVersionId);
  // Base row, shared by every version.
  expect(doc.createdBy).toBe(authorshipSuperAdminId);
  // Version row, written by whoever branched it.
  expect(doc.updatedBy).toBe(reviserId);
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
  expect(doc.createdBy).toBe(authorshipSuperAdminId);
  // Per version — this one predates the reviser's write.
  expect(doc.updatedBy).toBe(authorshipSuperAdminId);
});

test('The draft version reports the reviser', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/news/${authoredNewsId}?${PARAMS.DRAFT}=true`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.createdBy).toBe(authorshipSuperAdminId);
  expect(doc.updatedBy).toBe(reviserId);
});

let authorshipInfosVersionId: string;

test('An area version records the user that wrote it', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request),
    data: { title: 'authorship-1' }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.updatedBy).toBe(authorshipSuperAdminId);
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
  expect(updated.doc.updatedBy).toBe(reviserId);

  const previous = await request.get(
    `${API_BASE_URL}/infos?${PARAMS.VERSION_ID}=${authorshipInfosVersionId}`,
    { headers: await signInSuperAdmin(request) }
  );
  expect(previous.status()).toBe(200);
  const { doc } = await previous.json();
  expect(doc.title).toBe('authorship-1');
  expect(doc.updatedBy).toBe(authorshipSuperAdminId);
});
