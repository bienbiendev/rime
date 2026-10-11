import { describe, expect, it, vi } from 'vitest';
import { freeValue } from './unique.server.js';

const nextCopy = (source: string, n: number) =>
  n === 1 ? `${source} (copy)` : `${source} (copy ${n})`;

/** A context whose collection holds the `taken` values. */
const contextWith = (taken: string[], path = 'title', doc: object = { title: 'Sale' }) => {
  const find = vi.fn(async ({ query }) => {
    const value = query.where[path].equals;
    return taken.includes(value) ? [{ id: 'other' }] : [];
  });
  const event = {
    locals: { rime: { collection: () => ({ system: () => ({ find }) }) } }
  } as any;
  return { find, context: { event, config: {} as any, slug: 'pages', path, locale: 'en', doc } };
};

describe('freeValue', () => {
  it('keeps a value nobody holds', async () => {
    const { context } = contextWith([]);
    expect(await freeValue('Sale (copy)', context as any, nextCopy)).toBe('Sale (copy)');
  });

  it('numbers a taken value from the source value', async () => {
    const { context } = contextWith(['Sale', 'Sale (copy)']);
    expect(await freeValue('Sale (copy)', context as any, nextCopy)).toBe('Sale (copy 2)');
  });

  it('looks each value up once', async () => {
    const { context, find } = contextWith(['Sale', 'Sale (copy)']);
    await freeValue('Sale (copy)', context as any, nextCopy);
    const looked = find.mock.calls.map(([{ query }]) => query.where.title.equals);
    expect(looked).toEqual(['Sale (copy)', 'Sale (copy 2)']);
  });

  it('does not look up an empty value', async () => {
    const { context, find } = contextWith(['']);
    expect(await freeValue(null, context as any, nextCopy)).toBe(null);
    expect(await freeValue('', context as any, nextCopy)).toBe('');
    expect(find).not.toHaveBeenCalled();
  });

  it('looks the value up with a query object on the field path, in the locale', async () => {
    const { context, find } = contextWith([], 'meta.sku', { meta: { sku: 'A+1&b' } });
    await freeValue('A+1&b', context as any, nextCopy);
    expect(find).toHaveBeenCalledWith({
      locale: 'en',
      query: { where: { 'meta.sku': { equals: 'A+1&b' } } },
      select: ['id']
    });
  });
});
