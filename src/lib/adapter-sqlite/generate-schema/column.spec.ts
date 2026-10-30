import { describe, expect, it } from 'vitest';
import { FormFieldBuilder, type DataType } from '#lib/core/fields/builders/form-field-builder.js';
import { select, slug, time, toggle } from '#lib/fields/index.js';
import { date } from '#lib/fields/date/index.js';
import { text } from '#lib/fields/text/index.js';
import { toSchemaColumn } from './column.server.js';

describe('toSchemaColumn', () => {
  it('gives a required column no NOT NULL and no default', () => {
    expect(toSchemaColumn(text('title').required())).toBe(`title: text('title')`);
    expect(toSchemaColumn(date('from').required().defaultValue(new Date(1000)))).toBe(
      `from: integer('from', { mode: 'timestamp_ms' })`
    );
    expect(toSchemaColumn(select('tags').options('a').many().required())).toBe(
      `tags: text('tags', { mode: 'json' })`
    );
    expect(toSchemaColumn(time('at').required())).toBe(`at: text('at')`);
  });

  it('gives a $notNull() column NOT NULL and that default', () => {
    expect(toSchemaColumn(toggle('ok').$notNull({ default: false }))).toBe(
      `ok: integer('ok', { mode: 'boolean' }).notNull().default(false)`
    );
  });

  it('gives a unique field no UNIQUE constraint: validateFields checks it', () => {
    expect(toSchemaColumn(slug('slug').unique().required())).toBe(`slug: text('slug')`);
  });

  it('spells a field from a package by its storage type', () => {
    class ColorPickerFieldBuilder extends FormFieldBuilder {
      get dataType(): DataType {
        return 'text';
      }
    }
    const tint = new ColorPickerFieldBuilder('tint', 'colorPicker').required();
    expect(toSchemaColumn(tint)).toBe(`tint: text('tint')`);
  });
});
