import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { create as createCollection } from '$lib/core/prototype/collection/definition.js';
import { create as createArea } from '$lib/core/prototype/area/definition.js';
import { validateVersions } from './validate-config.server.js';

describe('validateVersions', () => {
  it('has nothing to say about a config without versions', () => {
    const built = createCollection('spec_plain', { fields: [text('title')] });

    expect(validateVersions(built)).toEqual([]);
  });

  it('accepts drafts with autoSave', () => {
    const built = createCollection('spec_auto', {
      versions: { draft: true, autoSave: true },
      fields: [text('title')]
    });

    expect(validateVersions(built)).toEqual([]);
  });

  it('refuses autoSave without drafts on a collection', () => {
    const built = createCollection('spec_no_draft', {
      versions: { autoSave: true },
      fields: [text('title')]
    });

    expect(validateVersions(built)).toEqual([
      'Versions autoSave requires draft: true (spec_no_draft)'
    ]);
  });

  it('refuses autoSave without drafts on an area', () => {
    const built = createArea('spec_no_draft_area', {
      versions: { autoSave: true },
      fields: [text('title')]
    });

    expect(validateVersions(built)).toEqual([
      'Versions autoSave requires draft: true (spec_no_draft_area)'
    ]);
  });

  it('refuses autoSave on an upload collection', () => {
    const built = createCollection('spec_upload', {
      upload: true,
      versions: { draft: true, autoSave: true },
      fields: [text('alt')]
    });

    expect(validateVersions(built)).toEqual([
      'Versions autoSave is not supported on an upload collection (spec_upload)'
    ]);
  });
});
