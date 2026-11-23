import { describe, expect, it } from 'vitest';
import { tab, tabs } from '#lib/fields/tabs/index.js';
import { text } from '#lib/fields/text/index.js';
import { findInlineTitle, findTitleField } from './find-title.js';

/**
 * The title a config names: `isTitle()` marks the field, `isTitle('inline')` also makes the
 * document's heading edit it.
 */
describe('findTitleField and findInlineTitle', () => {
  it('finds a plain title, which the heading does not edit', () => {
    const fields = [text('title').isTitle(), text('intro')];

    expect(findTitleField(fields)).toBe('title');
    expect(findInlineTitle(fields)).toBeNull();
  });

  it('finds an inline title by its full path, inside tabs', () => {
    const fields = [tabs(tab('attributes').fields(text('title').isTitle('inline')))];

    expect(findTitleField(fields)).toBe('attributes.title');
    expect(findInlineTitle(fields)).toBe('attributes.title');
  });

  it('reads the first title only', () => {
    const fields = [text('title').isTitle(), text('name').isTitle('inline')];

    expect(findTitleField(fields)).toBe('title');
    expect(findInlineTitle(fields)).toBeNull();
  });

  it('finds nothing without a title', () => {
    expect(findTitleField([text('intro')])).toBeNull();
    expect(findInlineTitle([text('intro')])).toBeNull();
  });
});
