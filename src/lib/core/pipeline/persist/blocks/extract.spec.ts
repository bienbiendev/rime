import { block, blocks, text } from '#lib/fields/index.js';
import { describe, expect, it } from 'vitest';
import { extractBlocks } from './extract.server.js';

const sections = blocks('sections', [block('note').fields(text('text'))]);

describe('extractBlocks', () => {
  it('takes each block place from where it sits in the data, not from what it carries', () => {
    // Read back, then sent in another order: the path and position they carry are stale
    const data = {
      sections: [
        { id: 'b2', type: 'note', text: 'Two', path: 'sections', position: 1 },
        { id: 'b1', type: 'note', text: 'One', path: 'old.place', position: 0 },
        { type: 'note', text: 'New' }
      ]
    };
    const extracted = extractBlocks({ data, configMap: { sections } as any });
    expect(extracted.map((one) => [one.id, one.path, one.position])).toEqual([
      ['b2', 'sections', 0],
      ['b1', 'sections', 1],
      [undefined, 'sections', 2]
    ]);
  });

  it('leaves out a block of a type the list does not declare', () => {
    const data = { sections: [{ type: 'nope' }, { type: 'note', text: 'Kept' }] };
    const extracted = extractBlocks({ data, configMap: { sections } as any });
    expect(extracted.map((one) => one.type)).toEqual(['note']);
  });
});
