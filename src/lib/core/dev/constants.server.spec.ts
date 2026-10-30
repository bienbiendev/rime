import { describe, expect, it } from 'vitest';
import { relativeImportSpecifier } from './constants.server.js';

describe('relativeImportSpecifier', () => {
  it('starts a path inside the folder with ./, even when its first folder starts with a dot', () => {
    expect(relativeImportSpecifier('/a/src', '/a/src/.cms.generated/x.js')).toBe(
      './.cms.generated/x.js'
    );
    expect(relativeImportSpecifier('/a/src', '/a/src/+rime.generated/x.js')).toBe(
      './+rime.generated/x.js'
    );
  });

  it('keeps a path that climbs out with ../', () => {
    expect(relativeImportSpecifier('/a/src', '/a/lib/x.js')).toBe('../lib/x.js');
  });
});
