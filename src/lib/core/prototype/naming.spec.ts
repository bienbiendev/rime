import { describe, expect, it } from 'vitest';
import { makeDocTypeName } from './naming.js';

describe('makeDocTypeName', () => {
  it('capitalizes the slug, drops the $ of a rime collection, and adds Doc', () => {
    expect(makeDocTypeName('pages')).toBe('PagesDoc');
    expect(makeDocTypeName('$mediasDirectories')).toBe('MediasDirectoriesDoc');
  });
});
