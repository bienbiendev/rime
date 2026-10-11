import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';
const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

/**
 * Relations wherever a page can hold one, through the API: at the root (`thumbnail`), in a group
 * (`meta.metaImage`), in a tab inside that group (`meta.seo.seoImage`), in blocks (`sections`:
 * image, gallery, a grid's items, a keyFacts tree) and in a tree (`links.target`). Each is added,
 * changed, moved and removed, and a page holding all of them is duplicated.
 */

type Headers = { cookie: string };
let headers: Headers;
let targets: string[];
let medias: string[];

/** The document ids a relation value holds, in order. */
const docsOf = (value: any): string[] => (value ?? []).map((ref: any) => ref.documentId);

const create = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_BASE_URL}/pages`, { headers, data });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

const patch = async (request: APIRequestContext, id: string, data: object) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${id}`, { headers, data });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

const read = async (request: APIRequestContext, id: string) => {
  const response = await request.get(`${API_BASE_URL}/pages/${id}`, { headers });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
};

// Runs again in a fresh worker after a failure, so every test finds its targets and medias
test.beforeAll(async ({ request }) => {
  headers = await signInSuperAdmin(request);
  targets = [];
  for (const title of ['Rel A', 'Rel B', 'Rel C']) {
    const response = await request.post(`${API_BASE_URL}/targets`, { headers, data: { title } });
    expect(response.status()).toBe(200);
    targets.push((await response.json()).doc.id);
  }
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  medias = [];
  for (const filename of ['rel-a.jpg', 'rel-b.jpg']) {
    const response = await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: { file: { base64, filename }, alt: filename }
    });
    expect(response.status()).toBe(200);
    medias.push((await response.json()).doc.id);
  }
});

/****************************************************/
/* Root
/****************************************************/

test('Root: a relation is added, changed by its row, changed by id, and removed', async ({
  request
}) => {
  const [a, b, c] = targets;
  const page = await create(request, { title: 'Root relation', thumbnail: a });
  expect(docsOf(page.thumbnail)).toEqual([a]);

  // The ref sent back as read, pointing at another document: the row takes it
  const [ref] = page.thumbnail;
  expect(
    docsOf((await patch(request, page.id, { thumbnail: [{ ...ref, documentId: b }] })).thumbnail)
  ).toEqual([b]);
  expect(docsOf((await read(request, page.id)).thumbnail)).toEqual([b]);

  expect(docsOf((await patch(request, page.id, { thumbnail: c })).thumbnail)).toEqual([c]);
  expect(docsOf((await patch(request, page.id, { thumbnail: null })).thumbnail)).toEqual([]);
});

/****************************************************/
/* Group and tabs
/****************************************************/

test('Group: a relation is added, changed and removed, and survives a sibling edit', async ({
  request
}) => {
  const [a, b] = targets;
  const page = await create(request, { title: 'Group relation', meta: { metaImage: a } });
  expect(docsOf(page.meta.metaImage)).toEqual([a]);

  // Another field of the group, sent alone: the relation stays
  const edited = await patch(request, page.id, { meta: { metaTitle: 'Edited' } });
  expect(docsOf(edited.meta.metaImage)).toEqual([a]);

  const [ref] = edited.meta.metaImage;
  const changed = await patch(request, page.id, {
    meta: { metaImage: [{ ...ref, documentId: b }] }
  });
  expect(docsOf(changed.meta.metaImage)).toEqual([b]);

  const removed = await patch(request, page.id, { meta: { metaImage: null } });
  expect(docsOf(removed.meta.metaImage)).toEqual([]);
});

test('Tabs in a group: a relation is added, changed and removed at its own path', async ({
  request
}) => {
  const [a, b] = targets;
  const page = await create(request, {
    title: 'Tab relation',
    meta: { seo: { seoTitle: 'Seo', seoImage: a } }
  });
  expect(docsOf(page.meta.seo.seoImage)).toEqual([a]);

  const changed = await patch(request, page.id, { meta: { seo: { seoImage: b } } });
  expect(docsOf(changed.meta.seo.seoImage)).toEqual([b]);
  expect(changed.meta.seo.seoTitle).toBe('Seo');

  const removed = await patch(request, page.id, { meta: { seo: { seoImage: null } } });
  expect(docsOf(removed.meta.seo.seoImage)).toEqual([]);
});

/****************************************************/
/* Blocks
/****************************************************/

test('Blocks: image and gallery relations are added and read back in order', async ({
  request
}) => {
  const [m1, m2] = medias;
  const page = await create(request, {
    title: 'Blocks relations',
    sections: [
      { type: 'image', image: m1 },
      { type: 'gallery', images: [m2, m1] }
    ]
  });
  expect(docsOf(page.sections[0].image)).toEqual([m1]);
  expect(docsOf(page.sections[1].images)).toEqual([m2, m1]);
});

test('Blocks: a block image is changed, and the gallery reordered by its rows', async ({
  request
}) => {
  const [m1, m2] = medias;
  const page = await create(request, {
    title: 'Blocks change',
    sections: [
      { type: 'image', image: m1 },
      { type: 'gallery', images: [m1, m2] }
    ]
  });
  const [image, gallery] = page.sections;
  const updated = await patch(request, page.id, {
    sections: [
      { ...image, image: m2 },
      { ...gallery, images: [...gallery.images].reverse() }
    ]
  });
  expect(docsOf(updated.sections[0].image)).toEqual([m2]);
  expect(docsOf(updated.sections[1].images)).toEqual([m2, m1]);
});

test('Blocks: a new block first moves the old one, and each keeps its own image', async ({
  request
}) => {
  const [m1, m2] = medias;
  const page = await create(request, {
    title: 'Blocks move',
    sections: [{ type: 'image', image: m1 }]
  });
  const updated = await patch(request, page.id, {
    sections: [
      { type: 'image', image: m2 },
      { ...page.sections[0], image: m1 }
    ]
  });
  expect(updated.sections.map((block: any) => docsOf(block.image))).toEqual([[m2], [m1]]);
  const again = await read(request, page.id);
  expect(again.sections.map((block: any) => docsOf(block.image))).toEqual([[m2], [m1]]);
});

test('Blocks: removing a block removes its relations, the others stay', async ({ request }) => {
  const [m1, m2] = medias;
  const page = await create(request, {
    title: 'Blocks delete',
    sections: [
      { type: 'image', image: m1 },
      { type: 'image', image: m2 }
    ]
  });
  const updated = await patch(request, page.id, { sections: [page.sections[1]] });
  expect(updated.sections).toHaveLength(1);
  expect(docsOf(updated.sections[0].image)).toEqual([m2]);

  // A new block where the removed one ended: no relation of the old blocks is left at its path
  const added = await patch(request, page.id, {
    sections: [updated.sections[0], { type: 'image' }]
  });
  expect(added.sections.map((block: any) => docsOf(block.image))).toEqual([[m2], []]);
});

test("Blocks: a grid's nested image is added and changed", async ({ request }) => {
  const [m1, m2] = medias;
  const page = await create(request, {
    title: 'Grid relations',
    sections: [{ type: 'grid', title: 'Grid', items: [{ type: 'image', image: m1 }] }]
  });
  expect(docsOf(page.sections[0].items[0].image)).toEqual([m1]);
  const grid = page.sections[0];
  const updated = await patch(request, page.id, {
    sections: [{ ...grid, items: [{ ...grid.items[0], image: m2 }] }]
  });
  expect(docsOf(updated.sections[0].items[0].image)).toEqual([m2]);
});

test('Blocks: the relations of a keyFacts tree follow their items', async ({ request }) => {
  const [a, b, c] = targets;
  const page = await create(request, {
    title: 'KeyFacts relations',
    sections: [
      {
        type: 'keyFacts',
        facts: [
          { label: 'First', image: a },
          { label: 'Second', image: b }
        ]
      }
    ]
  });
  const block = page.sections[0];
  expect(block.facts.map((fact: any) => [fact.label, docsOf(fact.image)])).toEqual([
    ['First', [a]],
    ['Second', [b]]
  ]);

  // Reordered, one changed, one added
  const updated = await patch(request, page.id, {
    sections: [
      {
        ...block,
        facts: [{ ...block.facts[1], image: c }, block.facts[0], { label: 'Third', image: a }]
      }
    ]
  });
  expect(updated.sections[0].facts.map((fact: any) => [fact.label, docsOf(fact.image)])).toEqual([
    ['Second', [c]],
    ['First', [a]],
    ['Third', [a]]
  ]);

  // One removed
  const facts = updated.sections[0].facts;
  const removed = await patch(request, page.id, {
    sections: [{ ...updated.sections[0], facts: [facts[0], facts[2]] }]
  });
  expect(removed.sections[0].facts.map((fact: any) => [fact.label, docsOf(fact.image)])).toEqual([
    ['Second', [c]],
    ['Third', [a]]
  ]);
});

/****************************************************/
/* Tree
/****************************************************/

test('Tree: the relations of its items follow them when added, moved and removed', async ({
  request
}) => {
  const [a, b, c] = targets;
  const page = await create(request, {
    title: 'Tree relations',
    links: [
      { label: 'One', target: a },
      { label: 'Two', target: b, _children: [{ label: 'Two child', target: c }] }
    ]
  });
  const labelsAndTargets = (items: any[]): any[] =>
    items.map((item) => [item.label, docsOf(item.target), labelsAndTargets(item._children ?? [])]);
  expect(labelsAndTargets(page.links)).toEqual([
    ['One', [a], []],
    ['Two', [b], [['Two child', [c], []]]]
  ]);

  const [one, two] = page.links;
  const moved = await patch(request, page.id, {
    links: [{ ...two, target: a }, one]
  });
  expect(labelsAndTargets(moved.links)).toEqual([
    ['Two', [a], [['Two child', [c], []]]],
    ['One', [a], []]
  ]);

  const removed = await patch(request, page.id, { links: [moved.links[1]] });
  expect(labelsAndTargets(removed.links)).toEqual([['One', [a], []]]);
});

/****************************************************/
/* Duplicate
/****************************************************/

test('Duplicate: the copy holds the same relations, and editing it leaves the original alone', async ({
  request
}) => {
  const [a, b, c] = targets;
  const [m1, m2] = medias;
  const page = await create(request, {
    title: 'Duplicate relations',
    thumbnail: a,
    meta: { metaImage: b, seo: { seoImage: c } },
    sections: [
      { type: 'image', image: m1 },
      { type: 'gallery', images: [m1, m2] },
      { type: 'keyFacts', facts: [{ label: 'Fact', image: b }] }
    ],
    links: [{ label: 'Link', target: c }]
  });

  const response = await request.post(`${API_BASE_URL}/pages/${page.id}/duplicate`, { headers });
  expect(response.status()).toBe(200);
  const copyId = (await response.json()).id;
  expect(copyId).not.toBe(page.id);

  const relationsOf = (doc: any) => ({
    thumbnail: docsOf(doc.thumbnail),
    metaImage: docsOf(doc.meta.metaImage),
    seoImage: docsOf(doc.meta.seo.seoImage),
    image: docsOf(doc.sections[0].image),
    gallery: docsOf(doc.sections[1].images),
    fact: docsOf(doc.sections[2].facts[0].image),
    link: docsOf(doc.links[0].target)
  });
  const original = relationsOf(await read(request, page.id));
  const copy = await read(request, copyId);
  expect(relationsOf(copy)).toEqual(original);

  // The copy's rows are its own: changing them changes the copy and leaves the original alone
  await patch(request, copyId, { thumbnail: c, meta: { metaImage: null } });
  expect(relationsOf(await read(request, copyId))).toEqual({
    ...original,
    thumbnail: [c],
    metaImage: []
  });
  expect(relationsOf(await read(request, page.id))).toEqual(original);
});
