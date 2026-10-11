import { describe, expect, it } from 'vitest';
import { slug } from './index.js';
import { duplicateSlug } from './module.server.js';

/** The hook's context for `field`, its collection holding the `taken` values. */
const contextFor = (field: ReturnType<typeof slug>, taken: string[] = []) => {
  const find = async ({ query }: any) =>
    taken.includes(query.where.slug.equals) ? [{ id: 'other' }] : [];
  const event = { locals: { rime: { collection: () => ({ system: () => ({ find }) }) } } } as any;
  return { event, config: field.get, slug: 'pages', path: 'slug', doc: { slug: 'sale' } } as any;
};

describe('duplicateSlug', () => {
  it('gives a title -copy, and leaves an empty one empty', async () => {
    const title = slug('slug').isTitle();
    expect(await duplicateSlug('sale', contextFor(title))).toBe('sale-copy');
    expect(await duplicateSlug('', contextFor(title))).toBe('');
  });

  it('gives a unique slug the first free -copy-n', async () => {
    const unique = slug('slug').unique();
    expect(await duplicateSlug('sale', contextFor(unique, ['sale']))).toBe('sale-copy');
    expect(await duplicateSlug('sale', contextFor(unique, ['sale', 'sale-copy']))).toBe(
      'sale-copy-2'
    );
  });

  it('numbers a unique title slug from its source', async () => {
    const titleSlug = slug('slug').isTitle().unique();
    expect(await duplicateSlug('sale', contextFor(titleSlug, ['sale', 'sale-copy']))).toBe(
      'sale-copy-2'
    );
  });

  it('stops after 50 tries and keeps the last value tried', async () => {
    // Taken up to 'sale-copy-61': with no cap, the copy would get 'sale-copy-62'
    const taken = [
      'sale',
      'sale-copy',
      ...Array.from({ length: 60 }, (_, i) => `sale-copy-${i + 2}`)
    ];
    const unique = slug('slug').unique();
    expect(await duplicateSlug('sale', contextFor(unique, taken))).toBe('sale-copy-50');
  });

  it('leaves a slug that is neither the title nor unique', async () => {
    expect(await duplicateSlug('sale', contextFor(slug('slug')))).toBe('sale');
  });
});
