import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { create } from '$lib/core/prototype/collection/definition.js';
import { RimeError } from '$lib/core/errors/index.js';
import { VERSIONS_OPERATIONS, defineVersionUpdateOperation } from './strategy.js';

/**
 * What an update does to the row it selected. Which row that is, is `versionsReadQuery`'s.
 */
describe('defineVersionUpdateOperation', () => {
  const plain = create('spec_op_plain', { fields: [text('title')] });
  const versioned = create('spec_op_versioned', { versions: true, fields: [text('title')] });
  const drafts = create('spec_op_drafts', { versions: { draft: true }, fields: [text('title')] });
  const autoSave = create('spec_op_auto', {
    versions: { draft: true, autoSave: true },
    fields: [text('title')]
  });

  it.each([
    [plain, {}, VERSIONS_OPERATIONS.UPDATE],
    [plain, { versionId: 'v1', fork: true }, VERSIONS_OPERATIONS.UPDATE],
    // Without drafts, a save that names no row is a version of its own.
    [versioned, {}, VERSIONS_OPERATIONS.NEW_VERSION],
    [versioned, { versionId: 'v1' }, VERSIONS_OPERATIONS.UPDATE_VERSION],
    [versioned, { versionId: 'v1', fork: true }, VERSIONS_OPERATIONS.NEW_VERSION],
    // With drafts, the selected row is written unless a fork is asked for.
    [drafts, {}, VERSIONS_OPERATIONS.UPDATE_VERSION],
    [drafts, { versionId: 'v1' }, VERSIONS_OPERATIONS.UPDATE_VERSION],
    [drafts, { fork: true }, VERSIONS_OPERATIONS.NEW_VERSION],
    [drafts, { versionId: 'v1', fork: true }, VERSIONS_OPERATIONS.NEW_VERSION],
    [autoSave, { versionId: 'v1' }, VERSIONS_OPERATIONS.UPDATE_VERSION],
    [autoSave, { versionId: 'v1', autoSave: true }, VERSIONS_OPERATIONS.NEW_AUTO_SAVE_FROM_VERSION],
    [
      autoSave,
      { versionId: 'a1', autoSave: true, originalIsAutoSave: true },
      VERSIONS_OPERATIONS.UPDATE_VERSION
    ]
  ])('%o with %o is %s', (config, params, expected) => {
    expect(defineVersionUpdateOperation({ ...params, config })).toBe(expected);
  });

  it('refuses an auto-save that names no version', () => {
    expect(() => defineVersionUpdateOperation({ autoSave: true, config: autoSave })).toThrowError(
      expect.objectContaining({ code: RimeError.BAD_REQUEST })
    );
  });

  it('refuses an auto-save on a config that does not opt in', () => {
    expect(() =>
      defineVersionUpdateOperation({ autoSave: true, versionId: 'v1', config: drafts })
    ).toThrowError(expect.objectContaining({ code: RimeError.BAD_REQUEST }));
  });

  it('ignores autoSave on a config without versions', () => {
    expect(defineVersionUpdateOperation({ autoSave: true, versionId: 'v1', config: plain })).toBe(
      VERSIONS_OPERATIONS.UPDATE
    );
  });
});
