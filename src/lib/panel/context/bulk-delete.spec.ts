import { describe, expect, it } from 'vitest';
import { deletedToast } from './bulk-delete.js';

describe('deletedToast', () => {
  it('counts the documents the answer lists', () => {
    expect(deletedToast(3, 3)).toEqual({ kind: 'success', message: 'Successfully deleted 3 docs' });
  });

  it('says how many were not deleted when fewer went', () => {
    expect(deletedToast(3, 2)).toEqual({
      kind: 'warning',
      message: 'Deleted 2 of 3 docs: 1 could not be deleted'
    });
  });
});
