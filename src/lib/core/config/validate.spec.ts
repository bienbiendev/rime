import { create } from '#lib/core/prototype/collection/definition.js';
import { logger } from '#lib/core/logger.server.js';
import { block, blocks, group, relation, tab, tabs, text } from '#lib/fields/index.js';
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

describe('validate: field rules', () => {
  const configOf = (slug: string, fields: unknown[]) =>
    ({ collections: [create(slug, { fields } as never)], areas: [], $adapter: {} }) as any;

  /** The messages `validate` logs for `fields` on a `slug` collection. */
  const errorsOf = (slug: string, fields: unknown[]) => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const valid = validate(configOf(slug, fields));
    const messages = error.mock.calls.map(([message]) => message);
    error.mockRestore();
    return { valid, messages };
  };

  test('a relation to an unknown collection is refused', () => {
    const { valid, messages } = errorsOf('specRelUnknown', [
      relation('author').to('nowhere' as never)
    ]);
    expect(valid).toBe(false);
    expect(messages).toEqual([
      'Relation field author references unknown collection nowhere, in collection specRelUnknown'
    ]);
  });

  test('a $root() relation is refused', () => {
    const { messages } = errorsOf('specRelRoot', [
      relation('author')
        .to('specRelRoot' as never)
        .$root()
    ]);
    expect(messages).toEqual(["Relation field author can't be $root(), in collection specRelRoot"]);
  });

  test('a localized $root() field is refused', () => {
    const { messages } = errorsOf('specRootLocalized', [text('title').$root().localized()]);
    expect(messages).toEqual([
      "Field title of collection specRootLocalized with $root(), can't be localized"
    ]);
  });

  test('a field name starting with a digit is refused, a leading _ is accepted', () => {
    expect(errorsOf('specFieldName', [text('1title')]).messages).toEqual([
      expect.stringContaining('Field 1title of collection specFieldName should')
    ]);
    expect(errorsOf('specUnderscore', [text('_title')]).valid).toBe(true);
  });

  test('a field named id is refused, at any level', () => {
    const reserved = '"id" is reserved for the document\'s and each row\'s id';
    expect(errorsOf('specIdRoot', [text('id')]).messages).toEqual([
      `Field id of collection specIdRoot: ${reserved}`
    ]);
    expect(errorsOf('specIdGroup', [group('video').fields(text('id'))]).messages).toEqual([
      `Field id of collection specIdGroup: ${reserved}`
    ]);
    expect(
      errorsOf('specIdBlock', [blocks('layout', [block('embed').fields(text('id'))])]).messages
    ).toEqual([`Field id of collection specIdBlock: ${reserved}`]);
  });

  test('two blocks of one name and different fields are refused, at any level', () => {
    const fields = [
      blocks('layout', [block('hero').fields(text('title'))]),
      group('aside').fields(blocks('more', [block('hero').fields(text('summary'))]))
    ];
    expect(errorsOf('specBlockTwice', fields).messages).toEqual([
      expect.stringContaining('Each block with same name should be')
    ]);
  });

  test('a duplicate name is found below the first level', () => {
    const fields = [group('seo').fields(text('title'), text('title'))];
    expect(errorsOf('specNestedDup', fields).messages).toEqual([
      "Duplicate field or tab 'title' in collection 'specNestedDup'"
    ]);
  });
});
