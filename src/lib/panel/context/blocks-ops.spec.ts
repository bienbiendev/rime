import { describe, expect, it } from 'vitest';
import {
  duplicateBlock,
  fromClipboard,
  insertBlock,
  mergeTypedSince,
  moveBlock,
  parseBlockPath,
  rekeyErrors,
  removeBlock,
  shiftListPath,
  toClipboard,
  withBlockTypes,
  withFreshIds
} from './blocks-ops.js';

type Block = {
  id: string;
  type: string;
  path: string;
  position: number;
  text?: string;
  items?: Block[];
};

const doc = (): { title: string; sections: Block[] } => ({
  title: 'Page',
  sections: [
    { id: 'p1', type: 'paragraph', path: 'sections', position: 0, text: 'one' },
    {
      id: 'g1',
      type: 'grid',
      path: 'sections',
      position: 1,
      items: [
        { id: 'i1', type: 'paragraph', path: 'sections.1.items', position: 0, text: 'in grid' }
      ]
    },
    { id: 'p2', type: 'paragraph', path: 'sections', position: 2, text: 'three' }
  ]
});

describe('paths', () => {
  it('splits a block path into its list and index, type segments dropped', () => {
    expect(parseBlockPath('sections.0:grid.items.2')).toEqual({
      list: 'sections.0.items',
      index: 2
    });
    expect(parseBlockPath('sections.1')).toEqual({ list: 'sections', index: 1 });
  });

  it('shifts a list under a later sibling when a block goes', () => {
    expect(shiftListPath('sections.3.items', { list: 'sections', index: 1 })).toBe(
      'sections.2.items'
    );
    expect(shiftListPath('sections.0.items', { list: 'sections', index: 1 })).toBe(
      'sections.0.items'
    );
    expect(shiftListPath('other.3.items', { list: 'sections', index: 1 })).toBe('other.3.items');
  });

  it('puts the block types back on a path from the document', () => {
    expect(withBlockTypes('sections.1.items.0', doc())).toBe('sections.1:grid.items.0:paragraph');
    expect(withBlockTypes('sections.1.items', doc())).toBe('sections.1:grid.items');
    expect(withBlockTypes('title', doc())).toBe('title');
  });
});

describe('insert, remove, duplicate', () => {
  it('inserts at an index and rewrites positions', () => {
    const {
      doc: next,
      id,
      lists
    } = insertBlock(doc(), { list: 'sections', index: 1 }, { type: 'image' });
    expect(lists).toEqual(['sections']);
    expect(next.sections.map((b) => b.type)).toEqual(['paragraph', 'image', 'grid', 'paragraph']);
    expect(next.sections[1]).toMatchObject({ id, path: 'sections', position: 1 });
    expect(next.sections[2].items![0].path).toBe('sections.2.items');
  });

  it('appends at the length of the list', () => {
    const { doc: next, id } = insertBlock(doc(), { list: 'sections', index: 3 }, { type: 'image' });
    expect(next.sections.map((b) => b.type)).toEqual(['paragraph', 'grid', 'paragraph', 'image']);
    expect(next.sections[3]).toMatchObject({ id, path: 'sections', position: 3 });
  });

  it('removes a nested block', () => {
    const { doc: next } = removeBlock(doc(), 'sections.1.items.0');
    expect(next.sections[1].items).toEqual([]);
    expect(next.sections).toHaveLength(3);
  });

  it('duplicates below the source with fresh ids all the way down', () => {
    const { doc: next, id } = duplicateBlock(doc(), 'sections.1');
    expect(next.sections.map((b) => b.type)).toEqual(['paragraph', 'grid', 'grid', 'paragraph']);
    const copy = next.sections[2];
    expect(copy.id).toBe(id);
    expect(copy.id).toMatch(/^temp-/);
    expect(copy.items![0].id).toMatch(/^temp-/);
    expect(copy.items![0].path).toBe('sections.2.items');
    expect(next.sections[3].position).toBe(3);
  });

  it('duplicates nothing at an index with no block', () => {
    const before = doc();
    const { doc: next, id, lists } = duplicateBlock(before, 'sections.5');
    expect(id).toBeNull();
    expect(lists).toEqual([]);
    expect(next).toBe(before);
  });
});

describe('move', () => {
  it('reorders within a list, the way a sortable reports it', () => {
    const { doc: next } = moveBlock(doc(), 'sections.0', { list: 'sections', index: 2 });
    expect(next.sections.map((b) => b.id)).toEqual(['g1', 'p2', 'p1']);
    expect(next.sections.map((b) => b.position)).toEqual([0, 1, 2]);
    expect(next.sections[0].items![0].path).toBe('sections.0.items');
  });

  it('moves into a nested list and rewrites the subtree', () => {
    const { doc: next, lists } = moveBlock(doc(), 'sections.2', {
      list: 'sections.1.items',
      index: 0
    });
    expect(lists).toEqual(['sections', 'sections.1.items']);
    expect(next.sections.map((b) => b.id)).toEqual(['p1', 'g1']);
    expect(next.sections[1].items!.map((b) => b.id)).toEqual(['p2', 'i1']);
    expect(next.sections[1].items![0]).toMatchObject({ path: 'sections.1.items', position: 0 });
  });

  it('follows the target list when the removal shifts it', () => {
    const { doc: next } = moveBlock(doc(), 'sections.0', { list: 'sections.1.items', index: 1 });
    // `sections.1.items` is `sections.0.items` once the first block is gone
    expect(next.sections.map((b) => b.id)).toEqual(['g1', 'p2']);
    expect(next.sections[0].items!.map((b) => b.id)).toEqual(['i1', 'p1']);
    expect(next.sections[0].items![1].path).toBe('sections.0.items');
  });

  it('moves out of a nested list', () => {
    const { doc: next } = moveBlock(doc(), 'sections.1.items.0', { list: 'sections', index: 0 });
    expect(next.sections.map((b) => b.id)).toEqual(['i1', 'p1', 'g1', 'p2']);
    expect(next.sections[2].items).toEqual([]);
    expect(next.sections[0]).toMatchObject({ path: 'sections', position: 0 });
  });

  it('refuses a move into its own subtree', () => {
    const before = doc();
    const { doc: next, lists } = moveBlock(before, 'sections.1', {
      list: 'sections.1.items',
      index: 0
    });
    expect(lists).toEqual([]);
    expect(next).toBe(before);
  });
});

describe('clipboard', () => {
  it('round-trips a block and refuses anything else', () => {
    const block = doc().sections[1];
    expect(fromClipboard(JSON.stringify(toClipboard(block)))).toEqual({
      rime: 'block',
      type: 'grid',
      block
    });
    expect(fromClipboard(JSON.stringify({ rime: 'block', type: 'grid' }))).toBeNull();
    expect(fromClipboard('{"foo":1}')).toBeNull();
    expect(fromClipboard('not json')).toBeNull();
  });

  it('gives a pasted block fresh ids and keeps everything else', () => {
    const source = doc().sections[1];
    const copy = withFreshIds(source);
    expect(copy.id).toMatch(/^temp-/);
    expect(copy.items![0].id).toMatch(/^temp-/);
    expect({ ...copy, id: 'g1', items: [{ ...copy.items![0], id: 'i1' }] }).toEqual(source);
  });

  it('keeps the ids a rich-text link names', () => {
    const body = {
      type: 'doc',
      content: [
        { type: 'resource', attrs: { id: 'page-42' } },
        { type: 'upload', attrs: { id: 'media-7' } }
      ]
    };
    const copy = withFreshIds({ ...doc().sections[1], body });
    expect(copy.body.content[0].attrs.id).toBe('page-42');
    expect(copy.body.content[1].attrs.id).toBe('media-7');
    expect(copy.items![0].id).not.toBe('i1');
  });

  it('sets the locale given on a row that carries one', () => {
    const rows = [
      { id: 'r1', relationTo: 'pages', documentId: 'p1', locale: 'en' },
      { id: 'r2', relationTo: 'pages', documentId: 'p2' }
    ];
    const copy = withFreshIds(rows, { locale: 'fr' });
    expect(copy.map((row) => row.id)).not.toContain('r1');
    expect(copy[0].locale).toBe('fr');
    expect('locale' in copy[1]).toBe(false);
  });
});

describe('mergeTypedSince', () => {
  it('takes a shortened list whole', () => {
    const sent = { ...doc(), updatedAt: 'sent' };
    const now = { ...sent, sections: sent.sections.slice(1) };
    const server = { ...sent, updatedAt: 'later' };
    const merged = mergeTypedSince(server, sent, now);
    expect(merged.sections.map((b) => b.id)).toEqual(['g1', 'p2']);
    expect(merged.updatedAt).toBe('later');
  });

  it('takes a shortened nested list whole, and lays a typed field on the server row', () => {
    const sent = { ...doc(), updatedAt: 'sent' };
    const [paragraph, grid, last] = sent.sections;
    const now = { ...sent, title: 'Typed', sections: [paragraph, { ...grid, items: [] }, last] };
    const server = { ...sent, updatedAt: 'later' };
    const merged = mergeTypedSince(server, sent, now);
    expect(merged.sections[1].items).toEqual([]);
    expect(merged.title).toBe('Typed');
    expect(merged.updatedAt).toBe('later');
  });

  it('gives the items a shortened list keeps the ids the server saved them under', () => {
    // A block and a nested one added, then sent; the first block removed before the answer
    const sent = doc();
    const [paragraph, grid, last] = sent.sections;
    const added = { id: 'temp-x', type: 'paragraph', path: 'sections', position: 3 };
    const nested = { ...grid.items![0], id: 'temp-y', position: 1 };
    sent.sections = [paragraph, { ...grid, items: [...grid.items!, nested] }, last, added];
    const server = {
      ...sent,
      sections: sent.sections.map((block) => ({
        ...block,
        id: block.id.replace('temp-', 'real-'),
        items: block.items?.map((item) => ({ ...item, id: item.id.replace('temp-', 'real-') }))
      }))
    };
    const now = { ...sent, sections: sent.sections.slice(1) };

    const merged = mergeTypedSince(server, sent, now);
    expect(merged.sections.map((block) => block.id)).toEqual(['g1', 'p2', 'real-x']);
    expect(merged.sections[0].items!.map((item) => item.id)).toEqual(['i1', 'real-y']);
  });
});

describe('rekeyErrors', () => {
  it('moves the errors with their block', () => {
    const before = doc();
    const { doc: after } = removeBlock(before, 'sections.0');
    const errors = { 'sections.0.text': 'a', 'sections.2.text': 'b', title: 'c' };
    expect(rekeyErrors(errors, before, after)).toEqual({ 'sections.1.text': 'b', title: 'c' });
  });

  it('follows a block moved into a nested list, and the block it pushes down', () => {
    const before = doc();
    const { doc: after } = moveBlock(before, 'sections.2', { list: 'sections.1.items', index: 0 });
    const errors = { 'sections.2.text': 'moved', 'sections.1.items.0.text': 'pushed' };
    expect(rekeyErrors(errors, before, after)).toEqual({
      'sections.1.items.0.text': 'moved',
      'sections.1.items.1.text': 'pushed'
    });
  });
});
