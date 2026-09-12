import { describe, expect, it } from 'vitest';
import { text } from '$lib/fields/text/index.js';
import { create } from '$lib/core/prototype/collection/definition.js';
import { RimeError } from '$lib/core/errors/index.js';
import { mergeContentRow } from './columns.server.js';

/**
 * A versioned document is a base row folded with one content row. The fold decides which row
 * answers `createdAt` and which answers `updatedAt`, and getting that wrong is silent: both rows
 * carry both columns, so a document reads a plausible date either way.
 */
describe('mergeContentRow', () => {
  const config = create('spec_merge', {
    versions: true,
    nested: true,
    fields: [text('title').isTitle()]
  });

  const baseCreated = new Date('2026-01-01T00:00:00.000Z');
  const baseUpdated = new Date('2026-03-01T00:00:00.000Z');
  const contentCreated = new Date('2026-02-01T00:00:00.000Z');
  const contentUpdated = new Date('2026-02-02T00:00:00.000Z');

  const row = () => ({
    id: 'doc1',
    createdAt: baseCreated,
    updatedAt: baseUpdated,
    _parent: 'p1',
    spec_merge__versions: [
      {
        id: 'v1',
        ownerId: 'doc1',
        createdAt: contentCreated,
        updatedAt: contentUpdated,
        title: 'Hello'
      }
    ]
  });

  it('takes createdAt from the base row and updatedAt from the content row', () => {
    const doc = mergeContentRow(row(), 'spec_merge__versions', config);

    expect(doc.id).toBe('doc1');
    expect(doc.createdAt).toBe(baseCreated);
    expect(doc.updatedAt).toBe(contentUpdated);
    expect(doc.title).toBe('Hello');
    expect(doc._parent).toBe('p1');
    expect(doc.contentId).toBe('v1');
    expect(doc.ownerId).toBeUndefined();
    expect(doc.spec_merge__versions).toBeUndefined();
  });

  it('does the same under a select', () => {
    const doc = mergeContentRow(row(), 'spec_merge__versions', config, [
      'createdAt',
      'updatedAt',
      '_parent',
      'title'
    ]);

    expect(doc.id).toBe('doc1');
    expect(doc.createdAt).toBe(baseCreated);
    expect(doc.updatedAt).toBe(contentUpdated);
    expect(doc._parent).toBe('p1');
    expect(doc.title).toBe('Hello');
    expect(doc.contentId).toBe('v1');
    expect(doc.ownerId).toBeUndefined();
  });

  it('is NOT_FOUND with no content row', () => {
    const empty = { ...row(), spec_merge__versions: [] };

    expect(() => mergeContentRow(empty, 'spec_merge__versions', config)).toThrowError(
      expect.objectContaining({ code: RimeError.NOT_FOUND })
    );
  });
});
