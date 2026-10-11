import { block, blocks } from '#lib/fields/blocks/index.js';
import { relation } from '#lib/fields/relation/index.js';
import { richText } from '#lib/fields/rich-text/index.js';
import { describe, expect, it } from 'vitest';
import { withoutRowKeys } from './without-row-keys.js';

describe('withoutRowKeys', () => {
  const fields = [
    richText('body'),
    relation('image').to('medias'),
    blocks('sections', [block('text').fields(richText('body'))])
  ];
  const node = { type: 'upload', attrs: { id: 'm1' } };
  const body = { type: 'doc', content: [node] };

  it('takes the keys off the rows and keeps every rich-text value whole', () => {
    const data = {
      id: 'd1',
      body,
      image: [{ id: 'r1', relationTo: 'medias', documentId: 'm1' }],
      sections: [{ id: 'b1', type: 'text', ownerId: 'd1', body }]
    };

    expect(withoutRowKeys(data, fields, ['id', 'ownerId'])).toEqual({
      body,
      image: [{ relationTo: 'medias', documentId: 'm1' }],
      sections: [{ type: 'text', body }]
    });
  });
});
