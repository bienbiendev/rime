import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import { PARAMS } from '#lib/core/constants.js';
import { VERSIONS_STATUS } from '#lib/core/prototype/shared/versions/constant.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

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
      alt: 'alt en'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBeDefined();
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
  mediaVersionId = doc.versionId;
  mediaId = doc.id;
});

test('Should update a Media (by creating a new version)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      alt: 'alt-1.2 en'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1.2 en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
  expect(doc.versionId).not.toBe(mediaVersionId);
});

test('Should update (again) a Media (by creating a new version)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      alt: 'alt-1.3 en'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1.3 en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).not.toBe(mediaVersionId);
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
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
  expect(doc.alt).toBe('alt-1.3 en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).not.toBe(mediaVersionId);
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
  expect(doc.id).toBe(mediaId);
});

test('Should update the first created version of Media', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/medias/${mediaId}?versionId=${mediaVersionId}`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        alt: 'alt-1.1 en'
      }
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1.1 en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
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
  expect(doc.alt).toBe('alt-1.1 en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBe(mediaVersionId);
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
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
      alt: 'alt-2.1 en'
    }
  });
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-2.1 en');
  expect(doc.filename).toBe('leaves.jpg');
  expect(doc.mimeType).toBe('image/jpeg');
  expect(doc.versionId).toBeDefined();
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
  secondMediaId = doc.id;
});

// No alt is written in fr or de yet: each falls back to the default locale's, en
test('Should get 2 docs in FR, each alt falling back to EN', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/medias?locale=fr`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(2);
  expect(docs.map((doc: { locale: string }) => doc.locale)).toEqual(['fr', 'fr']);
  expect(docs.at(0).alt).toBe('alt-2.1 en');
  expect(docs.at(1).alt).toBe('alt-1.1 en');
});

test('Should get 2 docs in DE, each alt falling back to EN', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/medias?locale=de`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(2);
  expect(docs.map((doc: { locale: string }) => doc.locale)).toEqual(['de', 'de']);
  expect(docs.at(0).alt).toBe('alt-2.1 en');
  expect(docs.at(1).alt).toBe('alt-1.1 en');
});

test('Should get 2 docs EN', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/medias`, {
    headers: await signInSuperAdmin(request)
  });
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(2);
  expect(docs.at(0).alt).toBe('alt-2.1 en');
  expect(docs.at(1).alt).toBe('alt-1.1 en');
});

test('Should update 1st media created in DE', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/medias/${mediaId}?${PARAMS.VERSION_ID}=${mediaVersionId}&locale=de`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        alt: 'alt-1.1 de'
      }
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1.1 de');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.versionId).toBe(mediaVersionId);
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('de');
  expect(doc.id).toBe(mediaId);
});

test('Should update 1st media created in FR', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/medias/${mediaId}?${PARAMS.VERSION_ID}=${mediaVersionId}&locale=fr`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        alt: 'alt-1.1 fr'
      }
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1.1 fr');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.versionId).toBe(mediaVersionId);
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('fr');
  expect(doc.id).toBe(mediaId);
});

test('Should still 1st media EN alt', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/medias/${mediaId}?${PARAMS.VERSION_ID}=${mediaVersionId}`,
    {
      headers: await signInSuperAdmin(request)
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { doc } = await response.json();
  expect(doc).toBeDefined();
  expect(doc.alt).toBe('alt-1.1 en');
  expect(doc.filename).toBe('landscape-3.jpg');
  expect(doc.versionId).toBe(mediaVersionId);
  expect(doc.locale).toBeDefined();
  expect(doc.locale).toBe('en');
  expect(doc.id).toBe(mediaId);
});

test('Should get 3 versions of 1st media (EN)', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/medias--versions?where[ownerId][equals]=${mediaId}`,
    {
      headers: await signInSuperAdmin(request)
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(3);
  expect(docs.at(0).alt).toBe('alt-1.1 en');
  expect(docs.at(1).alt).toBe('alt-1.3 en');
  expect(docs.at(2).alt).toBe('alt-1.2 en');
  expect(docs.at(0).filename).toBe('landscape-3.jpg');
  expect(docs.at(1).filename).toBe('landscape-3.jpg');
  expect(docs.at(2).filename).toBe('landscape-3.jpg');
});

test('Should get 3 versions of 1st media (FR)', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/medias--versions?where[ownerId][equals]=${mediaId}&locale=fr`,
    {
      headers: await signInSuperAdmin(request)
    }
  );
  const status = response.status();
  expect(status).toBe(200);
  const { docs } = await response.json();
  expect(docs).toBeDefined();
  expect(docs).toHaveLength(3);
  expect(docs.at(0).alt).toBe('alt-1.1 fr');
  expect(docs.at(1).alt).toBe('alt-1.3 en');
  expect(docs.at(2).alt).toBe('alt-1.2 en');
  expect(docs.at(0).filename).toBe('landscape-3.jpg');
  expect(docs.at(1).filename).toBe('landscape-3.jpg');
  expect(docs.at(2).filename).toBe('landscape-3.jpg');
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

test('Should update the 1st infos version (FR)', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/infos?versionId=${infoVersionId}&locale=fr`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        title: 'newer than latest (FR)',
        email: 'hello@gmail.fr'
      }
    }
  );
  expect(response.status()).toBe(200);

  const verify = await request.get(`${API_BASE_URL}/infos?locale=fr`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const data = await verify.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.versionId).toBe(infoVersionId);
  expect(data.doc.title).toBe('newer than latest (FR)');
  expect(data.doc.id).toBe(infosId);
});

test('Should update the 1st infos version (DE)', async ({ request }) => {
  const response = await request.patch(
    `${API_BASE_URL}/infos?versionId=${infoVersionId}&locale=de`,
    {
      headers: await signInSuperAdmin(request),
      data: {
        title: 'newer than latest (DE)',
        email: 'hello@gmail.de'
      }
    }
  );
  expect(response.status()).toBe(200);

  const verify = await request.get(`${API_BASE_URL}/infos?locale=de`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const data = await verify.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.versionId).toBe(infoVersionId);
  expect(data.doc.title).toBe('newer than latest (DE)');
  expect(data.doc.id).toBe(infosId);
});

test('Should return 2 versions of infos (EN)', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos--versions`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.docs).toBeDefined();
  expect(data.docs).toHaveLength(2);
  // Never written in EN, the first version reads the French title by fallback.
  expect(data.docs.at(0).title).toBe('newer than latest (FR)');
  expect(data.docs.at(1).title).toBe('latest');
});

test('Should return 2 versions of infos (FR)', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos--versions?locale=fr`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.docs).toBeDefined();
  expect(data.docs).toHaveLength(2);
  expect(data.docs.at(0).title).toBe('newer than latest (FR)');
  expect(data.docs.at(0).email).toBe('hello@gmail.fr');
  expect(data.docs.at(1).title).toBe('latest');
});

test('Should return 2 versions of infos (DE)', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/infos--versions?locale=de`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.docs).toBeDefined();
  expect(data.docs).toHaveLength(2);
  expect(data.docs.at(0).title).toBe('newer than latest (DE)');
  expect(data.docs.at(0).email).toBe('hello@gmail.de');
  expect(data.docs.at(1).title).toBe('latest');
});

test('Should update the 1st infos version (EN)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos?versionId=${infoVersionId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'newer than latest (EN)',
      email: 'hello@gmail.com'
    }
  });
  expect(response.status()).toBe(200);

  const verify = await request.get(`${API_BASE_URL}/infos?locale=fr`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const data = await verify.json();
  expect(data.doc).toBeDefined();
  expect(data.doc.versionId).toBeDefined();
  expect(data.doc.versionId).toBe(infoVersionId);
  expect(data.doc.title).toBe('newer than latest (FR)');
  expect(data.doc.id).toBe(infosId);

  // The version reads the new title in EN
  const en = await request
    .get(`${API_BASE_URL}/infos?${PARAMS.VERSION_ID}=${infoVersionId}`, {
      headers: await signInSuperAdmin(request)
    })
    .then((r) => r.json());
  expect(en.doc.title).toBe('newer than latest (EN)');
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

test('Should update infos (creating a new version) (FR)', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/infos`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'newer than newer'
    }
  });

  expect(response.status()).toBe(200);
  const responseData = await response.json();
  expect(responseData.doc).toBeDefined();
  expect(responseData.doc.title).toBe('newer than newer');

  // The new version keeps the French title the previous one had: a save in one locale leaves
  // the translations of the others alone.
  const verify = await request.get(`${API_BASE_URL}/infos?locale=fr`, {
    headers: await signInSuperAdmin(request)
  });
  expect(verify.status()).toBe(200);
  const verifyData = await verify.json();

  expect(verifyData.doc).toBeDefined();
  expect(verifyData.doc.id).toBe(infosId);
  expect(verifyData.doc.versionId).toBeDefined();
  expect(verifyData.doc.versionId).not.toBe(infoVersionId);
  expect(verifyData.doc.title).toBe('newer than latest (FR)');

  const en = await request
    .get(`${API_BASE_URL}/infos`, { headers: await signInSuperAdmin(request) })
    .then((r) => r.json());
  expect(en.doc.versionId).toBe(verifyData.doc.versionId);
  expect(en.doc.title).toBe('newer than newer');
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
/* Duplicating a versioned + localized document — the
/* locale-looping branch in duplicate.ts (id-mapping,
/* per-locale title/status) is exercised nowhere else
/*********************************************************/

test('Should duplicate a News keeping each locale’s own title, as drafts', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const createResponse = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Multi EN', slug: 'multi-locale-dup' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(createResponse.status()).toBe(200);
  const { doc: original } = await createResponse.json();

  const fr = await request.patch(`${API_BASE_URL}/news/${original.id}?locale=fr`, {
    headers,
    data: { attributes: { title: 'Multi FR' }, status: VERSIONS_STATUS.PUBLISHED }
  });
  expect(fr.status()).toBe(200);
  const de = await request.patch(`${API_BASE_URL}/news/${original.id}?locale=de`, {
    headers,
    data: { attributes: { title: 'Multi DE' }, status: VERSIONS_STATUS.PUBLISHED }
  });
  expect(de.status()).toBe(200);

  const dupResponse = await request.post(`${API_BASE_URL}/news/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(original.id);

  const expectedTitles: [string, string][] = [
    ['en', 'Multi EN (copy)'],
    ['fr', 'Multi FR (copy)'],
    ['de', 'Multi DE (copy)']
  ];
  for (const [locale, expectedTitle] of expectedTitles) {
    const draftResponse = await request.get(
      `${API_BASE_URL}/news/${duplicateId}?locale=${locale}&${PARAMS.LATEST}=true`,
      { headers }
    );
    expect(draftResponse.status()).toBe(200);
    const { doc } = await draftResponse.json();
    // Duplicating a published doc must not auto-publish the copy, in every
    // locale, not just the default one (see duplicate.ts's prepareDuplicate).
    expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
    expect(doc.attributes.title).toBe(expectedTitle);
  }

  await request.delete(`${API_BASE_URL}/news/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/news/${duplicateId}`, { headers });
});

test('Should duplicate a never-published News across every locale', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  // No status supplied -> draft-only, no published version at all, in any
  // locale. Combines both duplicate.ts gaps: the initial default-locale
  // fetch needs latest: true (no published row to fall back to), and the
  // per-locale loop needs newDocument's own versionId (no published row to
  // update either).
  const createResponse = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: { attributes: { title: 'Never EN', slug: 'never-published-multi' } }
  });
  const { doc: original } = await createResponse.json();
  expect(original.status).toBe(VERSIONS_STATUS.DRAFT);
  expect(original.versionId).toBeDefined();

  // ?fork=true means "branch a new draft from the published version" —
  // there isn't one here (draft-only from create), so it would 404. Target
  // the existing draft version directly instead, same pattern as the
  // maxVersions test above.
  const frPatch = await request.patch(
    `${API_BASE_URL}/news/${original.id}?locale=fr&${PARAMS.VERSION_ID}=${original.versionId}`,
    {
      headers,
      data: { attributes: { title: 'Never FR' } }
    }
  );
  expect(frPatch.status()).toBe(200);

  const dePatch = await request.patch(
    `${API_BASE_URL}/news/${original.id}?locale=de&${PARAMS.VERSION_ID}=${original.versionId}`,
    {
      headers,
      data: { attributes: { title: 'Never DE' } }
    }
  );
  expect(dePatch.status()).toBe(200);

  const dupResponse = await request.post(`${API_BASE_URL}/news/${original.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();
  expect(duplicateId).not.toBe(original.id);

  const expectedTitles: [string, string][] = [
    ['en', 'Never EN (copy)'],
    ['fr', 'Never FR (copy)'],
    ['de', 'Never DE (copy)']
  ];
  for (const [locale, expectedTitle] of expectedTitles) {
    const draftResponse = await request.get(
      `${API_BASE_URL}/news/${duplicateId}?locale=${locale}&${PARAMS.LATEST}=true`,
      { headers }
    );
    expect(draftResponse.status()).toBe(200);
    const { doc } = await draftResponse.json();
    expect(doc.status).toBe(VERSIONS_STATUS.DRAFT);
    expect(doc.attributes.title).toBe(expectedTitle);
  }

  await request.delete(`${API_BASE_URL}/news/${original.id}`, { headers });
  await request.delete(`${API_BASE_URL}/news/${duplicateId}`, { headers });
});

/*********************************************************
/* Duplicating a nested + versioned Page in a localized app
/* (the collection's own fields aren't .localized() here — this
/* exercises the locale loop running over a document whose data
/* doesn't actually vary by locale)
/*********************************************************/

test('Should duplicate a nested child Page, keeping it under the same parent', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);

  const parentResponse = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: 'ML Parent page', slug: 'ml-parent-page' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  const { doc: parent } = await parentResponse.json();

  const childResponse = await request.post(`${API_BASE_URL}/pages`, {
    headers,
    data: {
      attributes: { title: 'ML Child page', slug: 'ml-child-page' },
      _parent: parent.id,
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  const { doc: child } = await childResponse.json();
  expect(child._parent).toBe(parent.id);

  const dupResponse = await request.post(`${API_BASE_URL}/pages/${child.id}/duplicate`, {
    headers
  });
  expect(dupResponse.status()).toBe(200);
  const { id: duplicateId } = await dupResponse.json();

  const draftResponse = await request.get(
    `${API_BASE_URL}/pages/${duplicateId}?${PARAMS.LATEST}=true`,
    { headers }
  );
  expect(draftResponse.status()).toBe(200);
  const { doc: draftDoc } = await draftResponse.json();
  expect(draftDoc._parent).toBe(parent.id);
  expect(draftDoc.attributes.title).toBe('ML Child page (copy)');
  expect(draftDoc.status).toBe(VERSIONS_STATUS.DRAFT);

  // The copy is a draft, so the public parent query must still see only
  // the one originally-published child.
  const response = await request.get(`${API_BASE_URL}/pages?where[_parent][equals]=${parent.id}`);
  const { docs } = await response.json();
  expect(docs).toHaveLength(1);

  await request.delete(`${API_BASE_URL}/pages/${child.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${parent.id}`, { headers });
  await request.delete(`${API_BASE_URL}/pages/${duplicateId}`, { headers });
});

/*********************************************************
/* A new draft written in one locale leaves the published
/* version alone in every locale
/*********************************************************/

test('A new EN draft leaves the published version alone in every locale', async ({ request }) => {
  const headers = await signInSuperAdmin(request);

  const createResponse = await request.post(`${API_BASE_URL}/news`, {
    headers,
    data: {
      attributes: { title: 'Independence EN', slug: 'independence-test' },
      status: VERSIONS_STATUS.PUBLISHED
    }
  });
  expect(createResponse.status()).toBe(200);
  const { doc } = await createResponse.json();

  const fr = await request.patch(`${API_BASE_URL}/news/${doc.id}?locale=fr`, {
    headers,
    data: { attributes: { title: 'Independence FR' }, status: VERSIONS_STATUS.PUBLISHED }
  });
  expect(fr.status()).toBe(200);

  // A new EN draft, not published
  const fork = await request.patch(`${API_BASE_URL}/news/${doc.id}?locale=en&${PARAMS.FORK}=true`, {
    headers,
    data: { attributes: { title: 'Independence EN draft' } }
  });
  expect(fork.status()).toBe(200);
  const draft = await request
    .get(`${API_BASE_URL}/news/${doc.id}?locale=en&${PARAMS.LATEST}=true`, { headers })
    .then((r) => r.json());
  expect(draft.doc.attributes.title).toBe('Independence EN draft');

  // The published version reads as before, in EN and in FR
  const enPublished = await request
    .get(`${API_BASE_URL}/news/${doc.id}?locale=en`, { headers })
    .then((r) => r.json());
  expect(enPublished.doc.attributes.title).toBe('Independence EN');
  expect(enPublished.doc.status).toBe(VERSIONS_STATUS.PUBLISHED);

  const frPublished = await request
    .get(`${API_BASE_URL}/news/${doc.id}?locale=fr`, { headers })
    .then((r) => r.json());
  expect(frPublished.doc.attributes.title).toBe('Independence FR');
  expect(frPublished.doc.status).toBe(VERSIONS_STATUS.PUBLISHED);

  await request.delete(`${API_BASE_URL}/news/${doc.id}`, { headers });
});

/*********************************************************
/* An editor's new version, checked against `update` only,
/* keeps in every locale the field the editor may not read
/*********************************************************/

test('An editor saves a version of news they may not create, keeping the admin note in every locale', async ({
  request
}) => {
  const admin = await signInSuperAdmin(request);
  const editorEmail = `news-editor-${Date.now()}@email.com`;
  const staff = await request.post(`${API_BASE_URL}/staff`, {
    headers: admin,
    data: { email: editorEmail, name: 'News editor', roles: ['editor'], password: PASSWORD }
  });
  expect(staff.status()).toBe(200);
  const editor = await signIn(editorEmail, PASSWORD)(request);

  const created = await request.post(`${API_BASE_URL}/news?locale=fr`, {
    headers: admin,
    data: { attributes: { title: 'Note FR', slug: `note-fr-${Date.now()}`, adminNote: 'note fr' } }
  });
  expect(created.status()).toBe(200);
  const { doc } = await created.json();

  const english = await request.patch(
    `${API_BASE_URL}/news/${doc.id}?locale=en&${PARAMS.LATEST}=true`,
    {
      headers: admin,
      data: {
        attributes: { title: 'Note EN', slug: `note-en-${Date.now()}`, adminNote: 'note en' }
      }
    }
  );
  expect(english.status()).toBe(200);

  // `create` is admin-only: the version is part of the update
  const saved = await request.patch(
    `${API_BASE_URL}/news/${doc.id}?locale=fr&${PARAMS.FORK}=true&${PARAMS.LATEST}=true`,
    { headers: editor, data: { attributes: { title: 'Note FR edited' } } }
  );
  expect(saved.status()).toBe(200);
  const { doc: savedDoc } = await saved.json();
  expect(savedDoc.attributes.title).toBe('Note FR edited');
  expect(savedDoc.attributes).not.toHaveProperty('adminNote');

  const read = async (locale: string) =>
    (
      await (
        await request.get(`${API_BASE_URL}/news/${doc.id}?locale=${locale}&${PARAMS.LATEST}=true`, {
          headers: admin
        })
      ).json()
    ).doc;
  const fr = await read('fr');
  expect(fr.attributes.title).toBe('Note FR edited');
  expect(fr.attributes.adminNote).toBe('note fr');
  const en = await read('en');
  expect(en.attributes.title).toBe('Note EN');
  expect(en.attributes.adminNote).toBe('note en');

  await request.delete(`${API_BASE_URL}/news/${doc.id}`, { headers: admin });
});

/*********************************************************
/* A new area version copies the other locales as a locale
/* copy: their values are not hooked a second time
/*********************************************************/

test('A versioned area copies the other locales onto a new version without hooking them again', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const save = (locale: string, data: object) =>
    request.patch(`${API_BASE_URL}/contact?locale=${locale}`, { headers, data });
  const read = async (locale: string) =>
    (await (await request.get(`${API_BASE_URL}/contact?locale=${locale}`, { headers })).json()).doc;

  expect((await save('en', { title: 'Hello', marker: 'm' })).status()).toBe(200);
  expect((await read('en')).marker).toBe('m-saved');

  // A save in fr makes a new version, onto which en is copied
  expect((await save('fr', { title: 'Bonjour' })).status()).toBe(200);
  expect((await read('en')).marker).toBe('m-saved');
  expect((await read('fr')).title).toBe('Bonjour');
});
