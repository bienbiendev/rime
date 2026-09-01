import { filePathToBase64 } from '$lib/core/features/upload/util/converter.server.js';
import { PARAMS, VERSIONS_STATUS } from '$lib/core/constants';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

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
