import { describe, expect, it } from 'vitest';
import { setDocumentTitle } from './set-document-title.server.js';

/** The title `setDocumentTitle` puts on a document whose `asTitle` field holds `value`. */
const titleOf = async (value: unknown) => {
  const result = await setDocumentTitle({
    config: { asTitle: 'name' },
    doc: { id: 'e1', name: value },
    context: { params: {} }
  } as any);
  return (result as any).doc.title;
};

describe('setDocumentTitle', () => {
  it('titles a document with the day of a date', async () => {
    expect(await titleOf(new Date('2026-11-03T00:00:00Z'))).toBe('2026-11-03');
  });

  it('titles a document with the words of a rich text', async () => {
    const value = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rethink it' }] }]
    };
    expect(await titleOf(value)).toBe('Rethink it');
  });

  it('titles a document with its id when the field is empty', async () => {
    expect(await titleOf(null)).toBe('e1');
    expect(await titleOf('')).toBe('e1');
  });
});
