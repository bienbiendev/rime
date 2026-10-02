import { relation } from '$lib/fields/index.js';
import { describe, expect, it, vi } from 'vitest';
import { saveRelations } from './index.server.js';

// Cast: `medias` is only a registered slug in the fixture that declares it.
const image = (relation('image') as any).to('medias');

const stored = (id: string, path: string, mediasId: string) => ({
  id,
  path,
  position: 0,
  ownerId: 'p1',
  mediasId,
  locale: null
});

const adapterWith = (rows: ReturnType<typeof stored>[]) => ({
  relations: {
    getAll: vi.fn(async () => rows),
    deleteFromPaths: vi.fn(async () => true),
    delete: vi.fn(async () => true),
    update: vi.fn(async () => true),
    create: vi.fn(async () => true)
  }
});

const noDiff = { toAdd: [], toDelete: [], toUpdate: [] };

describe('saveRelations', () => {
  it('a save of `image` leaves the rows of `images` alone', async () => {
    const adapter = adapterWith([stored('r1', 'image', 'm1'), stored('r2', 'images', 'm9')]);

    await saveRelations({
      data: { image: ['m2'] },
      configMap: { image } as any,
      incomingPaths: ['image'],
      blocksDiff: noDiff,
      treeDiff: noDiff as any,
      adapter: adapter as any,
      ownerSlug: 'pages' as never,
      ownerId: 'p1'
    });

    const deleted = adapter.relations.delete.mock.calls.flatMap(([args]: any) => args.relations);
    expect(deleted.map((row: { id: string }) => row.id)).toEqual(['r1']);
    expect(adapter.relations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: [expect.objectContaining({ path: 'image', documentId: 'm2' })]
      })
    );
  });
});
