import { describe, expect, it } from 'vitest';
import { defineRelationsDiff } from './diff.server.js';

/** A stored junction row, as `relations.getAll` answers it. */
const row = (id: string, path: string, documentId: string, extra: object = {}) => ({
  id,
  ownerId: 'p1',
  path,
  position: 0,
  relationTo: 'medias',
  documentId,
  ...extra
});

/** An incoming relation, as `extractRelations` makes it from the data. */
const ref = (path: string, documentId: string, extra: object = {}) => ({
  path,
  position: 0,
  relationTo: 'medias',
  documentId,
  ...extra
});

const diff = (existingRelations: any[], incomingRelations: any[], locale?: string) =>
  defineRelationsDiff({ existingRelations, incomingRelations, locale });

const ids = (rows: { id?: string }[]) => rows.map((one) => one.id).sort();

describe('defineRelationsDiff', () => {
  it('leaves an unchanged bare-id relation alone, with or without a locale column', () => {
    expect(diff([row('r1', 'image', 'm1')], [ref('image', 'm1')])).toEqual({
      toAdd: [],
      toDelete: [],
      toUpdate: []
    });
    // A junction with no localized relation has no `locale` column at all
    expect(diff([row('r1', 'image', 'm1', { locale: null })], [ref('image', 'm1')])).toEqual({
      toAdd: [],
      toDelete: [],
      toUpdate: []
    });
  });

  it('adds a new relation', () => {
    const result = diff([], [ref('image', 'm1')]);
    expect(result.toAdd).toEqual([ref('image', 'm1')]);
    expect(result.toDelete).toEqual([]);
  });

  it('deletes a relation the data no longer holds', () => {
    const result = diff([row('r1', 'image', 'm1'), row('r2', 'cover', 'm2')], [ref('cover', 'm2')]);
    expect(ids(result.toDelete)).toEqual(['r1']);
    expect(result.toAdd).toEqual([]);
  });

  it('replaces a bare id that changed: the old row goes, the new one comes', () => {
    const result = diff([row('r1', 'image', 'm1')], [ref('image', 'm2')]);
    expect(ids(result.toDelete)).toEqual(['r1']);
    expect(result.toAdd).toEqual([ref('image', 'm2')]);
  });

  it('updates a ref sent back with its row id to its new document', () => {
    const result = diff([row('r1', 'image', 'm1')], [ref('image', 'm2', { id: 'r1' })]);
    expect(result.toUpdate).toEqual([expect.objectContaining({ id: 'r1', documentId: 'm2' })]);
    expect(result.toDelete).toEqual([]);
    expect(result.toAdd).toEqual([]);
  });

  it('moves a ref sent back with its row id: new path and position, same row', () => {
    const result = diff(
      [row('r1', 'sections.0.image', 'm1')],
      [ref('sections.2.image', 'm1', { id: 'r1', position: 1 })]
    );
    expect(result.toUpdate).toEqual([
      expect.objectContaining({ id: 'r1', path: 'sections.2.image', position: 1 })
    ]);
    expect(result.toDelete).toEqual([]);
  });

  it('reorders a many relation sent back with its row ids', () => {
    const result = diff(
      [row('r1', 'images', 'm1', { position: 0 }), row('r2', 'images', 'm2', { position: 1 })],
      [
        ref('images', 'm2', { id: 'r2', position: 0 }),
        ref('images', 'm1', { id: 'r1', position: 1 })
      ]
    );
    expect(result.toUpdate.map((one) => [one.id, one.position])).toEqual([
      ['r2', 0],
      ['r1', 1]
    ]);
    expect(result.toDelete).toEqual([]);
    expect(result.toAdd).toEqual([]);
  });

  it('deletes a row whose block moved to another index, when sent as bare ids', () => {
    // A new block at 0 holds m2, the old block moved to 1 still holds m1
    const result = diff(
      [row('r1', 'sections.0.image', 'm1')],
      [ref('sections.0.image', 'm2'), ref('sections.1.image', 'm1')]
    );
    expect(ids(result.toDelete)).toEqual(['r1']);
    expect(result.toAdd.map((one) => [one.path, one.documentId])).toEqual([
      ['sections.0.image', 'm2'],
      ['sections.1.image', 'm1']
    ]);
  });

  it('does not keep a row because a sibling path reads like it', () => {
    const result = diff([row('r1', 'meta.image', 'm1')], [ref('meta_image', 'm1')]);
    expect(ids(result.toDelete)).toEqual(['r1']);
    expect(result.toAdd).toEqual([ref('meta_image', 'm1')]);
  });

  it("keeps another locale's rows, and replaces this locale's", () => {
    const result = diff(
      [row('fr', 'title', 'm1', { locale: 'fr' }), row('en', 'title', 'm1', { locale: 'en' })],
      [ref('title', 'm2', { locale: 'en' })],
      'en'
    );
    expect(ids(result.toDelete)).toEqual(['en']);
    expect(result.toAdd).toEqual([ref('title', 'm2', { locale: 'en' })]);
  });

  it('leaves a row to the relation that names it by id, even when a bare id matches it', () => {
    // Tree items swapped: the new first item holds `m1` as a bare id at the old item's path,
    // the old item moved to 1 and sends its row back by id
    const result = diff(
      [row('r1', 'links.0.target', 'm1')],
      [ref('links.0.target', 'm1'), ref('links.1.target', 'm1', { id: 'r1' })]
    );
    expect(result.toUpdate).toEqual([
      expect.objectContaining({ id: 'r1', path: 'links.1.target' })
    ]);
    expect(result.toAdd).toEqual([ref('links.0.target', 'm1')]);
    expect(result.toDelete).toEqual([]);
  });

  it('updates a stored row once when two incoming relations name it', () => {
    const result = diff(
      [row('r1', 'image', 'm1')],
      [ref('image', 'm2', { id: 'r1' }), ref('image', 'm3', { id: 'r1' })]
    );
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].documentId).toBe('m2');
  });

  it('keeps the same document twice: the stored row is the first, the second is added', () => {
    const second = ref('gallery', 'm1', { position: 1 });
    const result = diff([row('r1', 'gallery', 'm1')], [ref('gallery', 'm1'), second]);
    expect(result).toEqual({ toAdd: [second], toDelete: [], toUpdate: [] });
  });

  it('carries a changed locale in the update', () => {
    const result = diff(
      [row('r1', 'image', 'm1', { locale: null })],
      [ref('image', 'm1', { id: 'r1', locale: 'fr' })],
      'fr'
    );
    expect(result.toUpdate).toEqual([expect.objectContaining({ id: 'r1', locale: 'fr' })]);
  });
});
