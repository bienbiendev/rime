import { block, blocks, group, text, tree } from '#lib/fields/index.js';
import { describe, expect, it, vi } from 'vitest';
import { buildConfigMap } from '../../config-map/index.js';
import { saveTreeBlocks } from '../tree/index.server.js';
import { saveBlocks } from './index.server.js';

// Two fields whose names start alike: a save of one must not reach the other.
const fields = [
  blocks('nav', [block('link').fields(text('label'))]),
  blocks('navigation', [block('link').fields(text('label'))]),
  tree('menu').fields(text('label')),
  tree('menuFooter').fields(text('label')),
  group('meta').fields(
    text('metaTitle'),
    blocks('gallery', [block('image').fields(text('alt'))]),
    tree('links').fields(text('label'))
  )
] as any[];

const original = {
  id: 'p1',
  nav: [{ id: 'b1', type: 'link', label: 'A', path: 'nav', position: 0 }],
  navigation: [{ id: 'b2', type: 'link', label: 'B', path: 'navigation', position: 0 }],
  menu: [{ id: 't1', label: 'A', path: 'menu', position: 0, _children: [] }],
  menuFooter: [{ id: 't2', label: 'B', path: 'menuFooter', position: 0, _children: [] }],
  meta: {
    metaTitle: 'T',
    gallery: [{ id: 'g1', type: 'image', alt: 'A', path: 'meta.gallery', position: 0 }],
    links: [{ id: 'l1', label: 'A', path: 'meta.links', position: 0, _children: [] }]
  }
};

const adapter = () => ({
  blocks: {
    delete: vi.fn(async () => true),
    create: vi.fn(async () => true),
    update: vi.fn(async () => true)
  },
  tree: {
    delete: vi.fn(async () => true),
    create: vi.fn(async () => true),
    update: vi.fn(async () => true)
  }
});

const contextFor = (data: Record<string, unknown>) => ({
  params: {},
  originalDoc: original,
  configMap: buildConfigMap(data, fields),
  originalConfigMap: buildConfigMap(original, fields)
});

const deletedIds = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map(([args]: any) => args.block.id);

describe('a save reaches only the fields it sends', () => {
  it('emptying `nav` leaves the blocks of `navigation` alone', async () => {
    const data = { nav: [] };
    const db = adapter();
    await saveBlocks({
      context: contextFor(data) as any,
      ownerId: 'p1',
      data,
      incomingPaths: Object.keys(buildConfigMap(data, fields)),
      adapter: db as any,
      ownerSlug: 'pages' as never
    });

    expect(deletedIds(db.blocks.delete)).toEqual(['b1']);
  });

  it('emptying `menu` leaves the rows of `menuFooter` alone', async () => {
    const data = { menu: [] };
    const db = adapter();
    await saveTreeBlocks({
      context: contextFor(data) as any,
      ownerId: 'p1',
      data,
      incomingPaths: Object.keys(buildConfigMap(data, fields)),
      adapter: db as any,
      ownerSlug: 'pages' as never
    });

    expect(deletedIds(db.tree.delete)).toEqual(['t1']);
  });
});

describe('a group sent with some of its members', () => {
  const save = async (data: Record<string, unknown>) => {
    const db = adapter();
    const args = {
      context: contextFor(data) as any,
      ownerId: 'p1',
      data,
      incomingPaths: Object.keys(buildConfigMap(data, fields)),
      adapter: db as any,
      ownerSlug: 'pages' as never
    };
    await saveBlocks(args);
    await saveTreeBlocks(args);
    return db;
  };

  it('keeps the blocks of the others', async () => {
    const db = await save({ meta: { metaTitle: 'x' } });
    expect(db.blocks.delete).not.toHaveBeenCalled();
  });

  it('keeps the tree items of the others', async () => {
    const db = await save({ meta: { metaTitle: 'x' } });
    expect(db.tree.delete).not.toHaveBeenCalled();
  });

  it('replaces the blocks and tree items of the members it sends', async () => {
    const db = await save({ meta: { gallery: [], links: [] } });
    expect(deletedIds(db.blocks.delete)).toEqual(['g1']);
    expect(deletedIds(db.tree.delete)).toEqual(['l1']);
  });
});

describe('a save updates only what changed', () => {
  it('saving `menu` unchanged writes no tree row', async () => {
    const data = { menu: structuredClone(original.menu) };
    const db = adapter();
    await saveTreeBlocks({
      context: contextFor(data) as any,
      ownerId: 'p1',
      data,
      incomingPaths: Object.keys(buildConfigMap(data, fields)),
      adapter: db as any,
      ownerSlug: 'pages' as never
    });

    expect(db.tree.update).not.toHaveBeenCalled();
  });
});

describe('a save updates the rows that changed, and only those', () => {
  it('a changed block label updates that block', async () => {
    const data = { nav: [{ ...original.nav[0], label: 'A, edited' }] };
    const db = adapter();
    await saveBlocks({
      context: contextFor(data) as any,
      ownerId: 'p1',
      data,
      incomingPaths: Object.keys(buildConfigMap(data, fields)),
      adapter: db as any,
      ownerSlug: 'pages' as never
    });

    expect(db.blocks.update).toHaveBeenCalledTimes(1);
    expect(db.blocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        parentSlug: 'pages',
        block: expect.objectContaining({ id: 'b1', label: 'A, edited', path: 'nav' })
      })
    );
  });

  it('a changed tree label updates that item', async () => {
    const data = { menu: [{ ...original.menu[0], label: 'A, edited' }] };
    const db = adapter();
    await saveTreeBlocks({
      context: contextFor(data) as any,
      ownerId: 'p1',
      data,
      incomingPaths: Object.keys(buildConfigMap(data, fields)),
      adapter: db as any,
      ownerSlug: 'pages' as never
    });

    expect(db.tree.update).toHaveBeenCalledTimes(1);
    expect(db.tree.update).toHaveBeenCalledWith(
      expect.objectContaining({
        parentSlug: 'pages',
        block: expect.objectContaining({ id: 't1', label: 'A, edited', path: 'menu' })
      })
    );
  });
});
