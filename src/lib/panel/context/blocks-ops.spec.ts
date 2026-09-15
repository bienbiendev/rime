import { describe, expect, it } from 'vitest';
import {
  duplicateBlock,
  fromClipboard,
  insertBlock,
  moveBlock,
  parseBlockPath,
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
    expect(copy.id).not.toBe('g1');
    expect(copy.items![0].id).not.toBe('i1');
    expect(copy.items![0].path).toBe('sections.2.items');
    expect(next.sections[3].position).toBe(3);
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
    const data = toClipboard(doc().sections[1]);
    const text = JSON.stringify(data);
    expect(fromClipboard(text)?.type).toBe('grid');
    expect(fromClipboard('{"foo":1}')).toBeNull();
    expect(fromClipboard('not json')).toBeNull();
  });

  it('gives a pasted block fresh ids', () => {
    const copy = withFreshIds(doc().sections[1]);
    expect(copy.id).not.toBe('g1');
    expect(copy.items![0].id).not.toBe('i1');
  });
});
