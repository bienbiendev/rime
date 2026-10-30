import i18n from '#lib/core/i18n/index.js';
import common from '#lib/core/i18n/en/common.js';
import { describe, expect, it } from 'vitest';
import { counted, documentsCounted } from './count.js';

i18n.init({ common });

describe('counted', () => {
  it('says one in the singular, any other count in the plural', () => {
    expect(counted('common.collection_count_drafts', 1)).toBe('1 draft');
    expect(counted('common.collection_count_drafts', 3)).toBe('3 drafts');
  });
});

describe('documentsCounted', () => {
  it('counts files in an upload collection, documents elsewhere', () => {
    expect(documentsCounted(1, true)).toBe('1 file');
    expect(documentsCounted(24, false)).toBe('24 documents');
  });
});
