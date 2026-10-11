import { RimeError } from '#lib/core/errors/index.js';
import { describe, expect, it, vi } from 'vitest';
import { refuseCyclicParent } from './refuse-cyclic-parent.server.js';

/** Each page's `_parent`, as the adapter reads it. */
type Tree = Record<string, string | null>;

/** company > services > s4 */
const tree: Tree = { company: null, services: 'company', s4: 'services' };

/** Moves `id` under `parent` in `pages`. */
const move = (id: string, parent: string | null, pages: Tree = tree) => {
  const find = vi.fn(async ({ id }: { id: string }) =>
    id in pages ? { id, _parent: pages[id] } : undefined
  );
  const promise = refuseCyclicParent({
    config: { slug: 'pages' },
    data: { _parent: parent },
    event: { locals: { rime: { adapter: { collection: () => ({ find }) } } } },
    context: { params: { id } }
  } as any);
  return { promise, find };
};

const refused = expect.objectContaining({ code: RimeError.BAD_REQUEST });

describe('refuseCyclicParent', () => {
  it('refuses a page under itself', async () => {
    await expect(move('services', 'services').promise).rejects.toEqual(refused);
  });

  it('refuses a page under a page below it', async () => {
    await expect(move('services', 's4').promise).rejects.toEqual(refused);
  });

  it('lets a page move under another branch, or to the top', async () => {
    await expect(move('s4', 'company').promise).resolves.toBeDefined();
    await expect(move('s4', null).promise).resolves.toBeDefined();
  });

  it('stops on a loop already stored', async () => {
    const { promise, find } = move('services', 'a', { ...tree, a: 'b', b: 'a' });
    await expect(promise).resolves.toBeDefined();
    expect(find).toHaveBeenCalledTimes(2);
  });
});
