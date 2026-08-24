import test, { expect } from '@playwright/test';
import { API_BASE_URL, signIn } from '../util.js';

const PASSWORD = process.env.TESTS_ADMIN_PASSWORD || 'a&1Aa&1A';
const ADMIN_EMAIL = process.env.TESTS_ADMIN_EMAIL || 'admin@email.com';

const signInSuperAdmin = signIn(ADMIN_EMAIL, PASSWORD);

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
let docId: string;

test('Should create relation targets for block/tree fields', async ({ request }) => {
  const headers = await signInSuperAdmin(request);
  const a = await request.post(`${API_BASE_URL}/targets`, { headers, data: { title: 'Target A' } });
  targetAId = (await a.json()).doc.id;
  const b = await request.post(`${API_BASE_URL}/targets`, { headers, data: { title: 'Target B' } });
  targetBId = (await b.json()).doc.id;
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
        { type: 'image', image: targetAId },
        { type: 'image', image: targetBId }
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
  expect(doc.sections[2].image.map((ref: any) => ref.documentId)).toContain(targetAId);
  expect(doc.sections[3].type).toBe('image');
  expect(doc.sections[3].image.map((ref: any) => ref.documentId)).toContain(targetBId);
});

test('Should keep each block content attached to it after reordering', async ({ request }) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      sections: [
        { type: 'image', image: targetBId },
        { type: 'paragraph', text: richTextOf('Beta content') },
        { type: 'image', image: targetAId },
        { type: 'paragraph', text: richTextOf('Alpha content') }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections).toHaveLength(4);
  // Every position changed relative to the previous test — if block
  // reordering ever misattributed content by position instead of by the
  // block's own data, this is exactly the shuffle that would catch it: two
  // same-typed pairs (paragraph/paragraph, image/image) with different
  // content, none of them left in their original slot.
  expect(doc.sections[0].type).toBe('image');
  expect(doc.sections[0].image.map((ref: any) => ref.documentId)).toContain(targetBId);
  expect(doc.sections[1].type).toBe('paragraph');
  expect(richTextToString(doc.sections[1].text)).toBe('Beta content');
  expect(doc.sections[2].type).toBe('image');
  expect(doc.sections[2].image.map((ref: any) => ref.documentId)).toContain(targetAId);
  expect(doc.sections[3].type).toBe('paragraph');
  expect(richTextToString(doc.sections[3].text)).toBe('Alpha content');
});

test('Should keep the surviving blocks correct after removing two from the middle', async ({
  request
}) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${docId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      sections: [
        { type: 'image', image: targetBId },
        { type: 'paragraph', text: richTextOf('Alpha content') }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections).toHaveLength(2);
  expect(doc.sections[0].type).toBe('image');
  expect(doc.sections[0].image.map((ref: any) => ref.documentId)).toContain(targetBId);
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
  expect(doc.sections[0].image.map((ref: any) => ref.documentId)).toContain(targetBId);
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
  expect(doc.sections[0].facts[0].image.map((ref: any) => ref.documentId)).toContain(targetAId);
  expect(doc.sections[0].facts[1].label).toBe('Fact two');
  expect(doc.sections[0].facts[1].image.map((ref: any) => ref.documentId)).toContain(targetBId);
});

test('Should keep each facts own relation attached after reordering the tree inside the block', async ({
  request
}) => {
  const response = await request.patch(`${API_BASE_URL}/pages/${deepDocId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      sections: [
        {
          type: 'keyFacts',
          facts: [
            { label: 'Fact two', image: targetBId, _children: [] },
            { label: 'Fact one', image: targetAId, _children: [] }
          ]
        }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

  expect(doc.sections[0].facts).toHaveLength(2);
  expect(doc.sections[0].facts[0].label).toBe('Fact two');
  expect(doc.sections[0].facts[0].image.map((ref: any) => ref.documentId)).toContain(targetBId);
  expect(doc.sections[0].facts[1].label).toBe('Fact one');
  expect(doc.sections[0].facts[1].image.map((ref: any) => ref.documentId)).toContain(targetAId);
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
  expect(doc.sections[0].facts[0]._children[0].image.map((ref: any) => ref.documentId)).toContain(
    targetAId
  );
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
  expect(doc.sections[0].facts[0]._children[0].image.map((ref: any) => ref.documentId)).toContain(
    targetAId
  );
  expect(doc.sections[0].facts[1].label).toBe('Fact one');
  expect(doc.sections[0].facts[1].image.map((ref: any) => ref.documentId)).toContain(targetAId);
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
  const response = await request.patch(`${API_BASE_URL}/pages/${treeDocId}`, {
    headers: await signInSuperAdmin(request),
    data: {
      links: [
        { label: 'Third', url: { type: 'url', value: 'https://example.com/3' }, _children: [] },
        { label: 'First', url: { type: 'url', value: 'https://example.com/1' }, _children: [] },
        { label: 'Second', url: { type: 'url', value: 'https://example.com/2' }, _children: [] }
      ]
    }
  });
  expect(response.status()).toBe(200);
  const { doc } = await response.json();

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
