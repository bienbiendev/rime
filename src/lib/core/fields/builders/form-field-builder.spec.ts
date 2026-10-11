import { checkbox } from '#lib/fields/checkbox/index.js';
import { email } from '#lib/fields/email/index.js';
import { group } from '#lib/fields/group/index.js';
import { number } from '#lib/fields/number/index.js';
import { relation } from '#lib/fields/relation/index.js';
import { richText } from '#lib/fields/rich-text/index.js';
import { slug } from '#lib/fields/slug/index.js';
import { text } from '#lib/fields/text/index.js';
import { time } from '#lib/fields/time/index.js';
import { describe, expect, test } from 'vitest';
import type { FormFieldBuilder } from './form-field-builder.js';

const ctx = { config: {} } as any;

describe('validate', () => {
  test('min(0) and max(0) are bounds', () => {
    expect(number('n').min(0).use.validate(-1, ctx)).not.toBe(true);
    expect(number('n').max(0).use.validate(1, ctx)).not.toBe(true);
    expect(number('n').min(0).max(0).use.validate(0, ctx)).toBe(true);
  });

  test('an empty value skips validate; a value that is there is still checked', () => {
    expect(email('e').use.validate('', ctx)).toBe(true);
    expect(slug('s').use.validate('', ctx)).toBe(true);
    expect(time('t').use.validate('', ctx)).toBe(true);
    expect(number('n').use.validate(null, ctx)).toBe(true);
    expect(email('e').use.validate('nope', ctx)).not.toBe(true);
    expect(slug('s').use.validate('Not A Slug', ctx)).not.toBe(true);
  });

  test('validate adds a rule after the field’s own check', () => {
    const age = number('age')
      .min(0)
      .validate((value) => Number.isInteger(value) || 'Whole years');
    expect(age.use.validate(-5, ctx)).toBe('Should be greater than 0');
    expect(age.use.validate(2.5, ctx)).toBe('Whole years');
    expect(age.use.validate(7, ctx)).toBe(true);
    expect(
      checkbox('agree')
        .validate(() => true)
        .use.validate('yes', ctx)
    ).toBe('Should be true/false');
  });
});

describe('clone', () => {
  test('keeps $references', () => {
    const field = text('owner').$references('staff', { resolve: true });
    expect(field.clone()._references).toEqual({ table: 'staff', resolve: true });
  });

  test('keeps the reference of a field inside a localized group', () => {
    const meta = group('meta').fields(text('owner').$references('staff')).localized();
    expect((meta.get.fields[0] as FormFieldBuilder)._references).toEqual({ table: 'staff' });
  });
});

describe('rich text isEmpty', () => {
  const empty = { type: 'doc', content: [{ type: 'paragraph' }] };

  test('an empty editor is empty, as a document and as a JSON string', () => {
    expect(richText('r').use.isEmpty(empty)).toBe(true);
    expect(richText('r').use.isEmpty(JSON.stringify(empty))).toBe(true);
    expect(richText('r').use.isEmpty({ type: 'doc', content: [] })).toBe(true);
    expect(richText('r').use.isEmpty('  ')).toBe(true);
    expect(richText('r').use.isEmpty(null)).toBe(true);
  });

  test('text, a leaf and a plain string are content', () => {
    const text = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }]
    };
    const image = { type: 'doc', content: [{ type: 'image', attrs: { src: 'a.png' } }] };
    expect(richText('r').use.isEmpty(text)).toBe(false);
    expect(richText('r').use.isEmpty(JSON.stringify(text))).toBe(false);
    expect(richText('r').use.isEmpty(image)).toBe(false);
    expect(richText('r').use.isEmpty('Hello')).toBe(false);
  });
});

describe('generateType', () => {
  test('names the doc type of a rime collection without its $', () => {
    const folder = text('folder').$references('$mediasDirectories' as never, { resolve: true });
    expect(folder.use.generateType()).toContain('ResolvedReference<MediasDirectoriesDoc>');
    const linked = (relation('folder') as any).to('$mediasDirectories');
    expect(linked.use.generateType()).toContain('RelationValue<MediasDirectoriesDoc>');
  });
});
