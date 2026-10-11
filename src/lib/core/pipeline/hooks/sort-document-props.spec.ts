import { describe, expect, it } from 'vitest';
import { sortDocumentProps } from './sort-document-props.server.js';

const sorted = async (doc: object) => ((await sortDocumentProps({ doc } as any)) as any).doc;

describe('sortDocumentProps', () => {
  it('keeps a Date inside a list as a Date', async () => {
    const at = new Date(0);
    const doc = await sorted({ id: 'd', dates: [at, { b: 1, a: 2 }] });

    expect(doc.dates[0]).toBe(at);
    expect(Object.keys(doc.dates[1])).toEqual(['a', 'b']);
  });
});
