import { create } from '#lib/core/prototype/collection/definition.js';
import { logger } from '#lib/core/logger.server.js';
import { block, blocks, tab, tabs, text } from '#lib/fields/index.js';
import { describe, expect, test, vi } from 'vitest';
import validate from './validate.server.js';

vi.mock('#lib/core/dev/cache.server.js', () => ({ default: { clear: () => {} } }));

const configWith = (slug: string, blockName: string) =>
  ({
    collections: [
      create(slug, { fields: [blocks('layout', [block(blockName).fields(text('title'))])] })
    ],
    areas: [],
    $adapter: {}
  }) as any;

describe('validate: block names', () => {
  test('a block name with _ or - is accepted', () => {
    expect(validate(configWith('specUnderscoreBlock', 'call_to_action'))).toBe(true);
    expect(validate(configWith('specDashBlock', 'cta-block'))).toBe(true);
  });

  test('a block name with a "." is refused', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    expect(validate(configWith('specDotBlock', 'a.b'))).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Block a.b'));
    error.mockRestore();
  });
});

describe('validate: names at one level', () => {
  /** A config whose `pages` collection has `fields`. */
  const configOf = (slug: string, fields: unknown[]) =>
    ({ collections: [create(slug, { fields } as never)], areas: [], $adapter: {} }) as any;

  test('a tab named like a field beside it is refused', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const fields = [text('seo'), tabs(tab('seo').fields(text('title')))];

    expect(validate(configOf('specTabField', fields))).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Duplicate field or tab 'seo'"));
    error.mockRestore();
  });

  test('two tabs of one name are refused', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const fields = [tabs(tab('seo').fields(text('title')), tab('seo').fields(text('summary')))];

    expect(validate(configOf('specTwoTabs', fields))).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Duplicate field or tab 'seo'"));
    error.mockRestore();
  });
});

describe('validate: derived slugs', () => {
  const configOf = (slug: string) =>
    ({
      collections: [create(slug, { fields: [text('title')] })],
      areas: [],
      $adapter: {}
    }) as any;

  test('a derived slug is camelCase parts joined by __', () => {
    expect(validate(configOf('$specThing__versions'))).toBe(true);
    expect(validate(configOf('$specThingDirectories'))).toBe(true);
  });

  test('a `$` slug that is not one is refused', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});

    expect(validate(configOf('$My-thing'))).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Slug $My-thing is not a valid derived slug')
    );
    error.mockRestore();
  });
});
