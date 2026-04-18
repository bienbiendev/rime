import { filePathToBase64 } from '$lib/core/collections/upload/util/converter.js';
import { PARAMS, VERSIONS_STATUS } from '$lib/core/constant';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const signInSuperAdmin = signIn('admin@bienoubien.studio', 'a&1Aa&1A');

test('Superadmin login should be successfull', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
    data: {
      email: 'admin@bienoubien.studio',
      password: 'a&1Aa&1A'
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
  const response = await request.get(`${API_BASE_URL}/infos_versions`, {
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
  const response = await request.get(`${API_BASE_URL}/infos_versions`);
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
  const response = await request.get(`${API_BASE_URL}/settings_versions`, {
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
  const response = await request.get(`${API_BASE_URL}/settings_versions`);
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
  const response = await request.get(`${API_BASE_URL}/news_versions`, {
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
