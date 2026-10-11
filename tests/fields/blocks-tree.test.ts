import { filePathToBase64 } from '#lib/core/prototype/collection/upload/util/converter.server.js';
import test, { expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

// The tests share targets, medias and documents: one failing skips the rest
test.describe.configure({ mode: 'serial' });

/** The document ids a relation value holds, in order. */
const refIds = (value: { documentId: string }[]) => value.map((ref) => ref.documentId);

/** The ids of a list of rows, in order. */
const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

/** The page, read back as the super admin. */
async function readPage(request: APIRequestContext, id: string) {
  const response = await request.get(`${API_BASE_URL}/pages/${id}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  return (await response.json()).doc;
}

/**
 * richText fields store tiptap JSONContent, not plain strings — this builds
 * the minimal valid shape with a single identifiable paragraph of text.
 */
function richTextOf(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] };
}

function richTextToString(json: any): string {
  return (json?.content ?? [])
    .flatMap((node: any) => node.content ?? [])
    .map((node: any) => node.text)
    .join('');
}

let targetAId: string;
let targetBId: string;
let mediaAId: string;
let mediaBId: string;
let docId: string;

test('Should create relation targets for block/tree fields', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const a = await request.post(`${API_BASE_URL}/targets`, { headers, data: { title: 'Target A' } });
  expect(a.status()).toBe(200);
  targetAId = (await a.json()).doc.id;
  const b = await request.post(`${API_BASE_URL}/targets`, { headers, data: { title: 'Target B' } });
  expect(b.status()).toBe(200);
  targetBId = (await b.json()).doc.id;
});

/** The image block relates to `medias`, an upload collection: two images to tell apart. */
test('Should create medias for the image blocks', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
  const upload = async (filename: string) => {
    const response = await request.post(`${API_BASE_URL}/medias`, {
      headers,
      data: { file: { base64, filename }, alt: filename }
    });
    expect(response.status()).toBe(200);
    return (await response.json()).doc.id as string;
  };
  mediaAId = await upload('tree-a.jpg');
  mediaBId = await upload('tree-b.jpg');
});

/****************************************************/
/* BLOCKS — creating, reordering, deleting, and
/* whether each block's own field values follow it
/****************************************************/

test('Should create a page with four blocks: two paragraphs and two images, each with distinct content', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Blocks order test',
      sections: [
        { type: 'paragraph', text: richTextOf('Alpha content') },
        { type: 'paragraph', text: richTextOf('Beta content') },
        { type: 'image', image: mediaAId },
        { type: 'image', image: mediaBId }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  docId = doc.id;

  expect(doc.sections).toHaveLength(4);
  expect(doc.sections[0].type).toBe('paragraph');
  expect(richTextToString(doc.sections[0].text)).toBe('Alpha content');
  expect(doc.sections[1].type).toBe('paragraph');
  expect(richTextToString(doc.sections[1].text)).toBe('Beta content');
  expect(doc.sections[2].type).toBe('image');
  expect(refIds(doc.sections[2].image)).toEqual([mediaAId]);
  expect(doc.sections[3].type).toBe('image');
  expect(refIds(doc.sections[3].image)).toEqual([mediaBId]);
});

test('Should keep each block content attached to it after reordering', async ({ request }) => {
  // The stored blocks sent back with their ids, reversed: each row moves, none is rewritten.
  // Every block leaves its slot, and each type comes twice with its own content, so a content
  // that stayed at its position instead of following its block would show.
  const stored = (await readPage(request, docId)).sections;
  const reordered = [stored[3], stored[2], stored[1], stored[0]];
  const response = await request.patch(`${API_BASE_URL}/pages/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { sections: reordered }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(idsOf(doc.sections)).toEqual(idsOf(reordered));
  expect(doc.sections[0].type).toBe('image');
  expect(refIds(doc.sections[0].image)).toEqual([mediaBId]);
  expect(doc.sections[1].type).toBe('image');
  expect(refIds(doc.sections[1].image)).toEqual([mediaAId]);
  expect(doc.sections[2].type).toBe('paragraph');
  expect(richTextToString(doc.sections[2].text)).toBe('Beta content');
  expect(doc.sections[3].type).toBe('paragraph');
  expect(richTextToString(doc.sections[3].text)).toBe('Alpha content');
});

test('Should keep the surviving blocks correct after removing two from the middle', async ({
  request
}) => {
  // The stored blocks sent back with their ids, the two in the middle left out
  const stored = (await readPage(request, docId)).sections;
  const kept = [stored[0], stored[3]];
  const response = await request.patch(`${API_BASE_URL}/pages/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: { sections: kept }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(idsOf(doc.sections)).toEqual(idsOf(kept));
  expect(doc.sections[0].type).toBe('image');
  expect(refIds(doc.sections[0].image)).toEqual([mediaBId]);
  expect(doc.sections[1].type).toBe('paragraph');
  expect(richTextToString(doc.sections[1].text)).toBe('Alpha content');
});

test('Should still have the correct block content after a fresh read', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${docId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections).toHaveLength(2);
  expect(doc.sections[0].type).toBe('image');
  expect(refIds(doc.sections[0].image)).toEqual([mediaBId]);
  expect(doc.sections[1].type).toBe('paragraph');
  expect(richTextToString(doc.sections[1].text)).toBe('Alpha content');
});

/****************************************************/
/* RELATION NESTED INSIDE TREE NESTED INSIDE BLOCK —
/* three levels deep (sections.N.facts.M.image), the
/* real-world shape from rime/pages/tab-layout.ts's
/* keyFacts block
/****************************************************/

let deepDocId: string;

test('Should create a keyFacts block with a tree of relations, three levels deep', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Deep nesting test',
      sections: [
        {
          type: 'keyFacts',
          facts: [
            { label: 'Fact one', image: targetAId, _children: [] },
            { label: 'Fact two', image: targetBId, _children: [] }
          ]
        }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  deepDocId = doc.id;

  expect(doc.sections).toHaveLength(1);
  expect(doc.sections[0].type).toBe('keyFacts');
  expect(doc.sections[0].facts).toHaveLength(2);
  expect(doc.sections[0].facts[0].label).toBe('Fact one');
  expect(refIds(doc.sections[0].facts[0].image)).toEqual([targetAId]);
  expect(doc.sections[0].facts[1].label).toBe('Fact two');
  expect(refIds(doc.sections[0].facts[1].image)).toEqual([targetBId]);
});

test('Should keep each facts own relation attached after reordering the tree inside the block', async ({
  request
}) => {
  // The stored block and its facts sent back with their ids, the facts swapped
  const [block] = (await readPage(request, deepDocId)).sections;
  const swapped = [block.facts[1], block.facts[0]];
  const response = await request.patch(`${API_BASE_URL}/pages/${deepDocId}`, {
    headers: await signInSuperAdmin(request),
    data: { sections: [{ ...block, facts: swapped }] }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections[0].id).toBe(block.id);
  expect(idsOf(doc.sections[0].facts)).toEqual(idsOf(swapped));
  expect(doc.sections[0].facts[0].label).toBe('Fact two');
  expect(refIds(doc.sections[0].facts[0].image)).toEqual([targetBId]);
  expect(doc.sections[0].facts[1].label).toBe('Fact one');
  expect(refIds(doc.sections[0].facts[1].image)).toEqual([targetAId]);
});

test('Should persist a nested child fact with its own relation under the blocks tree', async ({
  request
}) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${deepDocId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      sections: [
        {
          type: 'keyFacts',
          facts: [
            {
              label: 'Fact two',
              image: targetBId,
              _children: [{ label: 'Fact two child', image: targetAId, _children: [] }]
            },
            { label: 'Fact one', image: targetAId, _children: [] }
          ]
        }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections[0].facts[0]._children).toHaveLength(1);
  expect(doc.sections[0].facts[0]._children[0].label).toBe('Fact two child');
  expect(refIds(doc.sections[0].facts[0]._children[0].image)).toEqual([targetAId]);
  // siblings at every level survive the update
  expect(doc.sections[0].facts[1].label).toBe('Fact one');
});

test('Should still have the correct deep-nested relations after a fresh read', async ({
  request
}) => {
  const response = await request.get(`${API_BASE_URL}/pages/${deepDocId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections[0].type).toBe('keyFacts');
  expect(doc.sections[0].facts[0].label).toBe('Fact two');
  expect(doc.sections[0].facts[0]._children[0].label).toBe('Fact two child');
  expect(refIds(doc.sections[0].facts[0]._children[0].image)).toEqual([targetAId]);
  expect(doc.sections[0].facts[1].label).toBe('Fact one');
  expect(refIds(doc.sections[0].facts[1].image)).toEqual([targetAId]);
});

/****************************************************/
/* TREE — creating, reordering, nesting children, and
/* whether each item's own field values follow it
/****************************************************/

let treeDocId: string;

test('Should create a page with three tree items with distinct content', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Tree order test',
      links: [
        { label: 'First', url: { type: 'url', value: 'https://example.com/1' }, _children: [] },
        { label: 'Second', url: { type: 'url', value: 'https://example.com/2' }, _children: [] },
        { label: 'Third', url: { type: 'url', value: 'https://example.com/3' }, _children: [] }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  treeDocId = doc.id;

  expect(doc.links).toHaveLength(3);
  expect(doc.links.map((item: any) => item.label)).toEqual(['First', 'Second', 'Third']);
  expect(doc.links[0].url.value).toBe('https://example.com/1');
  expect(doc.links[2].url.value).toBe('https://example.com/3');
});

test('Should keep each tree item content attached to it after reordering', async ({ request }) => {
  // The stored items sent back with their ids, the last one first
  const stored = (await readPage(request, treeDocId)).links;
  const reordered = [stored[2], stored[0], stored[1]];
  const response = await request.patch(`${API_BASE_URL}/pages/${treeDocId}`, {
    headers: await signInSuperAdmin(request),
    data: { links: reordered }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(idsOf(doc.links)).toEqual(idsOf(reordered));
  expect(doc.links.map((item: any) => item.label)).toEqual(['Third', 'First', 'Second']);
  expect(doc.links[0].url.value).toBe('https://example.com/3');
  expect(doc.links[1].url.value).toBe('https://example.com/1');
  expect(doc.links[2].url.value).toBe('https://example.com/2');
});

test('Should persist a nested child under a tree item alongside its siblings', async ({
  request
}) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${treeDocId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      links: [
        {
          label: 'Third',
          url: { type: 'url', value: 'https://example.com/3' },
          _children: [
            {
              label: 'Third child',
              url: { type: 'url', value: 'https://example.com/3-1' },
              _children: []
            }
          ]
        },
        { label: 'First', url: { type: 'url', value: 'https://example.com/1' }, _children: [] },
        { label: 'Second', url: { type: 'url', value: 'https://example.com/2' }, _children: [] }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.links[0].label).toBe('Third');
  expect(doc.links[0]._children).toHaveLength(1);
  expect(doc.links[0]._children[0].label).toBe('Third child');
  expect(doc.links[0]._children[0].url.value).toBe('https://example.com/3-1');
  // Untouched top-level siblings must still be intact.
  expect(doc.links[1].label).toBe('First');
  expect(doc.links[2].label).toBe('Second');
});

test('Should still have the correct tree structure after a fresh read', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${treeDocId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.links.map((item: any) => item.label)).toEqual(['Third', 'First', 'Second']);
  expect(doc.links[0]._children).toHaveLength(1);
  expect(doc.links[0]._children[0].label).toBe('Third child');
});

/****************************************************/
/* BLOCKS IN A GROUP — a save that sends another
/* member of the group keeps them
/****************************************************/

let groupDocId: string;

test('Should create a page whose group holds an image block', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Group blocks test',
      meta: { metaTitle: 'Before', gallery: [{ type: 'image', image: mediaAId }] }
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  groupDocId = doc.id;

  expect(doc.meta.gallery).toHaveLength(1);
  expect(doc.meta.gallery[0].image.map((ref: any) => ref.documentId)).toEqual([mediaAId]);
});

test('Should keep the blocks of a group when a save sends only another member', async ({
  request
}) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${groupDocId}`, {
    headers: await signInSuperAdmin(request),
    data: { meta: { metaTitle: 'After' } }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.meta.metaTitle).toBe('After');
  expect(doc.meta.gallery).toHaveLength(1);
  expect(doc.meta.gallery[0].image.map((ref: any) => ref.documentId)).toEqual([mediaAId]);
});

test('Should still have the group blocks and their relation after a fresh read', async ({
  request
}) => {
  const response = await request.get(`${API_BASE_URL}/pages/${groupDocId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.meta.metaTitle).toBe('After');
  expect(doc.meta.gallery).toHaveLength(1);
  expect(doc.meta.gallery[0].type).toBe('image');
  expect(doc.meta.gallery[0].image.map((ref: any) => ref.documentId)).toEqual([mediaAId]);
});

/****************************************************/
/* A BLOCK NAMED WITH AN UNDERSCORE — call_to_action
/* keeps the validation and relations of its fields
/****************************************************/

let ctaDocId: string;

test('Should save a call_to_action block with its required text and its relation', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Underscore block test',
      layout: [{ type: 'call_to_action', title: 'Act now', image: targetAId }]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  ctaDocId = doc.id;

  expect(doc.layout).toHaveLength(1);
  expect(doc.layout[0].type).toBe('call_to_action');
  expect(doc.layout[0].title).toBe('Act now');
  expect(doc.layout[0].image.map((ref: any) => ref.documentId)).toEqual([targetAId]);
});

test('Should still have the call_to_action relation after a fresh read', async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/pages/${ctaDocId}`, {
    headers: await signInSuperAdmin(request)
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.layout[0].title).toBe('Act now');
  expect(doc.layout[0].image.map((ref: any) => ref.documentId)).toEqual([targetAId]);
});

test('Should refuse a call_to_action block with its required text empty, on layout.0.title', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Underscore block without text',
      layout: [{ type: 'call_to_action', title: '', image: targetAId }]
    }
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toContain('layout.0.title: ');
});

test('Should refuse a new call_to_action block sent without its required text, on layout.0.title', async ({
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/pages`, {
    headers: await signInSuperAdmin(request),
    data: {
      title: 'Underscore block, text left out',
      layout: [{ type: 'call_to_action', image: targetAId }]
    }
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toContain('layout.0.title: ');
});

test('Should keep the stored text of a call_to_action block a PATCH sends without it', async ({
  request
}) => {
  const headers = await signInSuperAdmin(request);
  const stored = (
    await request.get(`${API_BASE_URL}/pages/${ctaDocId}`, { headers }).then((r) => r.json())
  ).doc;

  const response = await request.patch(`${API_BASE_URL}/pages/${ctaDocId}`, {
    headers,
    data: { layout: [{ id: stored.layout[0].id, type: 'call_to_action', image: [targetAId] }] }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();
  expect(doc.layout[0].title).toBe('Act now');
});
