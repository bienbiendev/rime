import { describe, expect, it } from 'vitest';
import { text } from './index.js';
import { duplicateText } from './module.server.js';

/** The hook's context for `field`, its collection holding the `taken` values. */
const contextFor = (field: ReturnType<typeof text>, taken: string[] = []) => {
  const find = async ({ query }: any) =>
    taken.includes(query.where.title.equals) ? [{ id: 'other' }] : [];
  const event = { locals: { rime: { collection: () => ({ system: () => ({ find }) }) } } } as any;
  return { event, config: field.get, slug: 'pages', path: 'title', doc: { title: 'Sale' } } as any;
};

describe('duplicateText', () => {
  it('gives a title (copy), and leaves an empty title empty', async () => {
    const title = text('title').isTitle();
    expect(await duplicateText('Sale', contextFor(title))).toBe('Sale (copy)');
    expect(await duplicateText(null, contextFor(title))).toBe(null);
    expect(await duplicateText('', contextFor(title))).toBe('');
  });

  it('gives a unique text the first free (copy n)', async () => {
    const code = text('title').unique();
    expect(await duplicateText('Sale', contextFor(code, ['Sale']))).toBe('Sale (copy)');
    expect(await duplicateText('Sale', contextFor(code, ['Sale', 'Sale (copy)']))).toBe(
      'Sale (copy 2)'
    );
  });

  it('numbers a unique title from its source', async () => {
    const title = text('title').isTitle().unique();
    expect(await duplicateText('Sale', contextFor(title, ['Sale', 'Sale (copy)']))).toBe(
      'Sale (copy 2)'
    );
  });

  it('stops after 50 tries and keeps the last value tried', async () => {
    // Taken up to 'Sale (copy 61)': with no cap, the copy would get 'Sale (copy 62)'
    const taken = [
      'Sale',
      'Sale (copy)',
      ...Array.from({ length: 60 }, (_, i) => `Sale (copy ${i + 2})`)
    ];
    const code = text('title').unique();
    expect(await duplicateText('Sale', contextFor(code, taken))).toBe('Sale (copy 50)');
  });

  it('leaves a text that is neither the title nor unique', async () => {
    expect(await duplicateText('Sale', contextFor(text('title')))).toBe('Sale');
  });
});
