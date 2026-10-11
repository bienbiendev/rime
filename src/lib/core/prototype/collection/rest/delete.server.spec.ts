import { expect, test, vi } from 'vitest';
import { restDelete } from './delete.server.js';

/** `DELETE /api/pages<search>`, over a collection that records the delete. */
const setup = (search: string) => {
  const del = vi.fn(async () => ['p1']);
  const event = {
    url: new URL(`https://site.com/api/pages${search}`),
    locals: {
      rime: {
        routes: { slug: 'pages' },
        config: { isCollection: () => true },
        collection: () => ({ delete: del })
      }
    }
  };
  return { event: event as any, del };
};

test('a list delete with no where answers 400 and deletes nothing', async () => {
  const { event, del } = setup('');
  await expect(restDelete(event)).rejects.toMatchObject({ status: 400 });
  expect(del).not.toHaveBeenCalled();
});

test('a list delete with only a limit answers 400 and deletes nothing', async () => {
  const { event, del } = setup('?limit=0');
  await expect(restDelete(event)).rejects.toMatchObject({ status: 400 });
  expect(del).not.toHaveBeenCalled();
});

test('a list delete with a where deletes what it matches', async () => {
  const { event, del } = setup('?where[id][in_array]=p1');
  const response = await restDelete(event);
  expect(await response.json()).toEqual({ docs: ['p1'] });
  expect(del).toHaveBeenCalledWith(
    expect.objectContaining({ query: { where: { id: { in_array: 'p1' } } } })
  );
});
