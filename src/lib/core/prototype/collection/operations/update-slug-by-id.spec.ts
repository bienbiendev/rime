import { RimeError } from '#lib/core/errors/index.js';
import { Hooks } from '#lib/core/pipeline/define-hook.js';
import { authorize } from '#lib/core/pipeline/hooks/authorize.server.js';
import type { Dic } from '#lib/util/types.js';
import { describe, expect, it, vi } from 'vitest';
import { updateSlugById } from './update-slug-by-id.js';

vi.mock('#lib/core/prototype/shared/url/refresh.server.js', () => ({
  refreshUrls: async () => {}
}));

/** A published page `p1` at `/old`, in a `pages` collection whose hooks are `$hooks`. */
const setup = (args: { $hooks: Dic; mayUpdate?: boolean }) => {
  const page = { id: 'p1', _parent: null, url: '/old' };
  const collection = {
    find: async () => [page],
    findById: async () => ({ ...page, url: '/new' })
  };
  const paths = {
    get: async () => [{ slug: 'old', path: 'old', locale: 'en', url: '/old' }],
    siblingSlugs: async () => [],
    setSlug: async () => ({ slug: 'new', path: 'new' })
  };
  const config = {
    slug: 'pages',
    $url: () => '/',
    access: { update: () => args.mayUpdate ?? true },
    $hooks: args.$hooks
  };
  const event = {
    locals: {
      user: { id: 's1' },
      rime: { collection: () => ({ system: () => collection }), adapter: { paths } }
    }
  };
  const run = () =>
    updateSlugById({ id: 'p1', slug: 'new', locale: 'en', ctx: { config, event } as any });
  return { run, page };
};

describe('updateSlugById', () => {
  it('runs the config’s beforeOperation chain, access included', async () => {
    const guard = Hooks.beforeOperation(async () => {
      throw new RimeError(RimeError.BAD_REQUEST, 'frozen');
    });
    await expect(setup({ $hooks: { beforeOperation: [guard] } }).run()).rejects.toThrow('frozen');

    const denied = setup({ $hooks: { beforeOperation: [authorize] }, mayUpdate: false });
    await expect(denied.run()).rejects.toMatchObject({ code: RimeError.UNAUTHORIZED });
  });

  it('runs afterUpdate once, on the page with its new url, the page before as the original', async () => {
    const calls: Dic[] = [];
    const record = Hooks.afterUpdate(async (args) => {
      calls.push(args);
      return args;
    });
    const { run, page } = setup({ $hooks: { afterUpdate: [record] } });
    await run();

    expect(calls).toHaveLength(1);
    expect(calls[0].doc.url).toBe('/new');
    expect(calls[0].context.originalDoc).toBe(page);
    expect(calls[0].operation).toBe('update');
  });
});
