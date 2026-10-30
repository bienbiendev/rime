import { describe, expect, test } from 'vitest';
import { documentLoad } from './load.server.js';

const config = {
  slug: 'medias',
  kebab: 'medias',
  upload: {},
  label: { plural: 'Medias' },
  access: { create: () => true, read: () => true, update: () => true }
};

/** The page of medias `id` at `search`, for a staff user; the stored media is in `root:news`. */
const load = (id: string, search = '') =>
  documentLoad({
    params: { slug: 'medias', id },
    url: new URL(`http://localhost/panel/medias/${id}${search}`),
    locals: {
      user: { isStaff: true },
      rime: {
        config: { isCollection: () => true, prototypes: [config] },
        routes: { panel: 'panel', panelUrl: (kebab = '') => `/panel/${kebab}` },
        collection: () => ({
          config,
          initial: () => ({ _path: null }),
          findById: async () => ({ id: 'm1', _path: 'root:news' })
        })
      }
    }
  } as any);

/** The folder crumbs: every crumb between the collection's and the document's. */
const folders = async (id: string, search?: string) => {
  const { aria } = await load(id, search);
  return aria.slice(2, -1).map((crumb) => crumb.title);
};

describe('documentLoad', () => {
  test("an existing media's breadcrumb shows its own folder, whatever the URL says", async () => {
    expect(await folders('m1')).toEqual(['news']);
    expect(await folders('m1', '?uploadPath=root')).toEqual(['news']);
  });

  test('a new media is in the folder the URL names, the root without one', async () => {
    expect(await folders('create', '?uploadPath=root:press')).toEqual(['press']);
    expect(await folders('create')).toEqual([]);
  });
});
