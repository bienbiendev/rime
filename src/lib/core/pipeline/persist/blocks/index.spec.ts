import { block, blocks, text, tree } from '$lib/fields/index.js';
import { describe, expect, it, vi } from 'vitest';
import { buildConfigMap } from '../../config-map/index.js';
import { saveTreeBlocks } from '../tree/index.server.js';
import { saveBlocks } from './index.server.js';

// Two fields whose names start alike: a save of one must not reach the other.
const fields = [
  blocks('nav', [block('link').fields(text('label'))]),
  blocks('navigation', [block('link').fields(text('label'))]),
  tree('menu').fields(text('label')),
  tree('menuFooter').fields(text('label'))
] as any[];

const original = {
  id: 'p1',
  nav: [{ id: 'b1', type: 'link', label: 'A', path: 'nav', position: 0 }],
  navigation: [{ id: 'b2', type: 'link', label: 'B', path: 'navigation', position: 0 }],
  menu: [{ id: 't1', label: 'A', path: 'menu', position: 0, _children: [] }],
  menuFooter: [{ id: 't2', label: 'B', path: 'menuFooter', position: 0, _children: [] }]
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
