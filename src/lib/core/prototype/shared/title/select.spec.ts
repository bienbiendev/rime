import { describe, expect, it } from 'vitest';
import { selectWithTitle } from './select.js';

/**
 * `title` is derived, not stored. A select naming it has to carry the field it is derived from, or
 * `setDocumentTitle` reads a column that was never fetched and falls back to the document's id.
 */
describe('selectWithTitle', () => {
  it('is absent when the request did not select', () => {
    expect(selectWithTitle(null, 'attributes.title')).toBeUndefined();
    expect(selectWithTitle('', 'attributes.title')).toBeUndefined();
  });

  it('splits on commas and leaves a select without `title` alone', () => {
    expect(selectWithTitle('attributes.slug,attributes.author', 'attributes.title')).toEqual([
      'attributes.slug',
      'attributes.author'
    ]);
  });

  it('adds the asTitle field when `title` is selected', () => {
    expect(selectWithTitle('title', 'attributes.title')).toEqual(['title', 'attributes.title']);
  });

  it('does not add it twice when the request already named it', () => {
    expect(selectWithTitle('title,attributes.title', 'attributes.title')).toEqual([
      'title',
      'attributes.title'
    ]);
  });

  it('leaves a select that names the asTitle field but not `title` alone', () => {
    expect(selectWithTitle('attributes.title', 'attributes.title')).toEqual(['attributes.title']);
  });
});
