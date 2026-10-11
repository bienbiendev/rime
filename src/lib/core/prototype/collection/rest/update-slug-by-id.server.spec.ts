import type { Dic } from '#lib/util/types.js';
import { expect, test, vi } from 'vitest';
import { restUpdateSlugById } from './update-slug-by-id.server.js';

/** `PATCH /api/pages/p1/slug` with `body`, over a collection that records the write. */
const setup = (body: Dic) => {
  const updateSlugById = vi.fn(async () => ({ slug: 'web', path: 'web', url: '/web' }));
  const event = {
    params: { id: 'p1' },
    request: new Request('https://site.com/api/pages/p1/slug', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }),
    locals: {
      rime: {
        routes: { slug: 'pages' },
        config: { isCollection: () => true },
        collection: () => ({ updateSlugById })
      }
    }
  };
  return { event: event as any, updateSlugById };
};

test('a body that names a locale answers 400 and writes nothing', async () => {
  const { event, updateSlugById } = setup({ slug: 'web', locale: 'en' });
  await expect(restUpdateSlugById(event)).rejects.toMatchObject({ status: 400 });
  expect(updateSlugById).not.toHaveBeenCalled();
});

test("a slug is written in the request's locale", async () => {
  const { event, updateSlugById } = setup({ slug: 'web' });
  const response = await restUpdateSlugById(event);
  expect(await response.json()).toEqual({ slug: 'web', path: 'web', url: '/web' });
  expect(updateSlugById).toHaveBeenCalledWith({ id: 'p1', slug: 'web' });
});

test('a body without a slug answers 400', async () => {
  const { event, updateSlugById } = setup({ title: 'web' });
  await expect(restUpdateSlugById(event)).rejects.toMatchObject({ status: 400 });
  expect(updateSlugById).not.toHaveBeenCalled();
});
