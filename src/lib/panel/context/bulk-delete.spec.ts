import i18n from '#lib/core/i18n/index.js';
import common from '#lib/core/i18n/en/common.js';
import { describe, expect, it } from 'vitest';
import { deletedToast } from './bulk-delete.js';

i18n.init({ common });

describe('deletedToast', () => {
  it('counts the documents the answer lists', () => {
    expect(deletedToast(3, 3, false)).toEqual({ kind: 'success', message: '3 documents deleted' });
  });

  it('counts files in an upload collection, one in the singular', () => {
    expect(deletedToast(1, 1, true)).toEqual({ kind: 'success', message: '1 file deleted' });
  });

  it('says how many were not deleted when fewer went', () => {
    expect(deletedToast(3, 2, true)).toEqual({
      kind: 'warning',
      message: '1 of 3 files could not be deleted'
    });
  });
});
