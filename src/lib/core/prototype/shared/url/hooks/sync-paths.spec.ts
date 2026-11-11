import { describe, expect, it, vi } from 'vitest';
import { movePage } from '../addresses.server.js';
import { refreshUrls } from '../refresh.server.js';

vi.mock('../addresses.server.js', () => ({
  addAddresses: vi.fn(async () => {}),
  movePage: vi.fn(async () => [{ locale: 'en', path: 'q/x' }]),
  withAddress: vi.fn(async ({ doc }) => doc)
}));
vi.mock('../refresh.server.js', () => ({ refreshUrls: vi.fn(async () => {}) }));

const { syncPaths } = await import('./sync-paths.server.js');

/** A save of page `x` of a nested `pages`, from under `was` to under `parent`. */
const save = (was: string | null, parent: string | null) => {
  vi.mocked(movePage).mockClear();
  vi.mocked(refreshUrls).mockClear();
  const paths = { get: vi.fn(async () => [{ locale: 'en', path: 'p/x' }]) };
  return syncPaths({
    config: { slug: 'pages', nested: true },
    event: { locals: { rime: { adapter: { paths } } } },
    doc: { id: 'x', _parent: parent, _position: 1 },
    context: { params: {}, originalDoc: { id: 'x', _parent: was, _position: 0 } }
  } as any);
};

describe('syncPaths', () => {
  it('carries a page moved under another parent there, its descendants with it', async () => {
    await save('p', 'q');
    expect(movePage).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'x', parentId: 'q' }));
    expect(refreshUrls).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'q/x', withDescendants: true })
    );
  });

  it('carries a page moved to the top there', async () => {
    await save('p', null);
    expect(movePage).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'x', parentId: null })
    );
  });

  it('moves nothing when the page changes place in its own list', async () => {
    await save('p', 'p');
    expect(movePage).not.toHaveBeenCalled();
    expect(refreshUrls).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'p/x', withDescendants: false })
    );
  });
});
