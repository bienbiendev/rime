import { describe, expect, it } from 'vitest';
import { LinkFieldBuilder } from './index.js';

describe('LinkFieldBuilder.sanitize', () => {
  it("stores no id, url or title of a document link's target", () => {
    expect(
      LinkFieldBuilder.sanitize({
        type: 'pages',
        value: 'p1',
        target: '_self',
        id: 'p1',
        url: 'https://x.test',
        title: 'X'
      })
    ).toEqual({ type: 'pages', value: 'p1', target: '_self' });
  });

  it('keeps a safe url on a url link, and drops one that would run script', () => {
    const link = { type: 'url', value: 'https://x.test', target: '_blank' } as const;
    expect(LinkFieldBuilder.sanitize({ ...link, url: 'https://x.test' })).toEqual({
      ...link,
      url: 'https://x.test'
    });
    expect(LinkFieldBuilder.sanitize({ ...link, url: 'javascript:alert(1)' })?.url).toBeUndefined();
  });
});
