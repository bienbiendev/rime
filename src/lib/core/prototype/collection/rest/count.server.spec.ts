import { describe, expect, it, vi } from 'vitest';
import { restCount } from './count.server.js';

/** A `GET /api/pages/count…` from `user`, the collection counting 3 whatever it is asked. */
const request = (search: string, user?: object) => {
  const count = vi.fn(async () => 3);
  const event = {
    url: new URL(`https://site.com/api/pages/count${search}`),
    locals: {
      user,
      rime: {
        routes: { slug: 'pages' },
        config: { isCollection: () => true },
        collection: () => ({ config: { asTitle: 'title' }, count })
      }
    }
  } as any;
  return { response: restCount(event) as Promise<Response>, count };
};

describe('GET /api/<collection>/count', () => {
  it('counts what the where of the URL matches, and answers { count }', async () => {
    const { response, count } = request('?where[title][equals]=Home');
    expect(await (await response).json()).toEqual({ count: 3 });
    expect(count).toHaveBeenCalledWith({
      query: { where: { title: { equals: 'Home' } } },
      latest: undefined
    });
  });

  it("hands staff's latest on, and drops a visitor's", async () => {
    const staff = request('?latest=true', { id: 's1', isStaff: true });
    await staff.response;
    expect(staff.count).toHaveBeenCalledWith({ query: undefined, latest: true });

    const visitor = request('?latest=true');
    await visitor.response;
    expect(visitor.count).toHaveBeenCalledWith({ query: undefined, latest: undefined });
  });
});
